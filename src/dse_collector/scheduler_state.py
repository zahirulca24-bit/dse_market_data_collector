from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Lock

_lock = Lock()
_state: dict[str, object] = {
    "started_at": None,
    "last_cycle_started_at": None,
    "last_cycle_finished_at": None,
    "next_cycle_at": None,
    "cycle_status": "starting",
    "last_error": None,
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def scheduler_started(initial_delay_seconds: int) -> None:
    now = _now()
    with _lock:
        _state.update({
            "started_at": _iso(now),
            "last_cycle_started_at": None,
            "last_cycle_finished_at": None,
            "next_cycle_at": _iso(now + timedelta(seconds=initial_delay_seconds)),
            "cycle_status": "waiting",
            "last_error": None,
        })


def cycle_started() -> None:
    now = _now()
    with _lock:
        _state.update({
            "last_cycle_started_at": _iso(now),
            "next_cycle_at": None,
            "cycle_status": "running",
            "last_error": None,
        })


def cycle_finished(interval_seconds: int, error: str | None = None) -> None:
    now = _now()
    with _lock:
        _state.update({
            "last_cycle_finished_at": _iso(now),
            "next_cycle_at": _iso(now + timedelta(seconds=interval_seconds)),
            "cycle_status": "error" if error else "waiting",
            "last_error": error,
        })


def snapshot(task_running: bool) -> dict:
    with _lock:
        result = dict(_state)
    result["taskRunning"] = task_running
    result["processAwake"] = True
    return result
