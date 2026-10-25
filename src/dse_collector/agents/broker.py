from __future__ import annotations

import datetime
import json
import logging
import os
import time
from pathlib import Path
from typing import Any

from ..storage import SupabaseStorage

logger = logging.getLogger("dse_collector.agents.broker")

BST_OFFSET = datetime.timezone(datetime.timedelta(hours=6))
STATE_FILE = Path(__file__).resolve().parent / "paper_account.json"
DEFAULT_STARTING_CASH = 500000.0  # ৳500,000 BDT
COMMISSION_RATE = 0.004           # 0.4% DSE brokerage fee per transaction


def _get_default_state() -> dict[str, Any]:
    return {
        "starting_cash": DEFAULT_STARTING_CASH,
        "cash_balance": DEFAULT_STARTING_CASH,
        "commission_rate": COMMISSION_RATE,
        "positions": {},       # symbol -> position dict
        "pending_orders": [],  # list of pending limit orders
        "order_blotter": [],   # all orders (filled, cancelled, pending)
        "closed_trades": [],   # completed round-trip trades
        "total_commission_paid": 0.0,
        "updated_at": datetime.datetime.now(BST_OFFSET).strftime("%Y-%m-%d %H:%M:%S"),
    }


def load_paper_account() -> dict[str, Any]:
    """Loads current paper trading account state from disk or initializes default."""
    if not STATE_FILE.exists():
        state = _get_default_state()
        save_paper_account(state)
        return state

    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        logger.warning("Failed to load paper_account.json, reinitializing: %s", exc)
        state = _get_default_state()
        save_paper_account(state)
        return state


def save_paper_account(state: dict[str, Any]) -> None:
    """Persists paper account state to disk."""
    state["updated_at"] = datetime.datetime.now(BST_OFFSET).strftime("%Y-%m-%d %H:%M:%S")
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def reset_paper_account(starting_cash: float = DEFAULT_STARTING_CASH) -> dict[str, Any]:
    """Resets paper trading account back to clean starting balance."""
    state = _get_default_state()
    state["starting_cash"] = float(starting_cash)
    state["cash_balance"] = float(starting_cash)
    save_paper_account(state)
    return get_account_summary(state)


def get_account_summary(state: dict[str, Any] | None = None, storage: SupabaseStorage | None = None) -> dict[str, Any]:
    """
    Computes comprehensive portfolio equity, unrealized P&L, realized P&L,
    and performance win-rate statistics.
    """
    if state is None:
        state = load_paper_account()

    # If storage is provided, sync latest prices first
    if storage is not None:
        sync_positions_with_market(state, storage)

    cash = float(state.get("cash_balance", DEFAULT_STARTING_CASH))
    starting = float(state.get("starting_cash", DEFAULT_STARTING_CASH))
    positions = state.get("positions", {})
    closed = state.get("closed_trades", [])

    total_market_value = 0.0
    total_unrealized_pnl = 0.0

    position_list = []
    for sym, pos in positions.items():
        qty = int(pos["quantity"])
        avg_price = float(pos["average_buy_price"])
        ltp = float(pos.get("current_ltp", avg_price))
        mkt_val = round(qty * ltp, 2)
        cost_basis = round(qty * avg_price, 2)
        u_pnl = round(mkt_val - cost_basis, 2)
        u_pct = round((u_pnl / cost_basis) * 100.0, 2) if cost_basis > 0 else 0.0

        pos_record = {
            "symbol": sym,
            "quantity": qty,
            "average_buy_price": avg_price,
            "cost_basis": cost_basis,
            "current_ltp": ltp,
            "market_value": mkt_val,
            "unrealized_pnl": u_pnl,
            "unrealized_pnl_pct": u_pct,
            "stop_loss": pos.get("stop_loss"),
            "take_profit": pos.get("take_profit"),
            "opened_at": pos.get("opened_at"),
            "portfolio_pct": 0.0,  # will be computed after total_equity
        }
        total_market_value += mkt_val
        total_unrealized_pnl += u_pnl
        position_list.append(pos_record)

    total_account_equity = round(cash + total_market_value, 2)

    # Calculate portfolio weights
    for p in position_list:
        if total_account_equity > 0:
            p["portfolio_pct"] = round((p["market_value"] / total_account_equity) * 100.0, 1)

    # Realized stats
    total_realized_pnl = sum(float(c.get("realized_pnl", 0.0)) for c in closed)
    total_commissions = float(state.get("total_commission_paid", 0.0))
    net_pnl = round(total_realized_pnl + total_unrealized_pnl - total_commissions, 2)
    total_return_pct = round(((total_account_equity - starting) / starting) * 100.0, 2) if starting > 0 else 0.0

    wins = sum(1 for c in closed if float(c.get("realized_pnl", 0.0)) > 0)
    total_closed = len(closed)
    win_rate = round((wins / total_closed) * 100.0, 1) if total_closed > 0 else 0.0

    return {
        "status": "success",
        "agent": {
            "id": "trader-broker",
            "name": "DSE Paper Trading Execution Broker",
            "version": "1.0.0",
            "status": "running",
            "description": "Simulates high-fidelity DSE order execution, portfolio management, commission handling, and bracket order tracking.",
        },
        "account": {
            "starting_cash": starting,
            "cash_balance": round(cash, 2),
            "stock_holdings_value": round(total_market_value, 2),
            "total_account_equity": total_account_equity,
            "total_unrealized_pnl": round(total_unrealized_pnl, 2),
            "total_realized_pnl": round(total_realized_pnl, 2),
            "total_commissions_paid": round(total_commissions, 2),
            "net_pnl": net_pnl,
            "total_return_pct": total_return_pct,
            "positions_count": len(position_list),
            "pending_orders_count": len(state.get("pending_orders", [])),
            "closed_trades_count": total_closed,
            "win_rate": win_rate,
        },
        "positions": position_list,
        "pending_orders": state.get("pending_orders", []),
        "recent_trades": closed[-15:][::-1],
        "order_blotter": state.get("order_blotter", [])[-20:][::-1],
        "updated_at": state.get("updated_at"),
    }


def sync_positions_with_market(state: dict[str, Any], storage: SupabaseStorage) -> None:
    """Updates LTP for all open positions and evaluates bracket triggers (SL / TP)."""
    positions = state.get("positions", {})
    if not positions:
        return

    symbols_to_close = []

    for sym, pos in list(positions.items()):
        bars = storage.daily_history_for_symbol(sym, limit=1)
        if not bars:
            continue
        ltp = float(bars[0].get("close", 0.0) or bars[0].get("ltp", 0.0))
        if ltp > 0:
            pos["current_ltp"] = ltp

        # Check bracket auto-triggers
        stop_loss = pos.get("stop_loss")
        take_profit = pos.get("take_profit")

        if stop_loss and ltp <= float(stop_loss):
            symbols_to_close.append((sym, float(stop_loss), "STOP_LOSS_TRIGGERED"))
        elif take_profit and ltp >= float(take_profit):
            symbols_to_close.append((sym, float(take_profit), "TAKE_PROFIT_TRIGGERED"))

    for sym, exit_p, reason in symbols_to_close:
        close_paper_position(state, sym, exit_price=exit_p, reason=reason)

    save_paper_account(state)


def place_paper_order(
    symbol: str,
    side: str,  # "BUY" or "SELL"
    quantity: int,
    price: float,
    order_type: str = "LIMIT",
    stop_loss: float | None = None,
    take_profit: float | None = None,
    notes: str = "",
) -> dict[str, Any]:
    """Places and executes a simulated paper order against live DSE capital and rules."""
    sym = symbol.upper().strip()
    side = side.upper().strip()
    qty = int(quantity)
    p = round(float(price), 2)

    if qty <= 0 or p <= 0:
        return {"status": "error", "message": "Quantity and Price must be positive."}

    state = load_paper_account()
    cash = float(state.get("cash_balance", 0.0))
    positions = state.setdefault("positions", {})
    blotter = state.setdefault("order_blotter", [])
    now_str = datetime.datetime.now(BST_OFFSET).strftime("%Y-%m-%d %H:%M:%S")

    order_value = round(qty * p, 2)
    commission = round(order_value * COMMISSION_RATE, 2)

    if side == "BUY":
        total_required = round(order_value + commission, 2)
        if total_required > cash:
            return {
                "status": "error",
                "message": f"Insufficient funds. Order requires ৳{total_required:,.2f} (including 0.4% fee ৳{commission:,.2f}), but available cash is ৳{cash:,.2f}.",
            }

        # Deduct cash
        state["cash_balance"] = round(cash - total_required, 2)
        state["total_commission_paid"] = round(state.get("total_commission_paid", 0.0) + commission, 2)

        # Update or add position
        if sym in positions:
            existing = positions[sym]
            old_qty = int(existing["quantity"])
            old_price = float(existing["average_buy_price"])
            new_qty = old_qty + qty
            new_avg = round(((old_qty * old_price) + (qty * p)) / new_qty, 2)
            existing["quantity"] = new_qty
            existing["average_buy_price"] = new_avg
            existing["current_ltp"] = p
            if stop_loss: existing["stop_loss"] = float(stop_loss)
            if take_profit: existing["take_profit"] = float(take_profit)
        else:
            positions[sym] = {
                "symbol": sym,
                "quantity": qty,
                "average_buy_price": p,
                "current_ltp": p,
                "stop_loss": float(stop_loss) if stop_loss else None,
                "take_profit": float(take_profit) if take_profit else None,
                "opened_at": now_str,
                "notes": notes,
            }

        ticket = {
            "order_id": f"ORD-{int(time.time()*1000)}",
            "symbol": sym,
            "side": "BUY",
            "order_type": order_type,
            "quantity": qty,
            "price": p,
            "order_value": order_value,
            "commission": commission,
            "status": "FILLED",
            "executed_at": now_str,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "notes": notes or "Paper LIMIT BUY Executed",
        }
        blotter.append(ticket)
        save_paper_account(state)

        return {
            "status": "success",
            "action": "BUY_FILLED",
            "ticket": ticket,
            "remaining_cash": state["cash_balance"],
            "message": f"Successfully bought {qty} shares of {sym} at ৳{p:.2f} (Total: ৳{order_value:,.2f}, Fee: ৳{commission:,.2f}).",
        }

    elif side == "SELL":
        if sym not in positions or int(positions[sym]["quantity"]) < qty:
            avail = positions.get(sym, {}).get("quantity", 0)
            return {
                "status": "error",
                "message": f"Cannot sell {qty} shares of {sym}. You currently only hold {avail} shares.",
            }

        pos = positions[sym]
        avg_buy = float(pos["average_buy_price"])
        net_proceeds = round(order_value - commission, 2)
        realized_pnl = round((p - avg_buy) * qty - commission, 2)
        realized_pnl_pct = round(((p - avg_buy) / avg_buy) * 100.0, 2) if avg_buy > 0 else 0.0

        # Credit cash
        state["cash_balance"] = round(cash + net_proceeds, 2)
        state["total_commission_paid"] = round(state.get("total_commission_paid", 0.0) + commission, 2)

        # Update position
        rem_qty = int(pos["quantity"]) - qty
        if rem_qty <= 0:
            del positions[sym]
        else:
            pos["quantity"] = rem_qty

        # Record closed trade
        closed_trade = {
            "symbol": sym,
            "quantity": qty,
            "buy_price": avg_buy,
            "sell_price": p,
            "order_value": order_value,
            "commission": commission,
            "realized_pnl": realized_pnl,
            "realized_pnl_pct": realized_pnl_pct,
            "closed_at": now_str,
            "reason": notes or "Manual Sell",
        }
        state.setdefault("closed_trades", []).append(closed_trade)

        ticket = {
            "order_id": f"ORD-{int(time.time()*1000)}",
            "symbol": sym,
            "side": "SELL",
            "order_type": order_type,
            "quantity": qty,
            "price": p,
            "order_value": order_value,
            "commission": commission,
            "realized_pnl": realized_pnl,
            "status": "FILLED",
            "executed_at": now_str,
            "notes": notes or "Paper SELL Executed",
        }
        blotter.append(ticket)
        save_paper_account(state)

        return {
            "status": "success",
            "action": "SELL_FILLED",
            "ticket": ticket,
            "realized_pnl": realized_pnl,
            "remaining_cash": state["cash_balance"],
            "message": f"Successfully sold {qty} shares of {sym} at ৳{p:.2f} (Realized P&L: ৳{realized_pnl:+,.2f}).",
        }

    return {"status": "error", "message": f"Unknown side: {side}"}


def close_paper_position(
    state: dict[str, Any],
    symbol: str,
    exit_price: float | None = None,
    reason: str = "MANUAL_CLOSE",
) -> dict[str, Any]:
    """Closes 100% of an open position at the specified or latest price."""
    sym = symbol.upper().strip()
    positions = state.get("positions", {})
    if sym not in positions:
        return {"status": "error", "message": f"No open position found for {sym}."}

    pos = positions[sym]
    qty = int(pos["quantity"])
    price = float(exit_price or pos.get("current_ltp") or pos.get("average_buy_price"))

    return place_paper_order(
        symbol=sym,
        side="SELL",
        quantity=qty,
        price=price,
        order_type="MARKET",
        notes=f"Closed via {reason}",
    )
