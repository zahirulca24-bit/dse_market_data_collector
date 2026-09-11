from __future__ import annotations

import logging
import sys
import time
import uuid
from datetime import datetime, time as dt_time
from zoneinfo import ZoneInfo

import httpx

from .config import Settings
from .parser import parse_latest_share_price, records
from .storage import SupabaseStorage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger("dse_collector")


def _parse_hhmm(value: str) -> dt_time:
    hour, minute = value.split(":", 1)
    return dt_time(int(hour), int(minute))


def _market_window_state(settings: Settings) -> tuple[bool, str]:
    now = datetime.now(ZoneInfo(settings.market_timezone))
    if now.weekday() not in settings.market_days:
        return False, f"market closed for weekday {now.weekday()}"
    current = now.time().replace(second=0, microsecond=0)
    if current < _parse_hhmm(settings.market_open) or current > _parse_hhmm(settings.market_close):
        return False, f"outside market window {settings.market_open}-{settings.market_close}"
    return True, "market window open"


def _fetch_html(settings: Settings) -> str:
    last_error: Exception | None = None
    for attempt in range(1, settings.retry_attempts + 1):
        try:
            with httpx.Client(
                timeout=settings.http_timeout_seconds,
                follow_redirects=True,
                headers={
                    "User-Agent": settings.user_agent,
                    "Accept": "text/html,application/xhtml+xml",
                },
            ) as client:
                response = client.get(settings.dse_source_url)
                response.raise_for_status()
                return response.text
        except Exception as exc:
            last_error = exc
            logger.warning("DSE fetch attempt %s/%s failed: %s", attempt, settings.retry_attempts, exc)
            if attempt < settings.retry_attempts:
                time.sleep(settings.retry_backoff_seconds * attempt)
    assert last_error is not None
    raise last_error


def collect_once(trigger: str = "cron", force: bool = False) -> dict:
    settings = Settings.from_env()
    storage = SupabaseStorage(settings.supabase_url, settings.supabase_service_role_key)
    owner = str(uuid.uuid4())

    if not storage.acquire_lock(owner, settings.lock_ttl_seconds):
        return {"status": "locked", "rows_collected": 0, "message": "another collector run is active"}

    run_id: str | None = None
    try:
        run_id = storage.start_run(settings.dse_source_url, trigger=trigger)

        if settings.enforce_market_window and not force:
            is_open, reason = _market_window_state(settings)
            if not is_open:
                storage.skip_run(run_id, reason)
                return {"status": "skipped", "rows_collected": 0, "message": reason, "run_id": run_id}

        html = _fetch_html(settings)
        quotes = parse_latest_share_price(html)
        if not quotes:
            raise RuntimeError("DSE source returned no market rows")

        count = storage.upsert_quotes(records(quotes))
        storage.finish_run(run_id, count)
        logger.info("Collected and stored %s market quotes", count)
        return {"status": "success", "rows_collected": count, "run_id": run_id}
    except Exception as exc:
        logger.exception("Collector run failed")
        if run_id:
            try:
                storage.fail_run(run_id, str(exc))
            except Exception:
                logger.exception("Failed to record collector error in Supabase")
        raise
    finally:
        try:
            storage.release_lock(owner)
        except Exception:
            logger.exception("Failed to release collector lock")


def main() -> None:
    try:
        collect_once(trigger="cli", force=True)
    except Exception:
        sys.exit(1)


if __name__ == "__main__":
    main()
