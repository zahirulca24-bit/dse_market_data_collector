from __future__ import annotations

import hmac
import os
from typing import Annotated

from fastapi import FastAPI, Header, HTTPException, Query

from .config import Settings
from .main import collect_once
from .storage import SupabaseStorage

app = FastAPI(title="DSE Market Data Collector", version="2.0.0")


def _authorized(authorization: str | None, settings: Settings) -> bool:
    if not authorization or not authorization.startswith("Bearer "):
        return False
    supplied = authorization[7:].strip()
    return hmac.compare_digest(supplied, settings.cron_secret)


@app.get("/")
def root() -> dict:
    return {"service": "dse-market-data-collector", "status": "ok"}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/collector/status")
def collector_status(
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
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


def port() -> int:
    return int(os.getenv("PORT", "8000"))
