from __future__ import annotations

import logging
import time
from typing import Any

from ..storage import SupabaseStorage
from .entry import evaluate_all_candidates

logger = logging.getLogger("dse_collector.agents.exit")


def round_down_dse_tick(val: float) -> float:
    """Rounds down to nearest 0.10 BDT tick."""
    import math
    return round(math.floor(val * 10.0) / 10.0, 2)


def round_up_dse_tick(val: float) -> float:
    """Rounds up to nearest 0.10 BDT tick."""
    import math
    return round(math.ceil(val * 10.0) / 10.0, 2)


def calculate_atr14(bars: list[dict]) -> float:
    """Calculates Wilder's 14-period Average True Range (ATR)."""
    if len(bars) < 2:
        return 1.0

    trs = []
    for i in range(1, len(bars)):
        high = float(bars[i].get("high") or bars[i].get("close") or 0)
        low = float(bars[i].get("low") or bars[i].get("close") or 0)
        prev_close = float(bars[i - 1].get("close") or 0)
        tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
        trs.append(tr)

    if not trs:
        return 1.0

    period = min(14, len(trs))
    atr = sum(trs[:period]) / period
    for tr in trs[period:]:
        atr = (atr * (period - 1) + tr) / period

    return max(0.10, atr)


def compute_exit_plan(
    symbol: str,
    entry_price: float,
    bars: list[dict],
    stop_rule: str = "atr_1_5",
    custom_stop: float | None = None,
    custom_target: float | None = None,
) -> dict[str, Any]:
    """
    Computes professional stop-loss, R-multiple profit targets, and dynamic trailing rules.
    """
    if entry_price <= 0:
        return {"error": "Entry price must be greater than 0"}

    e = round(entry_price, 2)
    atr = calculate_atr14(bars)

    # Determine stop loss
    detail = ""
    if stop_rule == "custom" and custom_stop is not None and custom_stop > 0:
        raw_stop = custom_stop
        rule_label = "Custom Fixed Stop"
        detail = f"Manual stop set at ৳{custom_stop:.2f}"
    elif stop_rule == "atr_2_0":
        raw_stop = e - 2.0 * atr
        rule_label = "2.0x ATR Volatility Stop"
        detail = f"৳{e:.2f} - (2.0 x ATR ৳{atr:.2f}) = ৳{raw_stop:.2f}"
    elif stop_rule == "pct_3":
        raw_stop = e * 0.97
        rule_label = "3.0% Fixed Stop"
        detail = f"৳{e:.2f} x (1 - 3%) = ৳{raw_stop:.2f}"
    elif stop_rule == "pct_5":
        raw_stop = e * 0.95
        rule_label = "5.0% Fixed Stop"
        detail = f"৳{e:.2f} x (1 - 5%) = ৳{raw_stop:.2f}"
    elif stop_rule == "pivot_support":
        # Lowest close of prior 5 bars
        closes = [float(b["close"]) for b in bars[-6:-1] if b.get("close")]
        pivot_low = min(closes) if closes else e * 0.97
        raw_stop = pivot_low * 0.99
        rule_label = "Pivot Support Stop"
        detail = f"1% below 5-session swing low (৳{pivot_low:.2f}) = ৳{raw_stop:.2f}"
    else:  # default to atr_1_5
        raw_stop = e - 1.5 * atr
        rule_label = "1.5x ATR Volatility Stop"
        detail = f"৳{e:.2f} - (1.5 x ATR ৳{atr:.2f}) = ৳{raw_stop:.2f}"

    # Round stop DOWN to DSE tick
    stop_loss = round_down_dse_tick(raw_stop)

    # Guard: Stop must be under entry
    if stop_loss >= e:
        stop_loss = round_down_dse_tick(e * 0.97)
        rule_label = "3.0% Fallback Stop"
        detail = "Stop adjusted to ensure strictly below entry."

    risk_per_share = round(e - stop_loss, 2)
    risk_pct = round((risk_per_share / e) * 100.0, 2)

    # Target calculations (1.5R, 2.0R, 3.0R)
    target_1r = round_up_dse_tick(e + 1.0 * risk_per_share)
    target_1_5r = round_up_dse_tick(e + 1.5 * risk_per_share)
    target_2r = round_up_dse_tick(e + 2.0 * risk_per_share)
    target_3r = round_up_dse_tick(e + 3.0 * risk_per_share)

    # DSE standard 10% circuit limits estimate
    circuit_high = round_up_dse_tick(e * 1.10)
    circuit_low = round_down_dse_tick(e * 0.90)

    return {
        "symbol": symbol,
        "entry_price": e,
        "atr14": round(atr, 2),
        "stop_loss": stop_loss,
        "stop_rule": stop_rule,
        "stop_rule_label": rule_label,
        "stop_detail": detail,
        "risk_per_share": risk_per_share,
        "risk_pct": risk_pct,
        "reward_risk_ratio": "1 : 2.0",
        "targets": {
            "tranche_1": {
                "name": "Target 1 (1.5R - De-Risk)",
                "price": target_1_5r,
                "r_multiple": 1.5,
                "profit_bdt": round(target_1_5r - e, 2),
                "profit_pct": round(((target_1_5r - e) / e) * 100.0, 2),
                "action": "Sell 50% shares & move Stop to Breakeven (৳{:.2f})".format(e),
            },
            "tranche_2": {
                "name": "Target 2 (2.0R - Primary TP)",
                "price": target_2r,
                "r_multiple": 2.0,
                "profit_bdt": round(target_2r - e, 2),
                "profit_pct": round(((target_2r - e) / e) * 100.0, 2),
                "action": "Sell 30% shares & lock in Target 1 as trailing stop",
            },
            "tranche_3": {
                "name": "Target 3 (3.0R - Runner)",
                "price": target_3r,
                "r_multiple": 3.0,
                "profit_bdt": round(target_3r - e, 2),
                "profit_pct": round(((target_3r - e) / e) * 100.0, 2),
                "action": "Trail remaining 20% shares with 1.5x ATR trailing cushion",
            },
        },
        "trailing_rules": [
            f"1. Initial Stop: ৳{stop_loss:.2f} (Risk: ৳{risk_per_share:.2f} / -{risk_pct:.1f}%)",
            f"2. Breakeven Trigger: When price hits Target 1 (৳{target_1_5r:.2f}), move stop loss immediately to entry (৳{e:.2f}).",
            f"3. Runner Lock: When price hits Target 2 (৳{target_2r:.2f}), trail stop to Target 1 (৳{target_1_5r:.2f}) to guarantee profit.",
            "4. Circuit Rule: If stock hits upper circuit (+10%), hold overnight with stop placed at prior close.",
        ],
        "circuit_limits": {
            "upper_10pct": circuit_high,
            "lower_10pct": circuit_low,
        },
    }


def evaluate_exit_watchlist(
    storage: SupabaseStorage,
    force_refresh: bool = False,
    stop_rule: str = "atr_1_5",
) -> dict[str, Any]:
    """
    Computes dynamic exit and target plans for all active candidate stocks from Agent 2.
    """
    entry_data = evaluate_all_candidates(storage, force_refresh=force_refresh)
    entries = entry_data.get("entries", [])

    if not entries:
        return {
            "status": "success",
            "evaluated_count": 0,
            "plans": [],
        }

    # Focus on top 30 candidates
    symbols = [e["symbol"] for e in entries[:30]]
    
    # Query bars in batches
    from collections import defaultdict
    bars_by_sym = defaultdict(list)
    batch_size = 15
    for i in range(0, len(symbols), batch_size):
        chunk = symbols[i : i + batch_size]
        res = (
            storage.client.table("dse_daily_history")
            .select("trade_code,trade_date,open,high,low,close,volume")
            .in_("trade_code", chunk)
            .gte("trade_date", "2026-07-01")
            .limit(1500)
            .execute()
        )
        for r in res.data or []:
            bars_by_sym[r["trade_code"]].append(r)

    plans = []
    for e in entries[:30]:
        sym = e["symbol"]
        bars = bars_by_sym.get(sym)
        if not bars:
            continue
        entry_price = float(e.get("order_card", {}).get("recommended_limit_price") or e["ltp"])
        plan = compute_exit_plan(sym, entry_price, bars, stop_rule=stop_rule)
        plan["status"] = e["status"]
        plan["status_badge"] = e["status_badge"]
        plan["setup"] = e["setup"]
        plans.append(plan)

    return {
        "status": "success",
        "agent": {
            "id": "trader-exit",
            "name": "Dynamic Exit & Target Agent",
            "version": "1.0.0",
            "status": "running",
            "description": "Computes dynamic ATR stoplosses, 1:2 and 1:3 profit targets, and scale-out tranches.",
        },
        "stop_rule_applied": stop_rule,
        "evaluated_count": len(plans),
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "plans": plans,
    }
