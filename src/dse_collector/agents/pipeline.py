from __future__ import annotations

import json
from pathlib import Path
from typing import Any

PIPELINE_FILE = Path(__file__).parent / "agent_status.json"

DEFAULT_AGENTS = [
    {
        "id": "trader-scanner",
        "index": 1,
        "name": "DSE Chart Setup Scanner",
        "category": "Discovery & Technical Setups",
        "status": "open",
        "description": "Scans all 400+ DSE securities for 20D Breakouts, Bull Flags, 20 SMA Reclaims, and Oversold Bounces.",
        "skills": ["breakout_20d", "bull_flag", "reclaim_ma20", "oversold_bounce", "oversold"],
        "badge": "Approved & Operational",
        "actions": ["run_scan", "filter_setups", "view_chart"],
    },
    {
        "id": "trader-entry",
        "index": 2,
        "name": "Tactical Entry Order Agent",
        "category": "Execution Planning",
        "status": "running",
        "description": "Calculates optimal limit buy zones, pullback buy triggers, and confirmation candle thresholds.",
        "skills": ["limit_pricing", "pullback_entry", "breakout_trigger"],
        "badge": "Active Live Testing",
        "actions": ["evaluate_entry", "set_triggers", "pullback_zones"],
    },
    {
        "id": "trader-exit",
        "index": 3,
        "name": "Dynamic Exit & Target Agent",
        "category": "Trade Management",
        "status": "locked",
        "description": "Computes 1:2 and 1:3 risk-to-reward take profits, trailing ATR stops, and scale-out tranches.",
        "skills": ["tp_levels", "trailing_stop", "atr_risk_cushion"],
        "badge": "Locked",
        "actions": [],
    },
    {
        "id": "trader-timemachine",
        "index": 4,
        "name": "TimeMachine Backtest & Replay Agent",
        "category": "Simulation & Backtesting",
        "status": "locked",
        "description": "Simulates historical execution on past DSE market regimes with win-rate and profit-factor analytics.",
        "skills": ["historical_replay", "expectancy_calc", "max_drawdown"],
        "badge": "Locked",
        "actions": [],
    },
    {
        "id": "trader-risk",
        "index": 5,
        "name": "Capital Risk & Exposure Guard",
        "category": "Risk Management",
        "status": "locked",
        "description": "Enforces strict portfolio allocation caps, circuit breaker protection, and single-stock exposure limits.",
        "skills": ["max_risk_per_trade", "circuit_guard", "sector_concentration"],
        "badge": "Locked",
        "actions": [],
    },
    {
        "id": "trader-budget",
        "index": 6,
        "name": "Position Sizing & Budget Agent",
        "category": "Capital Allocation",
        "status": "locked",
        "description": "Calculates exact share quantities to purchase according to account equity and stop loss distance.",
        "skills": ["kelly_criterion", "fixed_fractional", "cash_reserve_ratio"],
        "badge": "Locked",
        "actions": [],
    },
    {
        "id": "trader-alerts",
        "index": 7,
        "name": "Instant Alert & Notification Agent",
        "category": "Notifications & Webhooks",
        "status": "locked",
        "description": "Dispatches instant Telegram messages, browser push alerts, and webhooks on breakout triggers.",
        "skills": ["telegram_bot", "browser_push", "webhook_dispatch"],
        "badge": "Locked",
        "actions": [],
    },
    {
        "id": "trader-broker",
        "index": 8,
        "name": "Broker API Integration Agent",
        "category": "Order Routing",
        "status": "locked",
        "description": "Routes orders to brokerage FIX/REST APIs with simulated paper-trading or live order validation.",
        "skills": ["order_routing", "paper_trading", "execution_logs"],
        "badge": "Locked",
        "actions": [],
    },
    {
        "id": "trader-news",
        "index": 9,
        "name": "Corporate Disclosures & News Agent",
        "category": "Fundamental Intelligence",
        "status": "locked",
        "description": "Extracts and analyzes price-sensitive corporate announcements, AGM/EGM dates, and dividends.",
        "skills": ["dse_news_parser", "sentiment_scoring", "psi_extraction"],
        "badge": "Locked",
        "actions": [],
    },
    {
        "id": "trader-analyst",
        "index": 10,
        "name": "Financial Valuation & Analyst Agent",
        "category": "Valuation & Fundamentals",
        "status": "locked",
        "description": "Evaluates P/E ratios, NAV, EPS trends, debt ratios, and industry peer group comparison.",
        "skills": ["pe_nav_analysis", "eps_growth", "peer_valuation"],
        "badge": "Locked",
        "actions": [],
    },
    {
        "id": "trader-pelosi",
        "index": 11,
        "name": "Sponsor & Smart Money Flow Agent",
        "category": "Institutional Tracking",
        "status": "locked",
        "description": "Monitors Sponsor / Director share buy-sell declarations, institutional holdings, and block market volume.",
        "skills": ["director_trades", "block_market_tracker", "institutional_accumulation"],
        "badge": "Locked",
        "actions": [],
    },
]


def load_pipeline_status() -> list[dict[str, Any]]:
    if PIPELINE_FILE.exists():
        try:
            with open(PIPELINE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return DEFAULT_AGENTS


def save_pipeline_status(agents: list[dict[str, Any]]) -> None:
    with open(PIPELINE_FILE, "w", encoding="utf-8") as f:
        json.dump(agents, f, indent=2)


def update_agent_status(agent_id: str, new_status: str) -> list[dict[str, Any]]:
    agents = load_pipeline_status()
    for ag in agents:
        if ag["id"] == agent_id:
            ag["status"] = new_status
            if new_status == "open":
                ag["badge"] = "Approved & Operational"
    save_pipeline_status(agents)
    return agents
