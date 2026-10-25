from __future__ import annotations

import logging
import time
from collections import defaultdict
from typing import Any

from ..storage import SupabaseStorage

logger = logging.getLogger("dse_collector.agents.scanner")

# In-memory cache for fast repeated queries
_SCAN_CACHE: dict[str, Any] = {
    "timestamp": 0.0,
    "data": None,
}
CACHE_TTL_SECONDS = 300  # 5 minutes


def calculate_rsi(closes: list[float], n: int = 14) -> float | None:
    """Wilder's 14-period RSI calculation."""
    if len(closes) < n + 1:
        return None
    gains = [max(0.0, closes[i] - closes[i - 1]) for i in range(1, len(closes))]
    losses = [max(0.0, closes[i - 1] - closes[i]) for i in range(1, len(closes))]
    avg_gain = sum(gains[:n]) / n
    avg_loss = sum(losses[:n]) / n
    for i in range(n, len(gains)):
        avg_gain = (avg_gain * (n - 1) + gains[i]) / n
        avg_loss = (avg_loss * (n - 1) + losses[i]) / n
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def analyze_setups(bars: list[dict]) -> tuple[list[str], dict[str, Any]]:
    """
    Given sorted chronological bars for a symbol:
    Evaluates:
      1. breakout_20d: Last close > max of previous 20 closes
      2. bull_flag: Up > 10% in sessions [-16:-6], then consolidated within 5% in sessions [-5:]
      3. reclaim_ma20: Previous close < MA20 and current close >= MA20
      4. oversold_bounce: Previous RSI < 30 and current close > previous close
      5. oversold: Current RSI < 30
    """
    if len(bars) < 22:
        return [], {}

    closes = [float(b["close"]) for b in bars if b.get("close") and float(b["close"]) > 0]
    if len(closes) < 22:
        return [], {}

    last = closes[-1]
    prev = closes[-2]
    
    # 20-day high (excluding today)
    hi20 = max(closes[-21:-1])
    
    # 20-day simple moving average
    ma20 = sum(closes[-20:]) / 20.0
    ma20_prev = sum(closes[-21:-1]) / 20.0

    # Bull flag calculation (needs at least 16 bars)
    run_pct = 0.0
    rng5_pct = 0.0
    if len(closes) >= 16 and closes[-16] > 0:
        run = (closes[-6] / closes[-16]) - 1.0
        run_pct = run * 100.0
        range5 = max(closes[-5:]) - min(closes[-5:])
        rng5_pct = (range5 / last) * 100.0 if last > 0 else 0.0

    # RSI
    r = calculate_rsi(closes, 14)
    r_prev = calculate_rsi(closes[:-1], 14)

    tags = []
    explanations = []

    # 1. Breakout 20-day
    if last > hi20:
        pct_above = ((last - hi20) / hi20) * 100.0
        tags.append("breakout_20d")
        explanations.append(f"20-day high breakout ({last:.2f} > {hi20:.2f}, +{pct_above:.1f}%)")

    # 2. Bull flag
    if run_pct > 10.0 and rng5_pct < 5.0:
        tags.append("bull_flag")
        explanations.append(f"Bull flag: +{run_pct:.1f}% prior pole with tight {rng5_pct:.1f}% consolidation")

    # 3. Reclaim 20-day SMA
    if prev < ma20_prev and last >= ma20:
        tags.append("reclaim_ma20")
        explanations.append(f"Reclaimed 20-day SMA ({last:.2f} >= MA20 {ma20:.2f})")

    # 4. Oversold bounce
    if r_prev is not None and r_prev < 30.0 and last > prev:
        tags.append("oversold_bounce")
        explanations.append(f"Oversold bounce from RSI {r_prev:.1f} to {r:.1f} with positive close")

    # 5. Oversold
    if r is not None and r < 30.0:
        tags.append("oversold")
        explanations.append(f"Oversold territory with RSI {r:.1f} (< 30)")

    meta = {
        "rsi": round(r, 1) if r is not None else None,
        "rsi_prev": round(r_prev, 1) if r_prev is not None else None,
        "high20": round(hi20, 2),
        "ma20": round(ma20, 2),
        "run_pct": round(run_pct, 1),
        "range5_pct": round(rng5_pct, 1),
        "explanations": explanations,
    }
    return tags, meta


def run_scanner(storage: SupabaseStorage, force_refresh: bool = False, min_volume: float = 0.0) -> dict[str, Any]:
    """
    Executes Agent 1 (DSE Chart Setup Scanner) across all active stocks in Supabase.
    """
    global _SCAN_CACHE

    now = time.time()
    if not force_refresh and _SCAN_CACHE["data"] and (now - _SCAN_CACHE["timestamp"]) < CACHE_TTL_SECONDS:
        cached_result = _SCAN_CACHE["data"]
        # Apply volume filter if requested
        if min_volume > 0:
            filtered = [c for c in cached_result["candidates"] if (c.get("volume") or 0) >= min_volume]
            return {**cached_result, "candidates": filtered, "count": len(filtered)}
        return cached_result

    logger.info("Running DSE Setup Scanner against database...")
    
    # 1. Fetch live quotes for latest LTP, change, trade_count
    try:
        latest_quotes = storage.latest_quotes(1000)
    except Exception as exc:
        logger.warning("Could not fetch latest quotes: %s", exc)
        latest_quotes = []

    quote_lookup = {q["trade_code"]: q for q in latest_quotes if "trade_code" in q}

    # 2. Fetch daily history for last ~50 trading days
    # Supabase PostgREST default page size is 1000, so we page through the last ~2 months
    rows = []
    page = 0
    page_size = 1000
    while True:
        res = (
            storage.client.table("dse_daily_history")
            .select("trade_code,trade_date,open,high,low,close,volume")
            .gte("trade_date", "2026-07-01")
            .order("trade_date")
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
        )
        if not res.data:
            break
        rows.extend(res.data)
        if len(res.data) < page_size:
            break
        page += 1

    # 3. Group by symbol
    by_symbol: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        sym = r.get("trade_code")
        if sym and r.get("close") is not None:
            by_symbol[sym].append(r)

    candidates = []
    setup_counts: dict[str, int] = defaultdict(int)

    for sym, bars in by_symbol.items():
        if len(bars) < 22:
            continue

        bars.sort(key=lambda b: b["trade_date"])
        tags, meta = analyze_setups(bars)
        if not tags:
            continue

        for t in tags:
            setup_counts[t] += 1

        last_bar = bars[-1]
        prev_bar = bars[-2]
        close_price = float(last_bar["close"])
        prev_close = float(prev_bar["close"])
        change_pct = round(((close_price - prev_close) / prev_close) * 100.0, 2) if prev_close > 0 else 0.0

        q = quote_lookup.get(sym) or {}
        volume = float(q.get("volume") or last_bar.get("volume") or 0)
        value_mn = float(q.get("value_mn") or (volume * close_price / 1_000_000))

        candidates.append({
            "symbol": sym,
            "setups": tags,
            "price": close_price,
            "change_pct": float(q.get("change") or change_pct),
            "volume": volume,
            "value_mn": round(value_mn, 2),
            "date": last_bar["trade_date"],
            "rsi": meta.get("rsi"),
            "high20": meta.get("high20"),
            "ma20": meta.get("ma20"),
            "explanations": meta.get("explanations", []),
        })

    # Sort by value traded descending (most liquid first)
    candidates.sort(key=lambda c: (-(c["price"] * c["volume"]), c["symbol"]))

    result = {
        "status": "success",
        "agent": {
            "id": "trader-scanner",
            "name": "DSE Chart Setup Scanner",
            "version": "1.0.0",
            "status": "running",
            "description": "Scans 400+ DSE stocks for 20-Day Breakouts, Bull Flags, 20-SMA Reclaims, and Oversold Bounces.",
        },
        "scanned_symbols": len(by_symbol),
        "matched_count": len(candidates),
        "setup_breakdown": dict(setup_counts),
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "candidates": candidates,
    }

    _SCAN_CACHE["timestamp"] = now
    _SCAN_CACHE["data"] = result

    if min_volume > 0:
        filtered = [c for c in candidates if (c.get("volume") or 0) >= min_volume]
        return {**result, "candidates": filtered, "count": len(filtered)}

    return result
