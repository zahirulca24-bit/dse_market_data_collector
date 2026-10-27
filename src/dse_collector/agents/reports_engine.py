from __future__ import annotations

import datetime
import json
import logging
from collections import defaultdict
from pathlib import Path
from typing import Any

from .broker import load_paper_account
from .alerts import send_telegram_alert
from ..storage import SupabaseStorage

logger = logging.getLogger("dse_collector.agents.reports_engine")
BST_OFFSET = datetime.timezone(datetime.timedelta(hours=6))
STATE_FILE = Path(__file__).resolve().parent / "reports_state.json"


def _load_reports_state() -> dict[str, Any]:
    if not STATE_FILE.exists():
        return {"last_dispatched_date": None}
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"last_dispatched_date": None}


def _save_reports_state(state: dict[str, Any]) -> None:
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def get_daily_report_cards() -> list[dict[str, Any]]:
    """
    Aggregates all execution records and closed trades into Daily Performance Cards
    sorted with the most recent trading session first.
    """
    account_state = load_paper_account()
    blotter = account_state.get("order_blotter", [])
    closed = account_state.get("closed_trades", [])
    open_positions = account_state.get("positions", {})

    trades_by_date: dict[str, list[dict[str, Any]]] = defaultdict(list)

    # Group blotter tickets by date
    for ticket in blotter:
        exec_at = ticket.get("executed_at") or ticket.get("timestamp") or ""
        date_str = exec_at[:10] if len(exec_at) >= 10 else datetime.datetime.now(BST_OFFSET).strftime("%Y-%m-%d")
        trades_by_date[date_str].append(ticket)

    today_str = datetime.datetime.now(BST_OFFSET).strftime("%Y-%m-%d")
    if today_str not in trades_by_date:
        trades_by_date[today_str] = []

    cards = []
    for date_str, tickets in trades_by_date.items():
        try:
            dt = datetime.datetime.strptime(date_str, "%Y-%m-%d")
            day_name = dt.strftime("%A")
            formatted_date = dt.strftime("%d %b %Y")
        except Exception:
            day_name = "Trading Day"
            formatted_date = date_str

        buys = [t for t in tickets if t.get("side") == "BUY"]
        sells = [t for t in tickets if t.get("side") == "SELL"]
        total_commissions = sum(float(t.get("commission", 0.0)) for t in tickets)
        total_turnover = sum(float(t.get("order_value", 0.0)) for t in tickets)

        # Calculate realized P&L for this specific date
        realized_pnl = sum(float(t.get("realized_pnl", 0.0)) for t in sells)

        # For today, also calculate unrealized P&L from active open positions
        unrealized_pnl = 0.0
        best_performer = None
        highest_pnl = -999999999.0

        if date_str == today_str:
            for sym, pos in open_positions.items():
                qty = int(pos.get("quantity", 0))
                avg_p = float(pos.get("average_buy_price", 0.0))
                ltp = float(pos.get("current_ltp", avg_p))
                pnl = round(qty * (ltp - avg_p), 2)
                pnl_pct = round(((ltp - avg_p) / avg_p) * 100.0, 1) if avg_p > 0 else 0.0
                unrealized_pnl += pnl

                if pnl > highest_pnl:
                    highest_pnl = pnl
                    best_performer = f"{sym} ({'+' if pnl_pct >= 0 else ''}{pnl_pct}%)"

        for s in sells:
            pnl = float(s.get("realized_pnl", 0.0))
            if pnl > highest_pnl:
                highest_pnl = pnl
                best_performer = f"{s.get('symbol')} (+৳{pnl:,.0f})"

        net_pnl = round(realized_pnl + (unrealized_pnl if date_str == today_str else 0.0) - total_commissions, 2)
        traded_symbols = list(dict.fromkeys(t.get("symbol") for t in tickets if t.get("symbol")))

        cards.append({
            "date": date_str,
            "day_name": day_name,
            "formatted_date": formatted_date,
            "is_today": date_str == today_str,
            "total_trades": len(tickets),
            "buys_count": len(buys),
            "sells_count": len(sells),
            "total_turnover": round(total_turnover, 2),
            "total_commissions": round(total_commissions, 2),
            "realized_pnl": round(realized_pnl, 2),
            "unrealized_pnl": round(unrealized_pnl, 2),
            "net_pnl": net_pnl,
            "is_profitable": net_pnl >= 0,
            "best_performer": best_performer or (traded_symbols[0] if traded_symbols else "No active trades"),
            "traded_symbols": traded_symbols,
            "status": "LIVE SESSION" if date_str == today_str else "SESSION CLOSED",
        })

    cards.sort(key=lambda x: x["date"], reverse=True)
    return cards


def get_daily_statement(date_str: str) -> dict[str, Any]:
    """
    Returns itemized trading statement matching LankaBangla & Dhaka Bank
    brokerage format for a specific calendar date.
    """
    account_state = load_paper_account()
    blotter = account_state.get("order_blotter", [])
    open_positions = account_state.get("positions", {})

    matching_tickets = []
    for t in blotter:
        exec_at = t.get("executed_at") or t.get("timestamp") or ""
        if exec_at.startswith(date_str):
            matching_tickets.append(t)

    today_str = datetime.datetime.now(BST_OFFSET).strftime("%Y-%m-%d")
    is_today = (date_str == today_str)

    gross_turnover = sum(float(t.get("order_value", 0.0)) for t in matching_tickets)
    commissions = sum(float(t.get("commission", 0.0)) for t in matching_tickets)
    realized_pnl = sum(float(t.get("realized_pnl", 0.0)) for t in matching_tickets if t.get("side") == "SELL")

    # Add active holding evaluation if reviewing today's statement
    open_pnl = 0.0
    active_holdings_for_day = []
    if is_today:
        for sym, pos in open_positions.items():
            qty = int(pos.get("quantity", 0))
            avg_p = float(pos.get("average_buy_price", 0.0))
            ltp = float(pos.get("current_ltp", avg_p))
            cost = round(qty * avg_p, 2)
            mkt_val = round(qty * ltp, 2)
            pnl = round(mkt_val - cost, 2)
            pnl_pct = round((pnl / cost) * 100.0, 2) if cost > 0 else 0.0
            open_pnl += pnl

            active_holdings_for_day.append({
                "symbol": sym,
                "quantity": qty,
                "average_cost": avg_p,
                "market_rate": ltp,
                "total_cost": cost,
                "market_value": mkt_val,
                "unrealized_pnl": pnl,
                "unrealized_pnl_pct": pnl_pct,
                "stop_loss": pos.get("stop_loss"),
                "take_profit": pos.get("take_profit"),
            })

    net_session_pnl = round(realized_pnl + (open_pnl if is_today else 0.0) - commissions, 2)

    return {
        "status": "success",
        "date": date_str,
        "is_today": is_today,
        "investor_profile": {
            "name": "MD ZAHIRUL ISLAM",
            "investor_code": "10171",
            "bo_id": "1201630076860712",
            "broker": "Dhaka Bank Securities Limited",
            "trec": "TREC DSE-193 & CSE-081",
        },
        "financial_summary": {
            "gross_turnover": round(gross_turnover, 2),
            "brokerage_fees": round(commissions, 2),
            "cdbl_charges": round(len(matching_tickets) * 10.0, 2),  # nominal CDBL charge
            "realized_gain_loss": round(realized_pnl, 2),
            "unrealized_gain_loss": round(open_pnl, 2),
            "net_session_profit": net_session_pnl,
            "starting_cash": float(account_state.get("starting_cash", 500000.0)),
            "cash_balance": float(account_state.get("cash_balance", 500000.0)),
            "total_account_equity": float(account_state.get("account", {}).get("total_account_equity", 500000.0)),
        },
        "executed_orders": matching_tickets,
        "active_holdings": active_holdings_for_day,
        "generated_at": datetime.datetime.now(BST_OFFSET).strftime("%Y-%m-%d %H:%M:%S BST"),
    }


def dispatch_market_close_daily_report(
    storage: SupabaseStorage | None,
    telegram_bot_token: str | None,
    telegram_chat_id: str | None,
    force: bool = False,
) -> dict[str, Any]:
    """
    Generates and dispatches the daily performance digest to Telegram at DSE market close (14:25 BST).
    """
    if not telegram_bot_token or not telegram_chat_id:
        return {"status": "skipped", "message": "Telegram credentials not provided"}

    now = datetime.datetime.now(BST_OFFSET)
    today_str = now.strftime("%Y-%m-%d")

    state = _load_reports_state()
    if not force and state.get("last_dispatched_date") == today_str:
        return {"status": "skipped", "message": f"Daily report already dispatched for {today_str}"}

    stmt = get_daily_statement(today_str)
    fin = stmt.get("financial_summary", {})
    holdings = stmt.get("active_holdings", [])
    orders = stmt.get("executed_orders", [])

    net_pnl = fin.get("net_session_profit", 0.0)
    emoji = "🟢" if net_pnl >= 0 else "🔴"
    date_formatted = now.strftime("%A, %d %B %Y")

    lines = [
        f"📊 <b>[DSE DAILY MARKET CLOSE & TRADE REPORT]</b>",
        f"📅 <b>Date:</b> {date_formatted}",
        f"🕒 <b>Session Status:</b> <code>POST-CLOSE (2:25 PM BST)</code>",
        f"━━━━━━━━━━━━━━━━━━━",
        f"{emoji} <b>Today's Net P&L:</b> <b>৳{net_pnl:+,.2f}</b>",
        f"💰 <b>Total Equity:</b> ৳{fin.get('total_account_equity', 500000.0):,.2f}",
        f"💵 <b>Available Cash:</b> ৳{fin.get('cash_balance', 0.0):,.2f}",
        f"🛒 <b>Trades Executed Today:</b> {len(orders)} order(s)",
        f"🏦 <b>DSE Fees Paid (0.4%):</b> ৳{fin.get('brokerage_fees', 0.0):,.2f}",
        f"━━━━━━━━━━━━━━━━━━━",
    ]

    if holdings:
        lines.append("💼 <b>Active Open Positions:</b>")
        for h in holdings:
            sym = h["symbol"]
            qty = h["quantity"]
            ltp = h["market_rate"]
            pnl = h["unrealized_pnl"]
            pnl_pct = h["unrealized_pnl_pct"]
            icon = "🟢" if pnl >= 0 else "🔴"
            lines.append(f"  {icon} <b>{sym}</b>: {qty:,} sh @ ৳{ltp:,.1f} | P&L: ৳{pnl:+,.0f} ({pnl_pct:+,.1f}%)")
    else:
        lines.append("💼 <i>No active overnight holdings. Full capital preserved in cash.</i>")

    lines.append("━━━━━━━━━━━━━━━━━━━")
    lines.append("🌐 <b>View Full Statement:</b>")
    lines.append("https://dse-market-data-collector-g2f7.onrender.com/reports")

    message_text = "\n".join(lines)

    try:
        res = send_telegram_alert(telegram_bot_token, telegram_chat_id, message_text)
        state["last_dispatched_date"] = today_str
        _save_reports_state(state)
        return {"status": "success", "telegram_result": res}
    except Exception as exc:
        logger.exception("Failed dispatching daily report to Telegram: %s", exc)
        return {"status": "error", "message": str(exc)}
