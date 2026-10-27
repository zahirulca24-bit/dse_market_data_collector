from __future__ import annotations

import datetime
import json
import logging
from pathlib import Path
from typing import Any

from ..storage import SupabaseStorage

logger = logging.getLogger("dse_collector.agents.real_portfolio")

BST_OFFSET = datetime.timezone(datetime.timedelta(hours=6))
STATE_FILE = Path(__file__).resolve().parent / "real_portfolio.json"


def _get_default_real_portfolio() -> dict[str, Any]:
    return {
        "profile": {
            "name": "MD ZAHIRUL ISLAM",
            "investor_code": "10171",
            "bo_id": "1201630076860712",
            "broker": "Dhaka Bank Securities Limited",
            "trec_no": "TREC DSE-193 & CSE-081",
            "ac_type": "Non Margin",
            "mobile": "01955956476",
            "email": "zahirul.artisan@gmail.com",
            "address": "164, SHADHINOTA SHARONI, UTTAR BADDA, DHAKA",
        },
        "balance": {
            "mature_balance": 0.0,
            "ledger_balance": 0.0,
            "receivable_sales": 0.0,
            "cheque_in_transit": 0.0,
            "accrued_fees": 0.0,
            "purchase_power": 0.0,
            "total_deposit": 0.0,
            "total_withdrawal": 0.0,
        },
        "holdings": {},  # symbol -> holding details
        "updated_at": datetime.datetime.now(BST_OFFSET).strftime("%Y-%m-%d %H:%M:%S"),
    }


def load_real_portfolio() -> dict[str, Any]:
    """Loads real portfolio from persistent JSON file or initializes default."""
    if not STATE_FILE.exists():
        state = _get_default_real_portfolio()
        save_real_portfolio(state)
        return state

    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        logger.warning("Failed loading real_portfolio.json, reinitializing: %s", exc)
        state = _get_default_real_portfolio()
        save_real_portfolio(state)
        return state


def save_real_portfolio(state: dict[str, Any]) -> None:
    """Persists real portfolio state to disk."""
    state["updated_at"] = datetime.datetime.now(BST_OFFSET).strftime("%Y-%m-%d %H:%M:%S")
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def update_real_balance(
    mature_balance: float | None = None,
    ledger_balance: float | None = None,
    purchase_power: float | None = None,
    receivable_sales: float | None = None,
) -> dict[str, Any]:
    """Updates cash/balance attributes of the real broker account."""
    state = load_real_portfolio()
    bal = state.setdefault("balance", {})
    if mature_balance is not None:
        bal["mature_balance"] = round(float(mature_balance), 2)
    if ledger_balance is not None:
        bal["ledger_balance"] = round(float(ledger_balance), 2)
    if purchase_power is not None:
        bal["purchase_power"] = round(float(purchase_power), 2)
    if receivable_sales is not None:
        bal["receivable_sales"] = round(float(receivable_sales), 2)
    save_real_portfolio(state)
    return state


def add_or_update_real_position(
    symbol: str,
    quantity: int,
    avg_cost: float,
    saleable_quantity: int | None = None,
    group: str = "A",
) -> dict[str, Any]:
    """Adds or updates a real stock position in the portfolio."""
    sym = symbol.upper().strip()
    qty = int(quantity)
    cost = round(float(avg_cost), 2)
    saleable = int(saleable_quantity) if saleable_quantity is not None else qty

    if qty <= 0 or cost <= 0:
        return {"status": "error", "message": "Quantity and Cost must be greater than 0"}

    state = load_real_portfolio()
    holdings = state.setdefault("holdings", {})

    total_cost = round(qty * cost, 2)
    holdings[sym] = {
        "symbol": sym,
        "group": group.upper().strip() or "A",
        "total_quantity": qty,
        "saleable_quantity": saleable,
        "avg_cost": cost,
        "total_cost": total_cost,
        "updated_at": datetime.datetime.now(BST_OFFSET).strftime("%Y-%m-%d %H:%M:%S"),
    }

    save_real_portfolio(state)
    return {"status": "success", "holding": holdings[sym]}


def delete_real_position(symbol: str) -> dict[str, Any]:
    """Removes a real stock position from the portfolio."""
    sym = symbol.upper().strip()
    state = load_real_portfolio()
    holdings = state.get("holdings", {})
    if sym in holdings:
        del holdings[sym]
        save_real_portfolio(state)
        return {"status": "success", "message": f"Position {sym} removed"}
    return {"status": "error", "message": f"Symbol {sym} not found in holdings"}


def get_real_portfolio_summary(storage: SupabaseStorage | None = None) -> dict[str, Any]:
    """
    Computes total portfolio valuation, live market values, and unrealized P&L
    synchronized with real-time DSE market quotes.
    """
    state = load_real_portfolio()
    holdings_dict = state.get("holdings", {})
    bal = state.get("balance", {})

    # Fetch live quotes if storage provided
    live_quotes_map: dict[str, float] = {}
    if storage is not None:
        try:
            latest_quotes = storage.latest_quotes()
            for q in latest_quotes:
                trade_code = q.get("trade_code")
                ltp = q.get("ltp")
                if trade_code and ltp:
                    live_quotes_map[trade_code.upper()] = float(ltp)
        except Exception as exc:
            logger.debug("Failed fetching live quotes for real portfolio sync: %s", exc)

    holdings_list = []
    total_cost_basis = 0.0
    total_market_value = 0.0
    total_unrealized_pnl = 0.0

    for sym, h in holdings_dict.items():
        qty = int(h.get("total_quantity", 0))
        saleable = int(h.get("saleable_quantity", qty))
        cost = float(h.get("avg_cost", 0.0))
        tot_cost = round(qty * cost, 2)

        # Get live market rate
        ltp = live_quotes_map.get(sym, float(h.get("market_rate", cost)))
        mkt_val = round(qty * ltp, 2)
        u_pnl = round(mkt_val - tot_cost, 2)
        u_pct = round((u_pnl / tot_cost) * 100.0, 2) if tot_cost > 0 else 0.0

        item = {
            "symbol": sym,
            "group": h.get("group", "A"),
            "total_quantity": qty,
            "saleable_quantity": saleable,
            "avg_cost": cost,
            "total_cost": tot_cost,
            "market_rate": ltp,
            "market_value": mkt_val,
            "unrealized_pnl": u_pnl,
            "unrealized_pnl_pct": u_pct,
            "weight_pct": 0.0,  # calculated below
        }
        total_cost_basis += tot_cost
        total_market_value += mkt_val
        total_unrealized_pnl += u_pnl
        holdings_list.append(item)

    # Calculate portfolio weights
    for h in holdings_list:
        if total_market_value > 0:
            h["weight_pct"] = round((h["market_value"] / total_market_value) * 100.0, 1)

    mature_cash = float(bal.get("mature_balance", 0.0))
    total_equity = round(mature_cash + total_market_value, 2)
    overall_pnl_pct = round((total_unrealized_pnl / total_cost_basis) * 100.0, 2) if total_cost_basis > 0 else 0.0

    return {
        "status": "success",
        "profile": state.get("profile", {}),
        "balance": bal,
        "summary": {
            "mature_balance": mature_cash,
            "ledger_balance": float(bal.get("ledger_balance", mature_cash)),
            "purchase_power": float(bal.get("purchase_power", mature_cash)),
            "total_cost_basis": round(total_cost_basis, 2),
            "total_market_value": round(total_market_value, 2),
            "total_equity": total_equity,
            "total_unrealized_pnl": round(total_unrealized_pnl, 2),
            "overall_pnl_pct": overall_pnl_pct,
            "positions_count": len(holdings_list),
        },
        "holdings": holdings_list,
        "updated_at": state.get("updated_at"),
    }
