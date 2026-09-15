from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from .sectors import sector_for_symbol
from .storage import SupabaseStorage


PHASES = (
    ("current", "Current Period", "2026-07-01", None),
    ("phase1", "Phase 1", "2025-07-01", "2026-06-30"),
    ("phase2", "Phase 2", "2024-07-01", "2025-06-30"),
    ("phase3", "Phase 3", "2023-07-01", "2024-06-30"),
)


def _num(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _int(value) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _iso_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def market_stock(row: dict) -> dict:
    symbol = row.get("trade_code", "")
    return {
        "symbol": symbol,
        "sector": sector_for_symbol(symbol),
        "ltp": _num(row.get("ltp")),
        "ycp": _num(row.get("yesterday_close")),
        "change": _num(row.get("change")),
        "high": _num(row.get("high")),
        "low": _num(row.get("low")),
        "volume": _int(row.get("volume")),
        "updatedAt": row.get("snapshot_at") or "",
    }


def ingestion_status(storage: SupabaseStorage, interval_seconds: int = 120) -> dict:
    latest = storage.latest_market_run() or {}
    symbols = storage.symbol_counts()
    total = len(symbols)
    status = latest.get("status", "")
    last_at = latest.get("updated_at") or latest.get("started_at")
    last_dt = _iso_dt(last_at)
    next_run_at = ((last_dt + timedelta(seconds=interval_seconds)).isoformat() if last_dt else None)
    return {
        "total": total,
        "completed": total if status == "success" else 0,
        "pending": 0,
        "failed": 1 if status == "failed" else 0,
        "inProgress": "collector" if status == "running" else "",
        "nextRunAt": next_run_at,
        "intervalSeconds": interval_seconds,
        "lastSynced": last_at or "",
        "lastRecords": _int(latest.get("rows_collected")),
        "lastStatus": status or "unknown",
    }


def overview(storage: SupabaseStorage) -> dict:
    stocks = [market_stock(row) for row in storage.latest_quotes()]
    as_of = max((stock["updatedAt"] for stock in stocks if stock["updatedAt"]), default=datetime.now(timezone.utc).isoformat())
    return {
        "market": "Dhaka Stock Exchange",
        "asOf": as_of,
        "stocks": stocks,
        "sectors": sorted({stock["sector"] for stock in stocks}),
        "ingestion": ingestion_status(storage),
    }


def history(storage: SupabaseStorage, symbol: str) -> list[dict]:
    points = []
    for row in storage.quote_history(symbol):
        ltp = _num(row.get("ltp"))
        points.append({
            "time": row.get("snapshot_at") or "",
            "open": _num(row.get("close_price")) or ltp,
            "high": _num(row.get("high")) or ltp,
            "low": _num(row.get("low")) or ltp,
            "close": ltp,
            "volume": _int(row.get("volume")),
        })
    return points


def daily_history(storage: SupabaseStorage, symbol: str) -> list[dict]:
    return [
        {
            "time": row.get("trade_date") or "",
            "open": row.get("open"),
            "high": row.get("high"),
            "low": row.get("low"),
            "close": row.get("close"),
            "volume": _int(row.get("volume")),
            "valueMn": row.get("value_mn"),
            "source": row.get("source") or "",
        }
        for row in storage.daily_history_for_symbol(symbol)
    ]


def _phase_stats(rows: list[dict], total_stocks: int) -> tuple[list[dict], list[dict]]:
    today = date.today().isoformat()
    summaries: list[dict] = []
    coverage_rows: list[dict] = []
    for phase_id, label, start_date, fixed_end in PHASES:
        end_date = fixed_end or today
        phase_rows = [row for row in rows if start_date <= str(row.get("trade_date") or "") <= end_date]
        if not phase_rows:
            continue
        actual_dates = sorted(str(row.get("trade_date") or "") for row in phase_rows if row.get("trade_date"))
        actual_start_date = actual_dates[0] if actual_dates else start_date
        actual_end_date = actual_dates[-1] if actual_dates else end_date
        by_symbol: dict[str, list[dict]] = {}
        for row in phase_rows:
            symbol = str(row.get("trade_code") or "").upper()
            if symbol:
                by_symbol.setdefault(symbol, []).append(row)
        symbols_with_data = len(by_symbol)
        coverage_pct = round((symbols_with_data / total_stocks) * 100, 2) if total_stocks else 0.0
        status = "complete" if total_stocks and symbols_with_data >= total_stocks else "in_progress"
        summaries.append({
            "id": phase_id,
            "label": label,
            "startDate": actual_start_date,
            "endDate": actual_end_date,
            "symbolsWithData": symbols_with_data,
            "totalStocks": total_stocks,
            "remainingStocks": max(total_stocks - symbols_with_data, 0),
            "rows": len(phase_rows),
            "coveragePct": coverage_pct,
            "status": status,
        })
        for symbol, symbol_rows in sorted(by_symbol.items()):
            dates = sorted(str(row.get("trade_date") or "") for row in symbol_rows if row.get("trade_date"))
            coverage_rows.append({
                "sector": sector_for_symbol(symbol),
                "symbol": symbol,
                "earliestDate": dates[0] if dates else None,
                "latestDate": dates[-1] if dates else None,
                "rows": len(symbol_rows),
                "targetPeriod": label,
                "coveragePct": None,
                "status": "data_available",
            })
    return summaries, coverage_rows


def monitoring(storage: SupabaseStorage, interval_seconds: int = 120) -> dict:
    latest_run = storage.latest_historical_run() or {}
    live_rows = storage.latest_quotes()
    stocks = [market_stock(row) for row in live_rows]
    total_stocks = len(stocks)
    sectors = sorted({stock["sector"] for stock in stocks})
    daily_available = True
    daily_error = None
    try:
        daily_rows = storage.daily_history_rows()
    except Exception as exc:
        daily_rows = []
        daily_available = False
        daily_error = str(exc)
    distinct_history_symbols = {str(row.get("trade_code") or "").upper() for row in daily_rows if row.get("trade_code")}
    sectors_with_history = {sector_for_symbol(symbol) for symbol in distinct_history_symbols}
    phases, coverage_rows = _phase_stats(daily_rows, total_stocks)
    run_status = latest_run.get("status") or "unknown"
    trigger = str(latest_run.get("trigger") or "")
    trigger_parts = trigger.split(":", 2)
    active_phase = trigger_parts[1] if len(trigger_parts) > 1 and trigger_parts[0] == "historical" else None
    active_symbols = ([item for item in trigger_parts[2].split(",") if item] if len(trigger_parts) > 2 and trigger_parts[0] == "historical" else [])
    last_at = latest_run.get("updated_at") or latest_run.get("started_at")
    last_dt = _iso_dt(last_at)
    next_run_at = ((last_dt + timedelta(seconds=interval_seconds)).isoformat() if last_dt else None)
    if run_status == "running":
        save_status, engine_status = "saving", "running"
    elif run_status == "failed":
        save_status, engine_status = "failed", "error"
    elif run_status in {"success", "skipped"}:
        save_status, engine_status = "idle", "idle"
    else:
        save_status, engine_status = "unknown", "idle"
    return {
        "supabase": {"connected": True, "status": "connected"},
        "dataSave": {"status": save_status, "lastResult": run_status},
        "engine": {
            "status": engine_status,
            "currentSector": None,
            "currentStocks": active_symbols if run_status == "running" else [],
            "currentStockCount": len(active_symbols) if run_status == "running" else 0,
            "currentTask": (f"Historical {active_phase}: {', '.join(active_symbols)}" if run_status == "running" and active_phase else "Waiting for next 3-stock historical batch"),
            "currentPhase": active_phase,
            "collectionMode": "historical-phase-batch",
            "intervalSeconds": interval_seconds,
        },
        "universe": {
            "totalSectors": len(sectors),
            "sectorsWithHistory": len(sectors_with_history),
            "remainingSectors": max(len(sectors) - len(sectors_with_history), 0),
            "totalStocks": total_stocks,
            "stocksWithHistory": len(distinct_history_symbols),
            "remainingStocks": max(total_stocks - len(distinct_history_symbols), 0),
            "historicalCoveragePct": round((len(distinct_history_symbols) / total_stocks) * 100, 2) if total_stocks else 0.0,
        },
        "phases": phases,
        "lastRun": {"timestamp": last_at, "status": run_status, "rowsSaved": _int(latest_run.get("rows_collected")), "error": latest_run.get("error_message")},
        "nextRun": {"expectedAt": next_run_at, "intervalSeconds": interval_seconds, "note": "Internal 2-minute scheduler runs while the Render service is awake."},
        "latestSnapshot": {"timestamp": max((stock["updatedAt"] for stock in stocks if stock["updatedAt"]), default=None), "rows": total_stocks},
        "dailyHistory": {"available": daily_available, "error": daily_error, "rowsLoadedForMonitoring": len(daily_rows)},
        "coverageRows": coverage_rows,
    }


def tracker(storage: SupabaseStorage) -> list[dict]:
    return [{"symbol": item["symbol"], "status": "completed", "totalRecordsInserted": item["count"], "lastUpdated": item.get("lastUpdated") or ""} for item in storage.symbol_counts()]


def logs(storage: SupabaseStorage) -> list[dict]:
    result = []
    for run in storage.recent_runs():
        result.append({
            "time": run.get("updated_at") or run.get("started_at") or "",
            "symbol": "MARKET",
            "status": run.get("status", ""),
            "message": run.get("error_message") or f"Collector run via {run.get('trigger', 'cron')}",
            "records": _int(run.get("rows_collected")),
        })
    return result
