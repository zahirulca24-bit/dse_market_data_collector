from __future__ import annotations

import hmac
import os
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import Settings
from .dashboard import history, ingestion_status, logs, market_stock, overview, tracker
from .main import collect_once
from .storage import SupabaseStorage

app = FastAPI(title="DSE Market Data Collector", version="3.0.0")


def _authorized(authorization: str | None, settings: Settings) -> bool:
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


@app.get("/api/market/ingestion")
def market_ingestion_status() -> dict:
    return ingestion_status(_storage())


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
