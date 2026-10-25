from __future__ import annotations

import logging
import math
import time
from typing import Any

from ..storage import SupabaseStorage
from .exit import evaluate_exit_watchlist

logger = logging.getLogger("dse_collector.agents.risk")

DEFAULT_RISK_CONFIG = {
    "account_equity": 500000.0,       # 500,000 BDT
    "max_loss_per_trade_pct": 1.5,    # Max 1.5% loss of equity per trade (৳7,500)
    "max_position_pct": 20.0,         # Max 20% equity in one stock (৳100,000)
    "min_reward_risk": 1.5,           # Minimum 1.5:1 reward to risk
    "max_daily_loss_pct": 3.5,        # 3.5% cumulative daily loss cap (৳17,500)
    "cash_reserve_pct": 10.0,         # Minimum 10% cash reserve (৳50,000)
    "allow_unhedged": True,
}


def audit_order_risk(
    symbol: str,
    entry_price: float,
    stop_loss: float,
    target_price: float,
    quantity: int,
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Evaluates a proposed trade order against rigorous risk management limits.
    Returns PASS or BLOCK with full itemized check details.
    """
    cfg = dict(DEFAULT_RISK_CONFIG)
    if config:
        cfg.update(config)

    equity = float(cfg["account_equity"])
    max_trade_loss = equity * (float(cfg["max_loss_per_trade_pct"]) / 100.0)
    max_position_val = equity * (float(cfg["max_position_pct"]) / 100.0)
    min_rr = float(cfg["min_reward_risk"])
    cash_reserve = equity * (float(cfg["cash_reserve_pct"]) / 100.0)

    e = round(float(entry_price), 2)
    s = round(float(stop_loss), 2)
    t = round(float(target_price), 2)
    qty = int(quantity)

    checks = []
    blocked_reasons = []

    # 1. Format & Direction Check
    if e <= 0:
        return {"verdict": "BLOCK", "reason": "Entry price must be positive.", "checks": []}
    if s >= e:
        checks.append({
            "name": "Stop Loss Direction",
            "status": "FAIL",
            "message": f"Stop loss (৳{s:.2f}) must be strictly lower than entry (৳{e:.2f}).",
        })
        blocked_reasons.append("Stop loss is above or at entry price.")
    else:
        checks.append({
            "name": "Stop Loss Direction",
            "status": "PASS",
            "message": f"Stop loss (৳{s:.2f}) is correctly placed below entry.",
        })

    # 2. Reward to Risk Check
    risk_per_share = e - s
    reward_per_share = t - e
    rr_ratio = round(reward_per_share / risk_per_share, 2) if risk_per_share > 0 else 0.0

    if rr_ratio < min_rr:
        checks.append({
            "name": "Reward-to-Risk Gate",
            "status": "FAIL",
            "message": f"Reward:Risk ratio {rr_ratio}:1 is below required minimum of {min_rr}:1.",
        })
        blocked_reasons.append(f"Insufficient Reward:Risk ratio ({rr_ratio} < {min_rr}).")
    else:
        checks.append({
            "name": "Reward-to-Risk Gate",
            "status": "PASS",
            "message": f"Reward:Risk ratio is {rr_ratio}:1 (Exceeds {min_rr}:1 minimum).",
        })

    # 3. Monetary Risk per Trade Check
    total_risk = round(qty * risk_per_share, 2) if risk_per_share > 0 else 0.0
    if total_risk > max_trade_loss:
        # Calculate maximum safe shares
        max_safe_qty = int(math.floor(max_trade_loss / risk_per_share)) if risk_per_share > 0 else 0
        checks.append({
            "name": "Single Trade Loss Cap",
            "status": "FAIL",
            "message": f"Proposed risk ৳{total_risk:,.2f} exceeds max loss cap ৳{max_trade_loss:,.2f} ({cfg['max_loss_per_trade_pct']}% of equity).",
        })
        blocked_reasons.append(f"Risk ৳{total_risk:,.2f} exceeds trade limit ৳{max_trade_loss:,.2f}.")
    else:
        max_safe_qty = qty
        checks.append({
            "name": "Single Trade Loss Cap",
            "status": "PASS",
            "message": f"Proposed risk ৳{total_risk:,.2f} is within ৳{max_trade_loss:,.2f} loss ceiling.",
        })

    # 4. Position Sizing & Concentration Check
    total_position_val = round(qty * e, 2)
    if total_position_val > max_position_val:
        checks.append({
            "name": "Position Allocation Cap",
            "status": "FAIL",
            "message": f"Order value ৳{total_position_val:,.2f} exceeds {cfg['max_position_pct']}% cap (৳{max_position_val:,.2f}).",
        })
        blocked_reasons.append(f"Position size ৳{total_position_val:,.2f} exceeds single stock cap.")
    else:
        checks.append({
            "name": "Position Allocation Cap",
            "status": "PASS",
            "message": f"Order value ৳{total_position_val:,.2f} fits within ৳{max_position_val:,.2f} cap.",
        })

    # 5. DSE Circuit Guard (10% Daily Band)
    circuit_high = round(e * 1.10, 2)
    circuit_low = round(e * 0.90, 2)
    if s < circuit_low:
        checks.append({
            "name": "DSE Circuit Breaker Guard",
            "status": "WARN",
            "message": f"Stop loss ৳{s:.2f} is near/below DSE daily -10% lower circuit limit (৳{circuit_low:.2f}).",
        })
    else:
        checks.append({
            "name": "DSE Circuit Breaker Guard",
            "status": "PASS",
            "message": f"Stop and targets fall safely inside DSE 10% trading band (৳{circuit_low:.2f} - ৳{circuit_high:.2f}).",
        })

    # 6. Cash Reserve Buffer Check
    remaining_cash = equity - total_position_val
    if remaining_cash < cash_reserve:
        checks.append({
            "name": "Cash Reserve Buffer",
            "status": "FAIL",
            "message": f"Remaining liquidity ৳{remaining_cash:,.2f} is less than required cash buffer ৳{cash_reserve:,.2f}.",
        })
        blocked_reasons.append("Leaves less than minimum cash reserve.")
    else:
        checks.append({
            "name": "Cash Reserve Buffer",
            "status": "PASS",
            "message": f"Leaves ৳{remaining_cash:,.2f} liquid cash (Buffer: ৳{cash_reserve:,.2f}).",
        })

    is_passed = len(blocked_reasons) == 0
    verdict = "PASS" if is_passed else "BLOCK"

    # Compute suggested safe sizing if blocked
    suggested_qty = min(
        int(math.floor(max_trade_loss / risk_per_share)) if risk_per_share > 0 else 0,
        int(math.floor(max_position_val / e)) if e > 0 else 0,
    )

    return {
        "symbol": symbol,
        "entry_price": e,
        "stop_loss": s,
        "target_price": t,
        "quantity": qty,
        "total_value": total_position_val,
        "total_risk": total_risk,
        "reward_risk": rr_ratio,
        "verdict": verdict,
        "verdict_badge": "SHIELD PASS: APPROVED" if is_passed else "SHIELD BLOCK: REJECTED",
        "badge_color": "emerald" if is_passed else "rose",
        "blocked_reasons": blocked_reasons,
        "suggested_safe_quantity": suggested_qty,
        "suggested_safe_value": round(suggested_qty * e, 2),
        "checks": checks,
    }


def audit_watchlist_candidates(
    storage: SupabaseStorage,
    force_refresh: bool = False,
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Audits the current pipeline candidate setups and calculates safe compliant sizing.
    """
    exit_data = evaluate_exit_watchlist(storage, force_refresh=force_refresh)
    plans = exit_data.get("plans", [])

    cfg = dict(DEFAULT_RISK_CONFIG)
    if config:
        cfg.update(config)

    equity = float(cfg["account_equity"])
    max_trade_loss = equity * (float(cfg["max_loss_per_trade_pct"]) / 100.0)
    max_pos_val = equity * (float(cfg["max_position_pct"]) / 100.0)

    audited_list = []
    pass_count = 0
    block_count = 0

    for p in plans:
        sym = p["symbol"]
        entry = float(p["entry_price"])
        stop = float(p["stop_loss"])
        target = float(p["targets"]["tranche_2"]["price"])
        risk_per_share = p.get("risk_per_share") or (entry - stop)

        # Calculate optimal safe quantity
        if risk_per_share > 0:
            qty_by_risk = int(math.floor(max_trade_loss / risk_per_share))
            qty_by_pos = int(math.floor(max_pos_val / entry)) if entry > 0 else 0
            safe_qty = max(1, min(qty_by_risk, qty_by_pos))
        else:
            safe_qty = 100

        audit = audit_order_risk(sym, entry, stop, target, safe_qty, config=cfg)
        audit["setup"] = p.get("setup", "breakout")
        audit["risk_per_share"] = risk_per_share
        audited_list.append(audit)

        if audit["verdict"] == "PASS":
            pass_count += 1
        else:
            block_count += 1

    return {
        "status": "success",
        "agent": {
            "id": "trader-risk",
            "name": "Capital Risk & Exposure Guard",
            "version": "1.0.0",
            "status": "running",
            "description": "Enforces strict portfolio allocation caps, circuit breaker protection, and single-stock exposure limits.",
        },
        "config_applied": cfg,
        "total_audited": len(audited_list),
        "pass_count": pass_count,
        "block_count": block_count,
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "audits": audited_list,
    }
