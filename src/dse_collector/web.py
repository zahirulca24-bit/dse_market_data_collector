from __future__ import annotations

import asyncio
import hmac
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .backfill import run_historical_batch
from .config import Settings
from .dashboard import (
    daily_history,
    history,
    ingestion_status,
    logs,
    market_stock,
    monitoring,
    overview,
    tracker,
)
from .main import collect_once
from .storage import SupabaseStorage

logger = logging.getLogger("dse_collector.web")

_scheduler_task: asyncio.Task | None = None


async def _historical_scheduler_loop() -> None:
    settings = Settings.from_env()
    await asyncio.sleep(10)
    while True:
        try:
            result = await asyncio.to_thread(run_historical_batch, "scheduler")
            logger.info("Historical scheduler result: %s", result)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Historical scheduler cycle failed")
        await asyncio.sleep(settings.collector_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler_task
    _scheduler_task = asyncio.create_task(_historical_scheduler_loop())
    try:
        yield
    finally:
        if _scheduler_task:
            _scheduler_task.cancel()
            try:
                await _scheduler_task
            except asyncio.CancelledError:
                pass


app = FastAPI(title="DSE Market Data Collector", version="3.2.0", lifespan=lifespan)


def _authorized(authorization: str | None, settings: Settings) -> bool:
    if not settings.cron_secret:
        return False
    if not authorization or not authorization.startswith("Bearer "):
        return False
    supplied = authorization[7:].strip()
    return hmac.compare_digest(supplied, settings.cron_secret)


def _storage() -> SupabaseStorage:
    settings = Settings.from_env()
    return SupabaseStorage(settings.supabase_url, settings.supabase_service_role_key)


@app.get("/health")
@app.get("/api/healthz")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/market/overview")
def market_overview() -> dict:
    return overview(_storage())


@app.get("/api/market/stocks")
def market_stocks(sector: str | None = None, search: str | None = None) -> list[dict]:
    rows = [market_stock(row) for row in _storage().latest_quotes()]
    if sector and sector.lower() != "all":
        rows = [row for row in rows if row["sector"].lower() == sector.lower()]
    if search:
        needle = search.strip().upper()
        rows = [row for row in rows if needle in row["symbol"].upper()]
    return rows


@app.get("/api/market/stocks/{symbol}/history")
def stock_history(symbol: str) -> list[dict]:
    return history(_storage(), symbol)


@app.get("/api/market/stocks/{symbol}/daily-history")
def stock_daily_history(symbol: str) -> list[dict]:
    return daily_history(_storage(), symbol)


@app.get("/api/market/monitoring")
def market_monitoring() -> dict:
    settings = Settings.from_env()
    storage = SupabaseStorage(settings.supabase_url, settings.supabase_service_role_key)
    try:
        return monitoring(storage, settings.collector_interval_seconds)
    except Exception as exc:
        return {
            "supabase": {"connected": False, "status": "disconnected", "error": str(exc)},
            "dataSave": {"status": "unknown", "lastResult": "unknown"},
            "engine": {
                "status": "error",
                "currentSector": None,
                "currentStocks": [],
                "currentStockCount": 0,
                "currentTask": "Unavailable",
                "collectionMode": "unknown",
                "intervalSeconds": settings.collector_interval_seconds,
            },
            "universe": {
                "totalSectors": 0,
                "sectorsWithHistory": 0,
                "remainingSectors": 0,
                "totalStocks": 0,
                "stocksWithHistory": 0,
                "remainingStocks": 0,
                "historicalCoveragePct": 0,
            },
            "phases": [],
            "lastRun": {"timestamp": None, "status": "unknown", "rowsSaved": 0, "error": str(exc)},
            "nextRun": {
                "expectedAt": None,
                "intervalSeconds": settings.collector_interval_seconds,
                "note": "Expected cadence; actual execution is controlled by the external scheduler.",
            },
            "latestSnapshot": {"timestamp": None, "rows": 0},
            "dailyHistory": {"available": False, "error": str(exc), "rowsLoadedForMonitoring": 0},
            "coverageRows": [],
        }


@app.get("/api/market/ingestion")
def market_ingestion_status() -> dict:
    settings = Settings.from_env()
    return ingestion_status(_storage(), settings.collector_interval_seconds)


@app.post("/api/market/ingestion")
def market_ingestion_action() -> dict:
    return {
        "accepted": False,
        "message": "Collector is scheduler-managed. Use POST /api/collector/run with Bearer auth for manual collection.",
    }


@app.get("/api/market/ingestion/tracker")
def market_ingestion_tracker() -> list[dict]:
    return tracker(_storage())


@app.get("/api/market/ingestion/logs")
def market_ingestion_logs() -> list[dict]:
    return logs(_storage())


@app.get("/api/market/ingestion/start")
def market_ingestion_start() -> dict:
    return {"accepted": False, "message": "Collector is scheduler-managed. Use the secured collector endpoint for manual runs."}


@app.get("/api/collector/status")
def collector_status(authorization: Annotated[str | None, Header()] = None) -> dict:
    settings = Settings.from_env()
    if not _authorized(authorization, settings):
        raise HTTPException(status_code=401, detail="unauthorized")
    storage = SupabaseStorage(settings.supabase_url, settings.supabase_service_role_key)
    return {"latest_run": storage.latest_run()}


@app.post("/api/collector/run")
def run_collector(
    authorization: Annotated[str | None, Header()] = None,
    force: bool = Query(False),
) -> dict:
    settings = Settings.from_env()
    if not _authorized(authorization, settings):
        raise HTTPException(status_code=401, detail="unauthorized")
    try:
        return collect_once(trigger="http", force=force)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/collector/historical/run")
def run_historical_collector(
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    settings = Settings.from_env()
    if not _authorized(authorization, settings):
        raise HTTPException(status_code=401, detail="unauthorized")
    try:
        return run_historical_batch(trigger="http")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if FRONTEND_DIR.exists():
    assets = FRONTEND_DIR / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def frontend(full_path: str):
        candidate = FRONTEND_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIR / "index.html")
else:
    @app.get("/", include_in_schema=False)
    def root() -> dict:
        return {"service": "dse-market-data-collector", "status": "ok", "frontend": "not-built"}


def port() -> int:
    return int(os.getenv("PORT", "8000"))
