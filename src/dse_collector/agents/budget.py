from __future__ import annotations

import logging
import math
import time
from typing import Any

from ..storage import SupabaseStorage
from .exit import evaluate_exit_watchlist

logger = logging.getLogger("dse_collector.agents.budget")

DEFAULT_BUDGET_CONFIG = {
    "budget": 500000.0,            # 500,000 BDT
    "cash_buffer_pct": 10.0,       # 10% kept in cash
    "max_loss_per_trade_usd": 7500.0,  # ৳7,500 max loss per trade (1.5%)
    "max_position_pct": 20.0,      # 20% max in one stock (৳100,000)
    "min_order_usd": 500.0,        # Minimum ৳500 order
    "max_order_usd": 150000.0,     # Maximum ৳150,000 order
}


def size_position(
    symbol: str,
    entry_price: float,
    stop_loss: float,
    target_price: float,
    budget: float = 500000.0,
    cash_buffer_pct: float = 10.0,
    max_loss_per_trade: float = 7500.0,
    max_position_pct: float = 20.0,
    win_rate: float = 50.0,
) -> dict[str, Any]:
    """
    Sizes whole shares to fit inside 4 mathematical constraints:
      1. Max Loss Per Trade Limit
      2. Single Position Cap Limit
      3. Usable Cash Buffer Limit
      4. Half-Kelly Growth Criterion
    """
    e = round(float(entry_price), 2)
    s = round(float(stop_loss), 2)
    t = round(float(target_price), 2)

    if e <= 0 or s >= e:
        return {
            "symbol": symbol,
            "status": "INVALID_PRICES",
            "message": "Entry must be positive and stop loss must be strictly below entry.",
            "shares": 0,
        }

    risk_per_share = round(e - s, 2)
    reward_per_share = round(t - e, 2)
    rr_ratio = round(reward_per_share / risk_per_share, 2) if risk_per_share > 0 else 0.0

    # 1. Sized by Risk Cap
    q_risk = int(math.floor(max_loss_per_trade / risk_per_share)) if risk_per_share > 0 else 0

    # 2. Sized by Position Cap
    max_pos_val = budget * (max_position_pct / 100.0)
    q_pos = int(math.floor(max_pos_val / e)) if e > 0 else 0

    # 3. Sized by Usable Cash
    usable_cash = budget * (1.0 - (cash_buffer_pct / 100.0))
    q_cash = int(math.floor(usable_cash / e)) if e > 0 else 0

    # 4. Half-Kelly Sizing
    # f* = (p*b - q) / b
    b = max(1.0, rr_ratio)
    p = min(0.9, max(0.2, win_rate / 100.0))
    q = 1.0 - p
    kelly_f = max(0.02, min(0.25, (p * b - q) / b)) * 0.5  # Half-Kelly for safety
    q_kelly = int(math.floor((budget * kelly_f) / e)) if e > 0 else q_risk

    # Final Whole Shares: Smallest of the hard limits
    limits = {
        "max_loss": q_risk,
        "position_cap": q_pos,
        "usable_cash": q_cash,
    }

    # Find the bottleneck constraint
    deciding_limit = min(limits, key=limits.get)
    final_shares = max(0, limits[deciding_limit])

    if deciding_limit == "max_loss":
        decision_narrative = f"Sized by Maximum Risk Limit (৳{max_loss_per_trade:,.2f}): {q_risk:,} shares"
    elif deciding_limit == "position_cap":
        decision_narrative = f"Sized by Position Cap ({max_position_pct}% of budget / ৳{max_pos_val:,.2f}): {q_pos:,} shares"
    else:
        decision_narrative = f"Sized by Usable Cash (after {cash_buffer_pct}% buffer / ৳{usable_cash:,.2f}): {q_cash:,} shares"

    total_investment = round(final_shares * e, 2)
    actual_max_loss = round(final_shares * risk_per_share, 2)
    expected_gain_target = round(final_shares * reward_per_share, 2)

    # Multi-tranche scale-out values
    shares_t1 = int(final_shares * 0.5)
    shares_t2 = int(final_shares * 0.3)
    shares_t3 = final_shares - shares_t1 - shares_t2

    return {
        "symbol": symbol,
        "entry_price": e,
        "stop_loss": s,
        "target_price": t,
        "risk_per_share": risk_per_share,
        "reward_risk": rr_ratio,
        "budget": budget,
        "final_shares": final_shares,
        "total_investment": total_investment,
        "portfolio_pct": round((total_investment / budget) * 100.0, 1) if budget > 0 else 0.0,
        "actual_max_loss": actual_max_loss,
        "expected_gain": expected_gain_target,
        "deciding_limit": deciding_limit,
        "decision_narrative": decision_narrative,
        "constraint_breakdown": {
            "by_risk_limit": q_risk,
            "by_position_cap": q_pos,
            "by_cash_buffer": q_cash,
            "by_half_kelly": q_kelly,
        },
        "bracket_order": {
            "symbol": symbol,
            "order_type": "LIMIT_BUY",
            "quantity": final_shares,
            "limit_price": e,
            "stop_loss_price": s,
            "take_profit_price": t,
            "scale_out": {
                "tranche_1_shares": shares_t1,
                "tranche_2_shares": shares_t2,
                "tranche_3_shares": shares_t3,
            },
            "validity": "DAY",
        },
    }


def evaluate_budget_watchlist(
    storage: SupabaseStorage,
    force_refresh: bool = False,
    budget: float = 500000.0,
    cash_buffer_pct: float = 10.0,
    max_loss_per_trade: float = 7500.0,
    max_position_pct: float = 20.0,
) -> dict[str, Any]:
    """
    Sizes every candidate setup from the pipeline into an exact executable bracket order.
    """
    exit_data = evaluate_exit_watchlist(storage, force_refresh=force_refresh)
    plans = exit_data.get("plans", [])

    sized_orders = []
    total_allocated = 0.0

    for p in plans:
        sym = p["symbol"]
        entry = float(p["entry_price"])
        stop = float(p["stop_loss"])
        target = float(p["targets"]["tranche_2"]["price"])

        sized = size_position(
            symbol=sym,
            entry_price=entry,
            stop_loss=stop,
            target_price=target,
            budget=budget,
            cash_buffer_pct=cash_buffer_pct,
            max_loss_per_trade=max_loss_per_trade,
            max_position_pct=max_position_pct,
        )
        sized["setup"] = p.get("setup", "breakout")
        sized_orders.append(sized)

    return {
        "status": "success",
        "agent": {
            "id": "trader-budget",
            "name": "Position Sizing & Budget Agent",
            "version": "1.0.0",
            "status": "running",
            "description": "Calculates exact share quantities to purchase according to account equity, 4-way constraints, and Kelly criterion.",
        },
        "budget_config": {
            "budget": budget,
            "cash_buffer_pct": cash_buffer_pct,
            "max_loss_per_trade": max_loss_per_trade,
            "max_position_pct": max_position_pct,
        },
        "total_sized": len(sized_orders),
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "orders": sized_orders,
    }
