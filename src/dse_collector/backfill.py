from __future__ import annotations

import json
import logging
import uuid
from datetime import date

from .config import Settings
from .historical import fetch_historical_data
from .storage import SupabaseStorage

logger = logging.getLogger("dse_collector.backfill")

PHASES = (
    ("current", "Current Period", "2026-07-01", None),
    ("phase1", "Phase 1", "2025-07-01", "2026-06-30"),
    ("phase2", "Phase 2", "2024-07-01", "2025-06-30"),
    ("phase3", "Phase 3", "2023-07-01", "2024-06-30"),
)

BATCH_SIZE = 3
MAX_ATTEMPTS = 3
ARCHIVE_URL = "https://www.dsebd.org/day_end_archive.php"


def _archive_floor() -> date:
    today = date.today()
    try:
        return today.replace(year=today.year - 2)
    except ValueError:
        return today.replace(year=today.year - 2, day=28)


def _phase_dates(start_date: str, fixed_end: str | None) -> tuple[str, str] | None:
    requested_start = date.fromisoformat(start_date)
    requested_end = date.fromisoformat(fixed_end) if fixed_end else date.today()
    floor = _archive_floor()

    if requested_end < floor:
        return None

    effective_start = max(requested_start, floor)
    if effective_start > requested_end:
        return None

    return effective_start.isoformat(), requested_end.isoformat()


def _parse_run_results(run: dict) -> list[dict]:
    raw = run.get("error_message")
    if not raw:
        return []
    try:
        payload = json.loads(raw)
    except Exception:
        return []
    results = payload.get("results")
    return results if isinstance(results, list) else []


def _progress(storage: SupabaseStorage) -> dict[str, dict[str, dict]]:
    state: dict[str, dict[str, dict]] = {}
    for phase_id, _, _, _ in PHASES:
        state[phase_id] = {}

    for run in storage.historical_runs():
        trigger = str(run.get("trigger") or "")
        parts = trigger.split(":", 2)
        if len(parts) < 2 or parts[0] != "historical":
            continue
        phase_id = parts[1]
        if phase_id not in state:
            continue

        for item in _parse_run_results(run):
            symbol = str(item.get("symbol") or "").upper()
            if not symbol:
                continue
            current = state[phase_id].setdefault(
                symbol,
                {"attempts": 0, "complete": False, "unavailable": False, "rows": 0},
            )
            current["attempts"] += 1
            if item.get("status") == "complete":
                current["complete"] = True
                current["rows"] = int(item.get("rows") or 0)
            elif current["attempts"] >= MAX_ATTEMPTS:
                current["unavailable"] = True
    return state


def _select_batch(storage: SupabaseStorage) -> tuple[str, str, str, list[str]] | None:
    live_symbols = sorted(
        {
            str(row.get("trade_code") or "").upper()
            for row in storage.latest_quotes()
            if row.get("trade_code")
        }
    )
    if not live_symbols:
        raise RuntimeError("No live symbol universe is available yet")

    progress = _progress(storage)

    for phase_id, label, start_date, fixed_end in PHASES:
        phase_state = progress[phase_id]
        remaining = []
        for symbol in live_symbols:
            item = phase_state.get(symbol, {})
            if item.get("complete") or item.get("unavailable"):
                continue
            remaining.append((int(item.get("attempts") or 0), symbol))

        if not remaining:
            continue

        remaining.sort(key=lambda item: (item[0], item[1]))
        selected = [symbol for _, symbol in remaining[:BATCH_SIZE]]
        phase_dates = _phase_dates(start_date, fixed_end)
        if phase_dates is None:
            continue
        start, end = phase_dates
        return phase_id, start, end, selected

    return None


def run_historical_batch(trigger: str = "scheduler") -> dict:
    settings = Settings.from_env()
    storage = SupabaseStorage(settings.supabase_url, settings.supabase_service_role_key)
    owner = f"historical-{uuid.uuid4()}"

    if not storage.acquire_lock(owner, settings.lock_ttl_seconds):
        return {
            "status": "locked",
            "rows_collected": 0,
            "message": "another collector run is active",
        }

    run_id: str | None = None
    try:
        selection = _select_batch(storage)
        if selection is None:
            return {
                "status": "complete",
                "rows_collected": 0,
                "message": "all historical phases have been processed",
            }

        phase_id, start_date, end_date, symbols = selection
        run_trigger = f"historical:{phase_id}:{','.join(symbols)}"
        run_id = storage.start_run(ARCHIVE_URL, trigger=run_trigger)

        results: list[dict] = []
        total_rows = 0

        for symbol in symbols:
            try:
                rows = fetch_historical_data(symbol, start_date, end_date)
                valid_rows = [row for row in rows if row.get("close") is not None]
                if valid_rows:
                    saved = storage.upsert_daily_history(valid_rows)
                    total_rows += saved
                    results.append(
                        {
                            "symbol": symbol,
                            "status": "complete",
                            "rows": saved,
                            "phase": phase_id,
                        }
                    )
                else:
                    results.append(
                        {
                            "symbol": symbol,
                            "status": "failed",
                            "rows": 0,
                            "phase": phase_id,
                            "error": "no valid historical rows returned",
                        }
                    )
            except Exception as exc:
                logger.exception("Historical fetch failed for %s", symbol)
                results.append(
                    {
                        "symbol": symbol,
                        "status": "failed",
                        "rows": 0,
                        "phase": phase_id,
                        "error": str(exc)[:300],
                    }
                )

        storage.finish_historical_run(run_id, total_rows, results)
        logger.info(
            "Historical batch %s collected %s rows for %s",
            phase_id,
            total_rows,
            ",".join(symbols),
        )
        return {
            "status": "success",
            "phase": phase_id,
            "symbols": symbols,
            "rows_collected": total_rows,
            "results": results,
            "run_id": run_id,
            "triggered_by": trigger,
        }
    except Exception as exc:
        logger.exception("Historical batch failed")
        if run_id:
            try:
                storage.fail_run(run_id, str(exc))
            except Exception:
                logger.exception("Failed to persist historical batch failure")
        raise
    finally:
        try:
            storage.release_lock(owner)
        except Exception:
            logger.exception("Failed to release historical batch lock")
