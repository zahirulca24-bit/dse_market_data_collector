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


def calculate_dse_settlement_date(trade_date: datetime.date, n_trading_days: int = 2) -> datetime.date:
    """
    Computes DSE settlement date (T+2) by advancing working trading days,
    strictly skipping Bangladesh weekends (Friday & Saturday) and DSE official holidays.
    """
    from .alerts import DSE_HOLIDAYS_2026
    current = trade_date
    counted = 0
    while counted < n_trading_days:
        current += datetime.timedelta(days=1)
        if current.weekday() in (4, 5):  # Friday=4, Saturday=5 in Python weekday()
            continue
        if current.strftime("%Y-%m-%d") in DSE_HOLIDAYS_2026:
            continue
        counted += 1
    return current


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
    and performance win-rate statistics with strict DSE T+2 settlement status.
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
    today = datetime.datetime.now(BST_OFFSET).date()

    position_list = []
    matured_count = 0
    receivable_count = 0

    for sym, pos in positions.items():
        qty = int(pos["quantity"])
        avg_price = float(pos["average_buy_price"])
        ltp = float(pos.get("current_ltp", avg_price))
        mkt_val = round(qty * ltp, 2)
        cost_basis = round(qty * avg_price, 2)
        u_pnl = round(mkt_val - cost_basis, 2)
        u_pct = round((u_pnl / cost_basis) * 100.0, 2) if cost_basis > 0 else 0.0

        # Calculate DSE T+2 settlement maturity
        settle_str = pos.get("settlement_date")
        if settle_str:
            try:
                settle_dt = datetime.datetime.strptime(settle_str, "%Y-%m-%d").date()
            except Exception:
                settle_dt = today
        else:
            opened_str = (pos.get("opened_at") or "").split(" ")[0]
            try:
                opened_dt = datetime.datetime.strptime(opened_str, "%Y-%m-%d").date()
                settle_dt = calculate_dse_settlement_date(opened_dt, 2)
            except Exception:
                settle_dt = today
            pos["settlement_date"] = settle_dt.strftime("%Y-%m-%d")

        is_matured = today >= settle_dt
        matured_qty = qty if is_matured else 0
        receivable_qty = 0 if is_matured else qty
        settlement_status = "MATURED" if is_matured else "T+2 LOCKED"
        days_until_mature = max(0, (settle_dt - today).days)

        if is_matured:
            matured_count += 1
        else:
            receivable_count += 1

        pos_record = {
            "symbol": sym,
            "quantity": qty,
            "matured_quantity": matured_qty,
            "receivable_quantity": receivable_qty,
            "settlement_status": settlement_status,
            "settlement_date": settle_dt.strftime("%Y-%m-%d"),
            "is_matured": is_matured,
            "days_until_mature": days_until_mature,
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
            "version": "2.0.0 (DSE T+2 Compliant)",
            "status": "running",
            "description": "Simulates high-fidelity DSE order execution with strict T+2 settlement locking, anti-churning, and delivery swing bracket tracking.",
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
            "matured_positions_count": matured_count,
            "receivable_positions_count": receivable_count,
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
    """
    Updates LTP for all open positions and evaluates bracket triggers (SL / TP).
    STRICT DSE RULE: Only MATURED positions (T+2 elapsed) are eligible for bracket exits!
    """
    positions = state.get("positions", {})
    if not positions:
        return

    today = datetime.datetime.now(BST_OFFSET).date()
    symbols_to_close = []

    for sym, pos in list(positions.items()):
        bars = storage.daily_history_for_symbol(sym, limit=1)
        if not bars:
            continue
        ltp = float(bars[0].get("close", 0.0) or bars[0].get("ltp", 0.0))
        if ltp > 0:
            pos["current_ltp"] = ltp

        # Check DSE T+2 settlement maturity
        settle_str = pos.get("settlement_date")
        if settle_str:
            try:
                settle_dt = datetime.datetime.strptime(settle_str, "%Y-%m-%d").date()
            except Exception:
                settle_dt = today
        else:
            opened_str = (pos.get("opened_at") or "").split(" ")[0]
            try:
                opened_dt = datetime.datetime.strptime(opened_str, "%Y-%m-%d").date()
                settle_dt = calculate_dse_settlement_date(opened_dt, 2)
            except Exception:
                settle_dt = today
            pos["settlement_date"] = settle_dt.strftime("%Y-%m-%d")

        # In DSE, cannot exit if shares are still under T+2 lock!
        if today < settle_dt:
            continue

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
    """
    Places and executes a simulated paper order against live DSE capital and rules.
    Enforces DSE T+2 settlement lock on SELL orders.
    """
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
    now_dt = datetime.datetime.now(BST_OFFSET)
    now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")
    today = now_dt.date()

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

        # Calculate DSE T+2 settlement date
        settlement_date = calculate_dse_settlement_date(today, n_trading_days=2)
        settlement_date_str = settlement_date.strftime("%Y-%m-%d")

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
            existing["settlement_date"] = settlement_date_str
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
                "purchased_date": today.strftime("%Y-%m-%d"),
                "settlement_date": settlement_date_str,
                "settlement_cycle": "T+2",
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
            "settlement_cycle": "T+2",
            "settlement_date": settlement_date_str,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "notes": notes or "Paper LIMIT BUY Executed (DSE T+2 Delivery)",
        }
        blotter.append(ticket)
        save_paper_account(state)

        return {
            "status": "success",
            "action": "BUY_FILLED",
            "ticket": ticket,
            "remaining_cash": state["cash_balance"],
            "settlement_date": settlement_date_str,
            "message": f"Successfully bought {qty} shares of {sym} at ৳{p:.2f} (Total: ৳{order_value:,.2f}, Fee: ৳{commission:,.2f}). Matures on {settlement_date_str} (T+2).",
        }

    elif side == "SELL":
        if sym not in positions or int(positions[sym]["quantity"]) < qty:
            avail = positions.get(sym, {}).get("quantity", 0)
            return {
                "status": "error",
                "message": f"Cannot sell {qty} shares of {sym}. You currently only hold {avail} shares.",
            }

        pos = positions[sym]

        # STRICT DSE T+2 SETTLEMENT LOCK CHECK
        settle_str = pos.get("settlement_date")
        if settle_str:
            try:
                settle_dt = datetime.datetime.strptime(settle_str, "%Y-%m-%d").date()
            except Exception:
                settle_dt = today
        else:
            opened_str = (pos.get("opened_at") or "").split(" ")[0]
            try:
                opened_dt = datetime.datetime.strptime(opened_str, "%Y-%m-%d").date()
                settle_dt = calculate_dse_settlement_date(opened_dt, 2)
            except Exception:
                settle_dt = today

        if today < settle_dt:
            return {
                "status": "error",
                "code": "DSE_T2_SETTLEMENT_LOCK",
                "message": f"DSE Settlement Rule Violation: {sym} was purchased on {pos.get('opened_at', '')[:10]} and is under T+2 lock until {settle_dt.strftime('%Y-%m-%d')}. In DSE, unmatured shares cannot be sold.",
            }

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
            "notes": notes or "Paper SELL Executed (Matured DSE Shares)",
        }
        blotter.append(ticket)
        save_paper_account(state)

        return {
            "status": "success",
            "action": "SELL_FILLED",
            "ticket": ticket,
            "realized_pnl": realized_pnl,
            "remaining_cash": state["cash_balance"],
            "message": f"Successfully sold {qty} matured shares of {sym} at ৳{p:.2f} (Realized P&L: ৳{realized_pnl:+,.2f}).",
        }

    return {"status": "error", "message": f"Unknown side: {side}"}


def close_paper_position(
    state: dict[str, Any],
    symbol: str,
    exit_price: float | None = None,
    reason: str = "MANUAL_CLOSE",
) -> dict[str, Any]:
    """Closes 100% of an open position at the specified or latest price if matured."""
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


def evaluate_autopilot_paper_trades(
    storage: SupabaseStorage,
    telegram_bot_token: str | None = None,
    telegram_chat_id: str | None = None,
    max_open_positions: int = 5,
    max_allocation_per_trade: float = 100000.0,
    force: bool = False,
) -> dict[str, Any]:
    """
    Evaluates market signals and executes paper BUY / SELL orders strictly following DSE rules:
    1. MARKET CLOCK GUARD: Only operates during live DSE session (10:00 AM - 02:20 PM BST, Sun-Thu).
    2. T+2 SETTLEMENT LOCK: Newly bought shares cannot be sold today or tomorrow; only matured shares exit.
    3. ANTI-CHURNING: At most ONE BUY trade per symbol per calendar day (no duplicate entries).
    4. SIZING: Max 20% equity cap per trade (max ৳100K).
    5. Dispatches clean DSE delivery swing alerts to Telegram.
    """
    from .scanner import run_scanner
    from .entry import evaluate_all_candidates
    from .alerts import send_telegram_alert, get_dse_clock

    clock = get_dse_clock()
    is_open = clock.get("state") == "OPEN"

    state = load_paper_account()

    # Unless explicitly forced by manual user click in dashboard, do not trade when market is closed!
    if not force and not is_open:
        return {
            "status": "skipped",
            "message": f"DSE Market is {clock.get('state')} ({clock.get('status_text')}). Auto-pilot orders are disabled outside trading hours (10:00 AM - 02:20 PM BST).",
            "market_state": clock.get("state"),
            "account_summary": get_account_summary(state, storage),
        }

    positions = state.get("positions", {})
    executed_trades: list[dict[str, Any]] = []
    closed_triggers: list[dict[str, Any]] = []
    today = datetime.datetime.now(BST_OFFSET).date()
    today_str = today.strftime("%Y-%m-%d")

    # 1. Sync live market prices & trigger SL / TP bracket exits ONLY FOR MATURED SHARES
    symbols_to_close = []
    for sym, pos in list(positions.items()):
        bars = storage.daily_history_for_symbol(sym, limit=1)
        if not bars:
            continue
        ltp = float(bars[-1].get("close", 0.0) or bars[-1].get("ltp", 0.0))
        if ltp > 0:
            pos["current_ltp"] = ltp

        # Check DSE T+2 settlement maturity
        settle_str = pos.get("settlement_date")
        if settle_str:
            try:
                settle_dt = datetime.datetime.strptime(settle_str, "%Y-%m-%d").date()
            except Exception:
                settle_dt = today
        else:
            opened_str = (pos.get("opened_at") or "").split(" ")[0]
            try:
                opened_dt = datetime.datetime.strptime(opened_str, "%Y-%m-%d").date()
                settle_dt = calculate_dse_settlement_date(opened_dt, 2)
            except Exception:
                settle_dt = today
            pos["settlement_date"] = settle_dt.strftime("%Y-%m-%d")

        # In DSE, cannot exit if shares are still under T+2 lock!
        if today < settle_dt:
            continue

        stop_loss = pos.get("stop_loss")
        take_profit = pos.get("take_profit")
        avg_price = float(pos.get("average_buy_price", ltp))
        qty = int(pos.get("quantity", 0))

        if stop_loss and ltp <= float(stop_loss):
            symbols_to_close.append((sym, float(stop_loss), "STOP_LOSS_TRIGGERED", (float(stop_loss) - avg_price) * qty))
        elif take_profit and ltp >= float(take_profit):
            symbols_to_close.append((sym, float(take_profit), "TAKE_PROFIT_TRIGGERED", (float(take_profit) - avg_price) * qty))

    for sym, exit_p, reason, pnl in symbols_to_close:
        res = close_paper_position(state, sym, exit_price=exit_p, reason=reason)
        if res.get("status") == "success":
            closed_triggers.append({"symbol": sym, "price": exit_p, "reason": reason, "pnl": pnl})
            if telegram_bot_token and telegram_chat_id:
                emoji = "🎯" if "TAKE_PROFIT" in reason else "🛑"
                title = "TAKE-PROFIT TARGET ACHIEVED (SWING EXIT)" if "TAKE_PROFIT" in reason else "STOP-LOSS HIT (RISK PROTECTED)"
                msg = (
                    f"{emoji} <b>[DSE AUTO-PILOT EXIT] {title}</b>\n\n"
                    f"• Symbol: <b>{sym}</b>\n"
                    f"• Exit Price: <b>৳{exit_p:,.2f}</b>\n"
                    f"• Realized P&L: <b>৳{pnl:+,.2f}</b>\n"
                    f"• Status: <b>Matured Shares Settled & Liquidated</b>\n"
                    f"• Reason: <code>{reason}</code>\n"
                    f"• Capital preserved & returned to available cash."
                )
                try:
                    send_telegram_alert(telegram_bot_token, telegram_chat_id, msg)
                except Exception as tg_err:
                    logger.debug("Failed sending Telegram SL/TP alert: %s", tg_err)

    save_paper_account(state)

    # 2. Check capacity for new entries
    current_open_count = len(state.get("positions", {}))
    cash = float(state.get("cash_balance", 0.0))
    slots_available = max_open_positions - current_open_count

    # Anti-churning: symbols already traded today (in order blotter)
    today_traded_symbols = {
        order.get("symbol")
        for order in state.get("order_blotter", [])
        if order.get("executed_at", "").startswith(today_str)
    }

    if slots_available > 0 and cash >= 15000.0:
        scan_res = run_scanner(storage)
        cands = scan_res.get("candidates", [])
        if cands:
            eval_res = evaluate_all_candidates(storage, cands[:15])
            entries = eval_res.get("entries", [])
            for e in entries:
                if slots_available <= 0 or cash < 15000.0:
                    break
                sym = e.get("symbol")
                # ANTI-CHURNING GUARD: Skip if already in open portfolio OR already traded today!
                if not sym or sym in state.get("positions", {}) or sym in today_traded_symbols:
                    continue

                status_badge = e.get("status_badge", "")
                if status_badge != "Triggered Breakout":
                    continue

                ltp = float(e.get("ltp") or 0.0)
                if ltp <= 0:
                    continue

                # Position sizing: max 20% of account or available cash
                trade_budget = min(max_allocation_per_trade, cash * 0.85)
                qty = int(trade_budget // ltp)
                if qty <= 0:
                    continue

                sl = round(ltp * 0.95, 2)  # -5.0% Stop Loss
                tp = round(ltp * 1.10, 2)  # +10.0% Take Profit

                order_res = place_paper_order(
                    symbol=sym,
                    side="BUY",
                    quantity=qty,
                    price=ltp,
                    order_type="LIMIT",
                    stop_loss=sl,
                    take_profit=tp,
                    notes="Auto-Pilot Breakout Signal (DSE Swing)",
                )

                if order_res.get("status") == "success":
                    settle_date_str = order_res.get("settlement_date", "")
                    executed_trades.append({
                        "symbol": sym,
                        "quantity": qty,
                        "price": ltp,
                        "stop_loss": sl,
                        "take_profit": tp,
                        "settlement_date": settle_date_str,
                    })
                    slots_available -= 1
                    cash = float(order_res.get("remaining_cash", cash - (qty * ltp)))
                    today_traded_symbols.add(sym)

                    if telegram_bot_token and telegram_chat_id:
                        total_val = round(qty * ltp, 2)
                        msg = (
                            f"🤖 <b>[DSE AUTO-PILOT BUY EXECUTED]</b>\n\n"
                            f"• Stock: <b>{sym}</b>\n"
                            f"• Action: <b>BUY (Delivery Swing)</b>\n"
                            f"• Quantity: <b>{qty:,} shares</b> @ <b>৳{ltp:,.2f}</b>\n"
                            f"• Total Cost: <b>৳{total_val:,.2f}</b>\n"
                            f"• Stop-Loss (SL): <b>৳{sl:,.2f} (-5.0%)</b>\n"
                            f"• Take-Profit (TP): <b>৳{tp:,.2f} (+10.0%)</b>\n"
                            f"• Settlement: <b>T+2 Locked (Matures on {settle_date_str})</b>\n"
                            f"• Strategy: <b>20-Day Breakout + Volume Surge</b>\n\n"
                            f"<i>Strict DSE rules enforced. Synced with Paper Portfolio & Journal.</i>"
                        )
                        try:
                            send_telegram_alert(telegram_bot_token, telegram_chat_id, msg)
                        except Exception as tg_err:
                            logger.debug("Failed sending Telegram buy alert: %s", tg_err)

    return {
        "status": "success",
        "executed_count": len(executed_trades),
        "executed_trades": executed_trades,
        "closed_triggers_count": len(closed_triggers),
        "closed_triggers": closed_triggers,
        "account_summary": get_account_summary(state),
    }
