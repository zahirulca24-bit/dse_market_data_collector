from __future__ import annotations

import datetime
import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from ..storage import SupabaseStorage
from .budget import evaluate_budget_watchlist

logger = logging.getLogger("dse_collector.agents.alerts")

# DSE Bangladesh Calendar & Trading Session (BST = UTC+6)
BST_OFFSET = datetime.timezone(datetime.timedelta(hours=6))

DSE_HOLIDAYS_2026 = {
    "2026-02-21": "Shaheed Day & International Mother Language Day",
    "2026-03-17": "National Children's Day",
    "2026-03-26": "Independence & National Day",
    "2026-04-14": "Pahela Baishakh (Bengali New Year)",
    "2026-05-01": "May Day",
    "2026-05-31": "Buddha Purnima",
    "2026-06-28": "Eid-ul-Azha",
    "2026-08-15": "National Mourning Day",
    "2026-08-26": "Janmashtami",
    "2026-09-05": "Eid-e-Milad-un-Nabi",
    "2026-10-20": "Durga Puja (Bijoya Dashami)",
    "2026-12-16": "Victory Day",
    "2026-12-25": "Christmas Day",
}

# Trading hours BST
SESSION_PRE_OPEN = datetime.time(9, 45)
SESSION_OPEN = datetime.time(10, 0)
SESSION_CLOSE = datetime.time(14, 20)
SESSION_POST_CLOSE = datetime.time(14, 30)

# In-memory storage for active alerts and history
_ACTIVE_RULES: list[dict[str, Any]] = []
_ALERT_HISTORY: list[dict[str, Any]] = []


def get_dse_clock(custom_dt: datetime.datetime | None = None) -> dict[str, Any]:
    """
    Returns the real-time status of the Dhaka Stock Exchange (DSE) market session.
    DSE operates Sunday to Thursday from 10:00 AM to 02:20 PM BST (UTC+6).
    """
    now = custom_dt or datetime.datetime.now(BST_OFFSET)
    today_str = now.strftime("%Y-%m-%d")
    current_time = now.time()
    weekday = now.weekday()  # Monday is 0, Sunday is 6, Friday is 4, Saturday is 5

    is_weekend = weekday in (4, 5)  # Friday & Saturday are weekends in Bangladesh
    holiday_name = DSE_HOLIDAYS_2026.get(today_str)
    is_holiday = bool(holiday_name)

    is_trading_day = (not is_weekend) and (not is_holiday)

    if not is_trading_day:
        state = "WEEKEND" if is_weekend else "HOLIDAY"
        status_text = f"Market Closed ({'Weekend' if is_weekend else holiday_name})"
    elif current_time < SESSION_PRE_OPEN:
        state = "PRE_MARKET"
        status_text = "Pre-market (Opening at 10:00 AM BST)"
    elif SESSION_PRE_OPEN <= current_time < SESSION_OPEN:
        state = "PRE_OPEN"
        status_text = "Order Entry / Pre-Opening Session (9:45 - 10:00 AM BST)"
    elif SESSION_OPEN <= current_time < SESSION_CLOSE:
        state = "OPEN"
        status_text = "Live Trading Session Open (10:00 AM - 2:20 PM BST)"
    elif SESSION_CLOSE <= current_time < SESSION_POST_CLOSE:
        state = "POST_CLOSE"
        status_text = "Post-Closing / Trade Adjustment (2:20 - 2:30 PM BST)"
    else:
        state = "CLOSED"
        status_text = "Market Closed for the Day (Closes at 2:20 PM BST)"

    # Calculate time to next open / close
    target_dt = now
    seconds_to_event = 0
    event_label = ""

    if state == "OPEN":
        close_dt = now.replace(hour=SESSION_CLOSE.hour, minute=SESSION_CLOSE.minute, second=0, microsecond=0)
        seconds_to_event = max(0, int((close_dt - now).total_seconds()))
        event_label = "Time until Market Close (02:20 PM BST)"
    else:
        # Next open
        days_ahead = 1
        if weekday == 3:  # Thursday -> Sunday (+3)
            days_ahead = 3
        elif weekday == 4:  # Friday -> Sunday (+2)
            days_ahead = 2
        elif weekday == 5:  # Saturday -> Sunday (+1)
            days_ahead = 1
        elif current_time < SESSION_OPEN and is_trading_day:
            days_ahead = 0

        next_open_date = now.date() + datetime.timedelta(days=days_ahead)
        open_dt = datetime.datetime.combine(next_open_date, SESSION_OPEN, tzinfo=BST_OFFSET)
        seconds_to_event = max(0, int((open_dt - now).total_seconds()))
        event_label = "Time until Next Market Open (10:00 AM BST)"

    return {
        "status": state,
        "status_text": status_text,
        "is_trading_day": is_trading_day,
        "current_time_bst": now.strftime("%Y-%m-%d %H:%M:%S BST"),
        "timezone": "BST (UTC+6)",
        "trading_session": {
            "pre_open": "09:45 AM",
            "open": "10:00 AM",
            "close": "02:20 PM",
            "post_close": "02:30 PM",
            "trading_days": "Sunday through Thursday",
        },
        "seconds_to_event": seconds_to_event,
        "event_label": event_label,
        "holiday": holiday_name,
    }


def send_telegram_alert(
    bot_token: str,
    chat_id: str,
    message: str,
    parse_mode: str = "HTML",
) -> dict[str, Any]:
    """
    Sends an instant alert message to a Telegram chat or channel via the Telegram Bot API.
    """
    if not bot_token or not chat_id:
        return {
            "status": "error",
            "message": "Bot token or Chat ID is missing.",
        }

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json", "User-Agent": "DSEMarketCollector/1.0"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode("utf-8")
            result = json.loads(resp_body)
            return {
                "status": "success" if result.get("ok") else "error",
                "details": result,
            }
    except Exception as exc:
        logger.warning("Telegram dispatch failed: %s", exc)
        return {
            "status": "error",
            "message": str(exc),
        }


def send_webhook_alert(
    webhook_url: str,
    payload: dict[str, Any],
    secret_token: str | None = None,
) -> dict[str, Any]:
    """
    Dispatches a standardized JSON event webhook to any external subscriber (Slack, Discord, custom API).
    """
    if not webhook_url:
        return {"status": "error", "message": "Webhook URL is missing."}

    try:
        data = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "DSEMarketCollector/1.0",
        }
        if secret_token:
            headers["X-DSE-Alert-Token"] = secret_token

        req = urllib.request.Request(webhook_url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return {
                "status": "success",
                "http_status": resp.status,
                "response": resp.read().decode("utf-8", errors="ignore")[:500],
            }
    except Exception as exc:
        logger.warning("Webhook dispatch failed to %s: %s", webhook_url, exc)
        return {"status": "error", "message": str(exc)}


def format_telegram_alert(
    symbol: str,
    alert_type: str,
    price: float,
    threshold: float,
    message: str,
    extra: dict[str, Any] | None = None,
) -> str:
    """
    Formats a high-impact alert notification for Telegram in clean HTML.
    """
    emoji = "🔔"
    if "STOP" in alert_type.upper() or "BELOW" in alert_type.upper():
        emoji = "🛑"
    elif "TARGET" in alert_type.upper() or "PROFIT" in alert_type.upper():
        emoji = "🎯"
    elif "BREAKOUT" in alert_type.upper():
        emoji = "🚀"

    lines = [
        f"<b>{emoji} DSE ALERT: {symbol}</b>",
        f"<b>Trigger:</b> <code>{alert_type}</code>",
        f"<b>Current Price:</b> ৳{price:.2f}",
        f"<b>Trigger Level:</b> ৳{threshold:.2f}",
        f"<b>Note:</b> {message}",
        f"<b>Time:</b> <i>{datetime.datetime.now(BST_OFFSET).strftime('%I:%M:%S %p BST')}</i>",
    ]

    if extra:
        if "shares" in extra:
            lines.append(f"<b>Suggested Sized Shares:</b> <code>{extra['shares']}</code>")
        if "reward_risk" in extra:
            lines.append(f"<b>R:R:</b> <code>{extra['reward_risk']}:1</code>")

    lines.append("\n<i>⚡ DSE Autonomous Day-Trading Pipeline</i>")
    return "\n".join(lines)


def auto_populate_pipeline_alerts(storage: SupabaseStorage) -> list[dict[str, Any]]:
    """
    Reads approved setups from Agent 6 (Budget) and auto-generates monitoring rules:
    - Target Profit Alert (TP)
    - Hard Stop Loss Alert (SL)
    - Breakout Trigger Alert
    """
    global _ACTIVE_RULES
    sized_data = evaluate_budget_watchlist(storage)
    orders = sized_data.get("orders", [])

    created_rules: list[dict[str, Any]] = []

    for o in orders:
        sym = o["symbol"]
        entry = float(o["entry_price"])
        stop = float(o["stop_loss"])
        target = float(o["target_price"])
        shares = int(o.get("final_shares", 100))
        rr = float(o.get("reward_risk", 2.0))

        # 1. Take Profit Rule
        tp_rule = {
            "id": f"{sym.lower()}-tp-target",
            "symbol": sym,
            "rule_type": "PRICE_ABOVE",
            "threshold": target,
            "current_price": entry,
            "label": f"Take Profit Target (TP) reached at ৳{target}",
            "severity": "PROFIT",
            "status": "ACTIVE",
            "shares": shares,
            "reward_risk": rr,
            "channels": ["telegram", "webhook", "in_app"],
            "created_at": datetime.datetime.now(BST_OFFSET).strftime("%Y-%m-%d %H:%M:%S"),
        }
        created_rules.append(tp_rule)

        # 2. Stop Loss Rule
        sl_rule = {
            "id": f"{sym.lower()}-sl-stop",
            "symbol": sym,
            "rule_type": "PRICE_BELOW",
            "threshold": stop,
            "current_price": entry,
            "label": f"Hard Stop Loss Floor touched at ৳{stop}",
            "severity": "DANGER",
            "status": "ACTIVE",
            "shares": shares,
            "reward_risk": rr,
            "channels": ["telegram", "webhook", "in_app"],
            "created_at": datetime.datetime.now(BST_OFFSET).strftime("%Y-%m-%d %H:%M:%S"),
        }
        created_rules.append(sl_rule)

    _ACTIVE_RULES = created_rules
    return created_rules


def check_and_evaluate_alerts(
    storage: SupabaseStorage,
    telegram_bot_token: str | None = None,
    telegram_chat_id: str | None = None,
    webhook_url: str | None = None,
) -> dict[str, Any]:
    """
    Evaluates all active rules against real-time quotes, records fired alerts, and
    dispatches notifications if channels are configured.
    """
    global _ACTIVE_RULES, _ALERT_HISTORY

    if not _ACTIVE_RULES:
        auto_populate_pipeline_alerts(storage)

    clock = get_dse_clock()
    fired_alerts: list[dict[str, Any]] = []
    price_cache: dict[str, float] = {}

    for rule in _ACTIVE_RULES:
        if rule.get("status") != "ACTIVE":
            continue

        sym = rule["symbol"]
        thresh = float(rule["threshold"])
        rule_type = rule["rule_type"]

        # Fetch latest price with caching
        if sym in price_cache:
            ltp = price_cache[sym]
        else:
            bars = storage.daily_history_for_symbol(sym, limit=2)
            if bars:
                ltp = float(bars[0].get("close", 0.0) or bars[0].get("ltp", 0.0))
            else:
                ltp = float(rule.get("current_price", 0.0))
            price_cache[sym] = ltp

        rule["current_price"] = ltp

        triggered = False
        trigger_reason = ""

        if rule_type == "PRICE_ABOVE" and ltp >= thresh:
            triggered = True
            trigger_reason = f"LTP ৳{ltp:.2f} reached or crossed target price ৳{thresh:.2f}"
        elif rule_type == "PRICE_BELOW" and ltp <= thresh:
            triggered = True
            trigger_reason = f"LTP ৳{ltp:.2f} breached stop loss floor ৳{thresh:.2f}"
        elif rule_type == "PCT_MOVE":
            prev_close = float(bars[1].get("close", ltp)) if len(bars) > 1 else ltp
            if prev_close > 0:
                pct = ((ltp - prev_close) / prev_close) * 100.0
                if abs(pct) >= thresh:
                    triggered = True
                    trigger_reason = f"Intraday move {pct:+.2f}% reached threshold ±{thresh:.1f}%"

        if triggered:
            rule["status"] = "TRIGGERED"
            rule["last_triggered_at"] = datetime.datetime.now(BST_OFFSET).strftime("%Y-%m-%d %H:%M:%S")

            alert_event = {
                "alert_id": rule["id"],
                "symbol": sym,
                "rule_type": rule_type,
                "trigger_price": ltp,
                "threshold": thresh,
                "message": trigger_reason,
                "severity": rule.get("severity", "INFO"),
                "triggered_at": rule["last_triggered_at"],
                "dispatch_results": {},
            }

            # Optional dispatch to Telegram
            if telegram_bot_token and telegram_chat_id:
                formatted_msg = format_telegram_alert(
                    symbol=sym,
                    alert_type=rule_type,
                    price=ltp,
                    threshold=thresh,
                    message=trigger_reason,
                    extra={"shares": rule.get("shares"), "reward_risk": rule.get("reward_risk")},
                )
                tg_res = send_telegram_alert(telegram_bot_token, telegram_chat_id, formatted_msg)
                alert_event["dispatch_results"]["telegram"] = tg_res

            # Optional dispatch to Webhook
            if webhook_url:
                wh_res = send_webhook_alert(webhook_url, alert_event)
                alert_event["dispatch_results"]["webhook"] = wh_res

            fired_alerts.append(alert_event)
            _ALERT_HISTORY.insert(0, alert_event)

    return {
        "status": "success",
        "clock": clock,
        "total_rules": len(_ACTIVE_RULES),
        "active_rules_count": sum(1 for r in _ACTIVE_RULES if r.get("status") == "ACTIVE"),
        "fired_alerts_count": len(fired_alerts),
        "fired_alerts": fired_alerts,
        "recent_history": _ALERT_HISTORY[:15],
        "rules": _ACTIVE_RULES,
    }
