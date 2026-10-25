from __future__ import annotations

import logging
import time
from typing import Any

from ..storage import SupabaseStorage
from .scanner import run_scanner

logger = logging.getLogger("dse_collector.agents.entry")


def round_dse_tick(price: float) -> float:
    """Rounds to DSE standard tick increment (0.10 BDT)."""
    return round(round(price * 10.0) / 10.0, 2)


def evaluate_symbol_entry(
    symbol: str,
    bars: list[dict],
    quote: dict[str, Any] | None = None,
    preferred_setup: str | None = None,
    custom_level: float | None = None,
    min_volume_x: float = 1.0,
) -> dict[str, Any]:
    """
    Evaluates tactical entry timing for a specific symbol based on its recent bars and live quote.
    """
    if len(bars) < 22:
        return {
            "symbol": symbol,
            "status": "INSUFFICIENT_DATA",
            "message": "Needs at least 22 trading sessions to establish trigger levels.",
        }

    bars.sort(key=lambda b: b["trade_date"])
    closes = [float(b["close"]) for b in bars if b.get("close") and float(b["close"]) > 0]
    volumes = [float(b.get("volume") or 0) for b in bars]

    last_close = closes[-1]
    last_volume = volumes[-1]
    last_date = bars[-1]["trade_date"]

    # Calculate indicators
    hi20 = max(closes[-21:-1])  # Prior 20-day high (excluding today)
    lo20 = min(closes[-21:-1])  # Prior 20-day low
    ma20 = sum(closes[-20:]) / 20.0
    avg_vol20 = sum(volumes[-20:]) / 20.0 if len(volumes) >= 20 else 1.0

    # Live quote data overlay if available
    ltp = float(quote.get("ltp") or last_close) if quote else last_close
    live_volume = float(quote.get("volume") or last_volume) if quote else last_volume
    change_pct = float(quote.get("change") or 0.0) if quote else 0.0

    # Determine setup and trigger level
    setup = preferred_setup or "breakout_20d"
    if custom_level is not None and custom_level > 0:
        trigger_level = custom_level
        setup = "custom_level"
    elif setup == "reclaim_ma20":
        trigger_level = ma20
    elif setup == "bull_flag":
        # Flag resistance is highest of the last 5 consolidation closes
        trigger_level = max(closes[-5:])
    else:
        # Default to 20-day high breakout
        trigger_level = hi20

    trigger_level = round_dse_tick(trigger_level)
    vol_ratio = round(live_volume / avg_vol20, 2) if avg_vol20 > 0 else 1.0
    dist_val = ltp - trigger_level
    dist_pct = round((dist_val / trigger_level) * 100.0, 2)

    # Tactical Entry Status Logic
    # 1. TRIGGERED: Closed above trigger level, within safe chase distance (<= 3.5%)
    # 2. EXTENDED: Above trigger level by > 3.5% (High risk of chasing, wait for pullback)
    # 3. PULLBACK_BUY: Within +/- 1.0% of trigger level on lighter volume (Prime limit entry)
    # 4. WAITING: Just below trigger level (-3.0% to 0.0%)
    # 5. WATCHING: Deep below trigger level (< -3.0%)

    if ltp >= trigger_level:
        if dist_pct > 3.5:
            status = "EXTENDED"
            status_badge = "Overextended (+{:.1f}%)".format(dist_pct)
            badge_color = "rose"
            action_code = "WAIT_PULLBACK"
            tactic = f"Price is +{dist_pct:.1f}% above breakout level ৳{trigger_level:.2f}. Do not chase at the high. Wait for a retest towards ৳{trigger_level:.2f}."
        elif abs(dist_pct) <= 1.0:
            status = "PULLBACK_BUY"
            status_badge = "Pullback Retest Zone"
            badge_color = "emerald"
            action_code = "LIMIT_BUY_ACTIVE"
            tactic = f"Price ৳{ltp:.2f} is retesting the breakout support ৳{trigger_level:.2f} ({dist_pct:+.1f}%). High reward-to-risk limit buy zone."
        else:
            status = "TRIGGERED"
            status_badge = "Triggered Breakout"
            badge_color = "cyan"
            action_code = "MARKET_OR_LIMIT"
            tactic = f"Clean breakout confirmed! Price ৳{ltp:.2f} closed above 20D resistance ৳{trigger_level:.2f} (+{dist_pct:.1f}%)."
    else:
        if dist_pct >= -3.0:
            status = "WAITING"
            status_badge = "Coiling (Near Trigger)"
            badge_color = "amber"
            action_code = "ARM_STOP_LIMIT"
            tactic = f"Coiling just below resistance. ৳{abs(dist_val):.2f} ({abs(dist_pct):.1f}%) under trigger ৳{trigger_level:.2f}. Place stop-limit buy at ৳{trigger_level:.2f}."
        else:
            status = "WATCHING"
            status_badge = "Accumulation Stage"
            badge_color = "slate"
            action_code = "WATCHLIST_ONLY"
            tactic = f"Price ৳{ltp:.2f} is {abs(dist_pct):.1f}% below trigger level ৳{trigger_level:.2f}. Keep on watch."

    # Order parameters
    recommended_limit = round_dse_tick(min(ltp, trigger_level * 1.01))
    stop_trigger = round_dse_tick(trigger_level)
    max_chase = round_dse_tick(trigger_level * 1.025)
    pullback_min = round_dse_tick(trigger_level * 0.985)
    pullback_max = round_dse_tick(trigger_level * 1.005)

    volume_confirmed = vol_ratio >= min_volume_x

    return {
        "symbol": symbol,
        "date": last_date,
        "ltp": ltp,
        "change_pct": change_pct,
        "volume": live_volume,
        "avg_vol20": int(avg_vol20),
        "vol_surge_ratio": vol_ratio,
        "volume_confirmed": volume_confirmed,
        "setup": setup,
        "trigger_level": trigger_level,
        "high20": round_dse_tick(hi20),
        "low20": round_dse_tick(lo20),
        "ma20": round_dse_tick(ma20),
        "distance_bdt": round(dist_val, 2),
        "distance_pct": dist_pct,
        "status": status,
        "status_badge": status_badge,
        "badge_color": badge_color,
        "action_code": action_code,
        "tactic": tactic,
        "order_card": {
            "order_type": "STOP_LIMIT" if status == "WAITING" else "LIMIT_BUY",
            "trigger_price": stop_trigger,
            "recommended_limit_price": recommended_limit,
            "max_chase_price": max_chase,
            "pullback_zone": [pullback_min, pullback_max],
            "validity": "DAY_SESSION",
        },
    }


def evaluate_all_candidates(
    storage: SupabaseStorage,
    force_refresh: bool = False,
    min_volume_x: float = 1.0,
) -> dict[str, Any]:
    """
    Evaluates tactical entry setups for all candidates identified by Agent 1 (Scanner).
    """
    # 1. Get candidates from Agent 1
    scan_res = run_scanner(storage, force_refresh=force_refresh)
    candidates = scan_res.get("candidates", [])

    if not candidates:
        return {
            "status": "success",
            "evaluated_count": 0,
            "status_summary": {},
            "entries": [],
        }

    # Focus on top 50 candidates by volume
    symbols = [c["symbol"] for c in candidates[:50]]
    
    # Get quotes lookup
    try:
        latest_quotes = storage.latest_quotes(1000)
        quote_lookup = {q["trade_code"]: q for q in latest_quotes if "trade_code" in q}
    except Exception:
        quote_lookup = {}

    from collections import defaultdict
    bars_by_sym = defaultdict(list)

    # Query history in batches of 15 symbols to stay well within PostgREST limits
    batch_size = 15
    for i in range(0, len(symbols), batch_size):
        chunk = symbols[i : i + batch_size]
        res_bars = (
            storage.client.table("dse_daily_history")
            .select("trade_code,trade_date,open,high,low,close,volume")
            .in_("trade_code", chunk)
            .gte("trade_date", "2026-07-01")
            .limit(1500)
            .execute()
        )
        for r in res_bars.data or []:
            bars_by_sym[r["trade_code"]].append(r)

    evaluated_entries = []
    status_counts = defaultdict(int)

    # Map candidate setup preference
    candidate_setups = {c["symbol"]: c["setups"][0] if c.get("setups") else "breakout_20d" for c in candidates}

    for sym in symbols:
        bars = bars_by_sym.get(sym)
        if not bars:
            continue
        pref_setup = candidate_setups.get(sym, "breakout_20d")
        q = quote_lookup.get(sym)
        entry = evaluate_symbol_entry(sym, bars, quote=q, preferred_setup=pref_setup, min_volume_x=min_volume_x)
        if entry.get("status") not in ("INSUFFICIENT_DATA", None):
            evaluated_entries.append(entry)
            status_counts[entry["status"]] += 1

    # Priority sort
    priority_order = {"TRIGGERED": 0, "PULLBACK_BUY": 1, "WAITING": 2, "EXTENDED": 3, "WATCHING": 4}
    evaluated_entries.sort(key=lambda e: (priority_order.get(e["status"], 5), -e["volume"]))

    return {
        "status": "success",
        "agent": {
            "id": "trader-entry",
            "name": "Tactical Entry Order Agent",
            "version": "1.0.0",
            "status": "running",
            "description": "Calculates precise limit order zones, breakout triggers, and pullback entry levels.",
        },
        "evaluated_count": len(evaluated_entries),
        "status_summary": dict(status_counts),
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "entries": evaluated_entries,
    }
