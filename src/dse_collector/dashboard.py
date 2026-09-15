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
    try: return float(value or 0)
    except (TypeError, ValueError): return 0.0

def _int(value) -> int:
    try: return int(value or 0)
    except (TypeError, ValueError): return 0

def _iso_dt(value: str | None) -> datetime | None:
    if not value: return None
    try: return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError: return None

def market_stock(row: dict) -> dict:
    symbol = row.get("trade_code", "")
    return {"symbol": symbol, "sector": sector_for_symbol(symbol), "ltp": _num(row.get("ltp")), "ycp": _num(row.get("yesterday_close")), "change": _num(row.get("change")), "high": _num(row.get("high")), "low": _num(row.get("low")), "volume": _int(row.get("volume")), "updatedAt": row.get("snapshot_at") or ""}

def ingestion_status(storage: SupabaseStorage, interval_seconds: int = 120) -> dict:
    latest = storage.latest_market_run() or {}; symbols = storage.symbol_counts(); total = len(symbols); status = latest.get("status", ""); last_at = latest.get("updated_at") or latest.get("started_at"); last_dt = _iso_dt(last_at)
    return {"total": total, "completed": total if status == "success" else 0, "pending": 0, "failed": 1 if status == "failed" else 0, "inProgress": "collector" if status == "running" else "", "nextRunAt": (last_dt + timedelta(seconds=interval_seconds)).isoformat() if last_dt else None, "intervalSeconds": interval_seconds, "lastSynced": last_at or "", "lastRecords": _int(latest.get("rows_collected")), "lastStatus": status or "unknown"}

def overview(storage: SupabaseStorage) -> dict:
    stocks = [market_stock(row) for row in storage.latest_quotes()]
    return {"market": "Dhaka Stock Exchange", "asOf": max((s["updatedAt"] for s in stocks if s["updatedAt"]), default=datetime.now(timezone.utc).isoformat()), "stocks": stocks, "sectors": sorted({s["sector"] for s in stocks}), "ingestion": ingestion_status(storage)}

def history(storage: SupabaseStorage, symbol: str) -> list[dict]:
    points = []
    for row in storage.quote_history(symbol):
        ltp = _num(row.get("ltp")); points.append({"time": row.get("snapshot_at") or "", "open": _num(row.get("close_price")) or ltp, "high": _num(row.get("high")) or ltp, "low": _num(row.get("low")) or ltp, "close": ltp, "volume": _int(row.get("volume"))})
    return points

def daily_history(storage: SupabaseStorage, symbol: str) -> list[dict]:
    return [{"time": r.get("trade_date") or "", "open": r.get("open"), "high": r.get("high"), "low": r.get("low"), "close": r.get("close"), "volume": _int(r.get("volume")), "valueMn": r.get("value_mn"), "source": r.get("source") or ""} for r in storage.daily_history_for_symbol(symbol)]

def _phase_stats(storage: SupabaseStorage, total_stocks: int) -> tuple[list[dict], list[dict], set[str]]:
    today = date.today().isoformat(); summaries = []; coverage_rows = []; all_symbols: set[str] = set()
    for phase_id, label, start_date, fixed_end in PHASES:
        end_date = fixed_end or today
        stats = storage.history_monitoring_stats(start_date, end_date)
        if not stats: continue
        symbols = {str(r.get("trade_code") or "").upper() for r in stats if r.get("trade_code")}; all_symbols.update(symbols)
        earliest = min((str(r.get("earliest_date")) for r in stats if r.get("earliest_date")), default=start_date)
        latest = max((str(r.get("latest_date")) for r in stats if r.get("latest_date")), default=end_date)
        rows = sum(_int(r.get("row_count")) for r in stats); count = len(symbols); pct = round((count / total_stocks) * 100, 2) if total_stocks else 0.0
        summaries.append({"id": phase_id, "label": label, "startDate": earliest, "endDate": latest, "symbolsWithData": count, "totalStocks": total_stocks, "remainingStocks": max(total_stocks-count, 0), "rows": rows, "coveragePct": pct, "status": "complete" if total_stocks and count >= total_stocks else "in_progress"})
        for r in stats:
            symbol = str(r.get("trade_code") or "").upper()
            if symbol: coverage_rows.append({"sector": sector_for_symbol(symbol), "symbol": symbol, "earliestDate": str(r.get("earliest_date")) if r.get("earliest_date") else None, "latestDate": str(r.get("latest_date")) if r.get("latest_date") else None, "rows": _int(r.get("row_count")), "targetPeriod": label, "coveragePct": None, "status": "data_available"})
    return summaries, coverage_rows, all_symbols

def monitoring(storage: SupabaseStorage, interval_seconds: int = 120) -> dict:
    latest_run = storage.latest_historical_run() or {}; stocks = [market_stock(r) for r in storage.latest_quotes()]; total_stocks = len(stocks); sectors = sorted({s["sector"] for s in stocks}); daily_available = True; daily_error = None; total_history_rows = 0
    try:
        phases, coverage_rows, history_symbols = _phase_stats(storage, total_stocks); total_history_rows = storage.history_total_rows()
    except Exception as exc:
        phases, coverage_rows, history_symbols = [], [], set(); daily_available = False; daily_error = str(exc)
    sectors_with_history = {sector_for_symbol(s) for s in history_symbols}; run_status = latest_run.get("status") or "unknown"; trigger = str(latest_run.get("trigger") or ""); parts = trigger.split(":", 2); active_phase = parts[1] if len(parts)>1 and parts[0]=="historical" else None; active_symbols = [x for x in parts[2].split(",") if x] if len(parts)>2 and parts[0]=="historical" else []; last_at = latest_run.get("updated_at") or latest_run.get("started_at"); last_dt = _iso_dt(last_at)
    if run_status == "running": save_status, engine_status = "saving", "running"
    elif run_status == "failed": save_status, engine_status = "failed", "error"
    elif run_status in {"success", "skipped"}: save_status, engine_status = "idle", "idle"
    else: save_status, engine_status = "unknown", "idle"
    return {
        "supabase": {"connected": True, "status": "connected"}, "dataSave": {"status": save_status, "lastResult": run_status},
        "engine": {"status": engine_status, "currentSector": None, "currentStocks": active_symbols if run_status=="running" else [], "currentStockCount": len(active_symbols) if run_status=="running" else 0, "currentTask": f"Historical {active_phase}: {', '.join(active_symbols)}" if run_status=="running" and active_phase else "Waiting for next 3-stock historical batch", "currentPhase": active_phase, "collectionMode": "historical-phase-batch", "intervalSeconds": interval_seconds},
        "universe": {"totalSectors": len(sectors), "sectorsWithHistory": len(sectors_with_history), "remainingSectors": max(len(sectors)-len(sectors_with_history),0), "totalStocks": total_stocks, "stocksWithHistory": len(history_symbols), "remainingStocks": max(total_stocks-len(history_symbols),0), "historicalCoveragePct": round((len(history_symbols)/total_stocks)*100,2) if total_stocks else 0.0},
        "phases": phases, "lastRun": {"timestamp": last_at, "status": run_status, "rowsSaved": _int(latest_run.get("rows_collected")), "error": latest_run.get("error_message")}, "nextRun": {"expectedAt": (last_dt+timedelta(seconds=interval_seconds)).isoformat() if last_dt else None, "intervalSeconds": interval_seconds, "note": "Internal 2-minute scheduler runs while the Render service is awake."}, "latestSnapshot": {"timestamp": max((s["updatedAt"] for s in stocks if s["updatedAt"]), default=None), "rows": total_stocks}, "dailyHistory": {"available": daily_available, "error": daily_error, "rowsLoadedForMonitoring": 0, "totalRows": total_history_rows, "aggregation": "database"}, "coverageRows": coverage_rows}

def tracker(storage: SupabaseStorage) -> list[dict]:
    return [{"symbol": i["symbol"], "status": "completed", "totalRecordsInserted": i["count"], "lastUpdated": i.get("lastUpdated") or ""} for i in storage.symbol_counts()]

def logs(storage: SupabaseStorage) -> list[dict]:
    return [{"time": r.get("updated_at") or r.get("started_at") or "", "symbol": "MARKET", "status": r.get("status", ""), "message": r.get("error_message") or f"Collector run via {r.get('trigger','cron')}", "records": _int(r.get("rows_collected"))} for r in storage.recent_runs()]
