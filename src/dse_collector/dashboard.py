from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .storage import SupabaseStorage


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


def market_stock(row: dict) -> dict:
    return {
        "symbol": row.get("trade_code", ""),
        "sector": "Unclassified",
        "ltp": _num(row.get("ltp")),
        "ycp": _num(row.get("yesterday_close")),
        "change": _num(row.get("change")),
        "high": _num(row.get("high")),
        "low": _num(row.get("low")),
        "volume": _int(row.get("volume")),
        "updatedAt": row.get("snapshot_at") or "",
    }


def ingestion_status(storage: SupabaseStorage) -> dict:
    latest = storage.latest_run() or {}
    symbols = storage.symbol_counts()
    total = len(symbols)
    status = latest.get("status", "")
    return {
        "total": total,
        "completed": total if status == "success" else 0,
        "pending": 0,
        "failed": 1 if status == "failed" else 0,
        "inProgress": "collector" if status == "running" else "",
        "nextRunAt": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
        "lastSynced": latest.get("updated_at") or latest.get("started_at") or "",
        "lastRecords": _int(latest.get("rows_collected")),
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


def tracker(storage: SupabaseStorage) -> list[dict]:
    return [
        {
            "symbol": item["symbol"],
            "status": "completed",
            "totalRecordsInserted": item["count"],
            "lastUpdated": item.get("lastUpdated") or "",
        }
        for item in storage.symbol_counts()
    ]


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
