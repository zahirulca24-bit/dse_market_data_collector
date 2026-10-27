from __future__ import annotations

import asyncio
import hmac
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .agents import (
    audit_order_risk,
    audit_watchlist_candidates,
    auto_populate_pipeline_alerts,
    check_and_evaluate_alerts,
    compute_exit_plan,
    evaluate_all_candidates,
    evaluate_budget_watchlist,
    evaluate_exit_watchlist,
    evaluate_symbol_entry,
    evaluate_timemachine_for_symbol,
    evaluate_timemachine_watchlist,
    get_dse_clock,
    load_pipeline_status,
    run_scanner,
    send_telegram_alert,
    send_webhook_alert,
    size_position,
    close_paper_position,
    evaluate_autopilot_paper_trades,
    get_daily_report_cards,
    get_daily_statement,
    dispatch_market_close_daily_report,
    get_real_portfolio_summary,
    add_or_update_real_position,
    delete_real_position,
    update_real_balance,
    get_account_summary,
    load_paper_account,
    place_paper_order,
    reset_paper_account,
    update_agent_status,
    audit_symbol_disclosures,
    fetch_live_disclosures,
    get_watchlist_news_feed,
    evaluate_company_valuation,
    evaluate_watchlist_valuations,
    fetch_company_fundamentals,
    evaluate_smart_money_flow,
    evaluate_watchlist_smart_money,
    fetch_insider_declarations,
    fetch_shareholding_pattern,
)
from .backfill import run_historical_batch
from .config import Settings
from .dashboard import daily_history, history, ingestion_status, logs, market_stock, monitoring, overview, tracker
from .main import collect_once
from .scheduler_state import cycle_finished, cycle_started, scheduler_started, snapshot as scheduler_snapshot
from .storage import SupabaseStorage

logger = logging.getLogger("dse_collector.web")
_scheduler_task: asyncio.Task | None = None
_INITIAL_SCHEDULER_DELAY_SECONDS = 10


def _exception_message(exc: Exception) -> str:
    return str(exc).strip() or exc.__class__.__name__


async def _historical_scheduler_loop() -> None:
    settings = Settings.from_env()
    scheduler_started(_INITIAL_SCHEDULER_DELAY_SECONDS)
    await asyncio.sleep(_INITIAL_SCHEDULER_DELAY_SECONDS)
    while True:
        error: str | None = None
        cycle_started()
        try:
            result = await asyncio.to_thread(run_historical_batch, "scheduler")
            logger.info("Historical scheduler result: %s", result)

            # Automated live market quote collection, Telegram alert & Auto-Pilot Paper Trading
            try:
                await asyncio.to_thread(collect_once, "scheduler", False)
                tg_token = os.getenv("TELEGRAM_BOT_TOKEN")
                tg_chat = os.getenv("TELEGRAM_CHAT_ID")
                webhook_url = os.getenv("WEBHOOK_ALERT_URL")
                storage = SupabaseStorage(settings.supabase_url, settings.supabase_service_role_key)

                if tg_token and tg_chat:
                    alert_eval = await asyncio.to_thread(
                        check_and_evaluate_alerts,
                        storage,
                        tg_token,
                        tg_chat,
                        webhook_url,
                    )
                    if alert_eval.get("fired_alerts_count", 0) > 0:
                        logger.info("Dispatched %s alerts to Telegram", alert_eval["fired_alerts_count"])

                # Auto-Pilot Paper Trading: Only operates during live DSE market hours (10:00 - 14:20 BST, Sun-Thu)!
                clock = get_dse_clock()
                if clock.get("state") == "OPEN":
                    auto_eval = await asyncio.to_thread(
                        evaluate_autopilot_paper_trades,
                        storage,
                        tg_token,
                        tg_chat,
                    )
                    if auto_eval.get("executed_count", 0) > 0 or auto_eval.get("closed_triggers_count", 0) > 0:
                        logger.info("Auto-Pilot executed %s buys, %s exits", auto_eval.get("executed_count"), auto_eval.get("closed_triggers_count"))
            except Exception as inner_exc:
                logger.debug("Automated alert check cycle note: %s", inner_exc)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            error = _exception_message(exc)
            logger.exception("Historical scheduler cycle failed")
        finally:
            cycle_finished(settings.collector_interval_seconds, error)
        await asyncio.sleep(settings.collector_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler_task
    _scheduler_task = asyncio.create_task(_historical_scheduler_loop())
    try:
        yield
    finally:
        if _scheduler_task:
            _scheduler_task.cancel()
            try:
                await _scheduler_task
            except asyncio.CancelledError:
                pass


app = FastAPI(title="DSE Market Data Collector", version="3.3.1", lifespan=lifespan)


def _authorized(authorization: str | None, settings: Settings) -> bool:
    if not settings.cron_secret or not authorization or not authorization.startswith("Bearer "):
        return False
    return hmac.compare_digest(authorization[7:].strip(), settings.cron_secret)


def _storage() -> SupabaseStorage:
    settings = Settings.from_env()
    return SupabaseStorage(settings.supabase_url, settings.supabase_service_role_key)


def _scheduler_status() -> dict:
    task_running = bool(_scheduler_task and not _scheduler_task.done())
    return scheduler_snapshot(task_running)


@app.get("/health")
@app.get("/api/healthz")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/wake")
def wake() -> str:
    return "ok"


@app.get("/api/market/overview")
def market_overview() -> dict:
    return overview(_storage())


@app.get("/api/market/stocks")
def market_stocks(sector: str | None = None, search: str | None = None) -> list[dict]:
    rows = [market_stock(row) for row in _storage().latest_quotes()]
    if sector and sector.lower() != "all": rows = [row for row in rows if row["sector"].lower() == sector.lower()]
    if search:
        needle = search.strip().upper(); rows = [row for row in rows if needle in row["symbol"].upper()]
    return rows


@app.get("/api/market/stocks/{symbol}/history")
def stock_history(symbol: str) -> list[dict]: return history(_storage(), symbol)


@app.get("/api/market/stocks/{symbol}/daily-history")
def stock_daily_history(symbol: str) -> list[dict]: return daily_history(_storage(), symbol)


@app.get("/api/market/monitoring")
def market_monitoring() -> dict:
    settings = Settings.from_env(); storage = SupabaseStorage(settings.supabase_url, settings.supabase_service_role_key); scheduler = _scheduler_status()
    try:
        storage.connection_check()
    except Exception as exc:
        return {"supabase":{"connected":False,"status":"disconnected","error":str(exc)},"dataSave":{"status":"unknown","lastResult":"unknown"},"engine":{"status":"error","currentSector":None,"currentStocks":[],"currentStockCount":0,"currentTask":"Unavailable","collectionMode":"unknown","intervalSeconds":settings.collector_interval_seconds},"universe":{"totalSectors":0,"sectorsWithHistory":0,"remainingSectors":0,"totalStocks":0,"stocksWithHistory":0,"remainingStocks":0,"historicalCoveragePct":0},"phases":[],"lastRun":{"timestamp":None,"status":"unknown","rowsSaved":0,"error":str(exc)},"nextRun":{"expectedAt":scheduler.get("next_cycle_at"),"intervalSeconds":settings.collector_interval_seconds,"note":"Scheduler state is process-local; external /api/wake keeps Render awake."},"scheduler":scheduler,"latestSnapshot":{"timestamp":None,"rows":0},"dailyHistory":{"available":False,"error":str(exc),"rowsLoadedForMonitoring":0},"coverageRows":[],"monitoring":{"status":"unavailable","error":None}}
    try:
        result = monitoring(storage, settings.collector_interval_seconds)
        result["supabase"] = {"connected":True,"status":"connected"}; result["monitoring"] = {"status":"ok","error":None}; result["scheduler"] = scheduler
        result["nextRun"] = {"expectedAt":scheduler.get("next_cycle_at"),"intervalSeconds":settings.collector_interval_seconds,"note":"Actual in-process scheduler target. /api/wake only keeps the Render process awake; it does not trigger a collection."}
        if scheduler.get("cycle_status") == "running": result["engine"]["status"] = "running"
        return result
    except Exception as exc:
        logger.exception("Monitoring calculation failed while Supabase remained connected")
        return {"supabase":{"connected":True,"status":"connected"},"dataSave":{"status":"unknown","lastResult":"unknown"},"engine":{"status":"error","currentSector":None,"currentStocks":[],"currentStockCount":0,"currentTask":"Monitoring error","collectionMode":"unknown","intervalSeconds":settings.collector_interval_seconds},"universe":{"totalSectors":0,"sectorsWithHistory":0,"remainingSectors":0,"totalStocks":0,"stocksWithHistory":0,"remainingStocks":0,"historicalCoveragePct":0},"phases":[],"lastRun":{"timestamp":None,"status":"unknown","rowsSaved":0,"error":None},"nextRun":{"expectedAt":scheduler.get("next_cycle_at"),"intervalSeconds":settings.collector_interval_seconds,"note":"Scheduler remains observable even when monitoring calculation fails."},"scheduler":scheduler,"latestSnapshot":{"timestamp":None,"rows":0},"dailyHistory":{"available":False,"error":None,"rowsLoadedForMonitoring":0},"coverageRows":[],"monitoring":{"status":"error","error":str(exc)}}


@app.get("/api/market/ingestion")
def market_ingestion_status() -> dict:
    settings = Settings.from_env(); result = ingestion_status(_storage(), settings.collector_interval_seconds); scheduler = _scheduler_status(); result["scheduler"] = scheduler; result["nextRunAt"] = scheduler.get("next_cycle_at"); return result


@app.post("/api/market/ingestion")
def market_ingestion_action() -> dict: return {"accepted":False,"message":"Collector is scheduler-managed. Use POST /api/collector/run with Bearer auth for manual collection."}


@app.get("/api/market/ingestion/tracker")
def market_ingestion_tracker() -> list[dict]: return tracker(_storage())


@app.get("/api/market/ingestion/logs")
def market_ingestion_logs() -> list[dict]: return logs(_storage())


@app.get("/api/market/ingestion/start")
def market_ingestion_start() -> dict: return {"accepted":False,"message":"Collector is scheduler-managed. Use the secured collector endpoint for manual runs."}


@app.get("/api/collector/status")
def collector_status(authorization: Annotated[str | None, Header()] = None) -> dict:
    settings = Settings.from_env()
    if not _authorized(authorization, settings): raise HTTPException(status_code=401, detail="unauthorized")
    return {"latest_run":SupabaseStorage(settings.supabase_url, settings.supabase_service_role_key).latest_run(), "scheduler":_scheduler_status()}


@app.post("/api/collector/run")
def run_collector(authorization: Annotated[str | None, Header()] = None, force: bool = Query(False)) -> dict:
    settings = Settings.from_env()
    if not _authorized(authorization, settings): raise HTTPException(status_code=401, detail="unauthorized")
    try: return collect_once(trigger="http", force=force)
    except Exception as exc: raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/collector/historical/run")
def run_historical_collector(authorization: Annotated[str | None, Header()] = None) -> dict:
    settings = Settings.from_env()
    if not _authorized(authorization, settings): raise HTTPException(status_code=401, detail="unauthorized")
    try: return run_historical_batch(trigger="http")
    except Exception as exc: raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/pipeline")
def get_agents_pipeline() -> list[dict]:
    """Returns the state and statuses of all 11 autonomous agents."""
    return load_pipeline_status()


@app.post("/api/agents/{agent_id}/status")
def set_agent_status(agent_id: str, status: str = Query(...)) -> list[dict]:
    """Updates an agent's status (e.g. approve an agent)."""
    return update_agent_status(agent_id, status)


@app.get("/api/agents/scanner/run")
def run_scanner_agent(
    force_refresh: bool = Query(False),
    setup: str = Query("all"),
    min_volume: float = Query(0.0),
) -> dict:
    """Executes Agent 1 (DSE Chart Setup Scanner) across all active securities."""
    try:
        storage = _storage()
        result = run_scanner(storage, force_refresh=force_refresh, min_volume=min_volume)
        if setup and setup != "all":
            filtered = [c for c in result["candidates"] if setup in c["setups"]]
            return {**result, "filtered_by": setup, "candidates": filtered, "count": len(filtered)}
        return result
    except Exception as exc:
        logger.exception("Agent 1 Scanner failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/entry/watchlist")
def get_entry_watchlist(
    force_refresh: bool = Query(False),
    min_volume_x: float = Query(1.0),
) -> dict:
    """Executes Agent 2 (Tactical Entry Order Agent) across the Scanner watchlist."""
    try:
        storage = _storage()
        return evaluate_all_candidates(storage, force_refresh=force_refresh, min_volume_x=min_volume_x)
    except Exception as exc:
        logger.exception("Agent 2 Watchlist Entry failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/entry/evaluate")
def evaluate_stock_entry(
    symbol: str = Query(...),
    setup: str = Query("breakout_20d"),
    level: float | None = Query(None),
    min_volume_x: float = Query(1.0),
) -> dict:
    """Evaluates tactical entry timing and limit orders for a single DSE stock."""
    try:
        storage = _storage()
        bars = storage.daily_history_for_symbol(symbol.upper(), limit=50)
        quotes = storage.latest_quotes(1000)
        quote = next((q for q in quotes if q.get("trade_code") == symbol.upper()), None)
        return evaluate_symbol_entry(
            symbol.upper(),
            bars,
            quote=quote,
            preferred_setup=setup,
            custom_level=level,
            min_volume_x=min_volume_x,
        )
    except Exception as exc:
        logger.exception("Agent 2 Evaluate Symbol failed for %s", symbol)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/exit/watchlist")
def get_exit_watchlist(
    force_refresh: bool = Query(False),
    stop_rule: str = Query("atr_1_5"),
) -> dict:
    """Executes Agent 3 (Dynamic Exit & Target Agent) across the watchlist."""
    try:
        storage = _storage()
        return evaluate_exit_watchlist(storage, force_refresh=force_refresh, stop_rule=stop_rule)
    except Exception as exc:
        logger.exception("Agent 3 Watchlist Exit failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/exit/plan")
def get_single_exit_plan(
    symbol: str = Query(...),
    entry_price: float = Query(...),
    stop_rule: str = Query("atr_1_5"),
    custom_stop: float | None = Query(None),
) -> dict:
    """Computes dynamic exit plan with multi-tranche profit targets for a single stock."""
    try:
        storage = _storage()
        bars = storage.daily_history_for_symbol(symbol.upper(), limit=50)
        return compute_exit_plan(
            symbol.upper(),
            entry_price,
            bars,
            stop_rule=stop_rule,
            custom_stop=custom_stop,
        )
    except Exception as exc:
        logger.exception("Agent 3 Single Exit Plan failed for %s", symbol)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/timemachine/watchlist")
def get_timemachine_watchlist(force_refresh: bool = Query(False)) -> dict:
    """Executes Agent 4 (TimeMachine Backtest & Replay Agent) across the pipeline."""
    try:
        storage = _storage()
        return evaluate_timemachine_watchlist(storage, force_refresh=force_refresh)
    except Exception as exc:
        logger.exception("Agent 4 Watchlist TimeMachine failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/timemachine/simulate")
def simulate_single_stock(
    symbol: str = Query(...),
    entry: float = Query(...),
    stop: float = Query(...),
    target: float = Query(...),
    setup: str = Query("breakout_20d"),
) -> dict:
    """Runs full TimeMachine simulation (1,000 Monte Carlo replays + historical backtest) for any trade."""
    try:
        storage = _storage()
        return evaluate_timemachine_for_symbol(
            storage,
            symbol=symbol.upper(),
            entry_price=entry,
            stop_loss=stop,
            target_price=target,
            setup=setup,
        )
    except Exception as exc:
        logger.exception("Agent 4 Simulate failed for %s", symbol)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/risk/watchlist")
def get_risk_watchlist(
    force_refresh: bool = Query(False),
    account_equity: float = Query(500000.0),
    max_loss_pct: float = Query(1.5),
    max_position_pct: float = Query(20.0),
    min_rr: float = Query(1.5),
) -> dict:
    """Executes Agent 5 (Capital Risk & Exposure Guard) across the watchlist."""
    try:
        storage = _storage()
        config = {
            "account_equity": account_equity,
            "max_loss_per_trade_pct": max_loss_pct,
            "max_position_pct": max_position_pct,
            "min_reward_risk": min_rr,
        }
        return audit_watchlist_candidates(storage, force_refresh=force_refresh, config=config)
    except Exception as exc:
        logger.exception("Agent 5 Watchlist Risk Audit failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/risk/audit")
def audit_single_order(
    symbol: str = Query(...),
    entry: float = Query(...),
    stop: float = Query(...),
    target: float = Query(...),
    qty: int = Query(...),
    account_equity: float = Query(500000.0),
    max_loss_pct: float = Query(1.5),
    max_position_pct: float = Query(20.0),
    min_rr: float = Query(1.5),
) -> dict:
    """Audits a single proposed order against capital limits and returns PASS or BLOCK."""
    try:
        config = {
            "account_equity": account_equity,
            "max_loss_per_trade_pct": max_loss_pct,
            "max_position_pct": max_position_pct,
            "min_reward_risk": min_rr,
        }
        return audit_order_risk(
            symbol=symbol.upper(),
            entry_price=entry,
            stop_loss=stop,
            target_price=target,
            quantity=qty,
            config=config,
        )
    except Exception as exc:
        logger.exception("Agent 5 Single Order Audit failed for %s", symbol)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/budget/watchlist")
def get_budget_watchlist(
    force_refresh: bool = Query(False),
    budget: float = Query(500000.0),
    cash_buffer_pct: float = Query(10.0),
    max_loss_pct: float = Query(1.5),
    max_position_pct: float = Query(20.0),
) -> dict:
    """Executes Agent 6 (Position Sizing & Budget Agent) across candidate setups."""
    try:
        storage = _storage()
        max_loss_amount = budget * (max_loss_pct / 100.0)
        return evaluate_budget_watchlist(
            storage,
            force_refresh=force_refresh,
            budget=budget,
            cash_buffer_pct=cash_buffer_pct,
            max_loss_per_trade=max_loss_amount,
            max_position_pct=max_position_pct,
        )
    except Exception as exc:
        logger.exception("Agent 6 Watchlist Budget Sizing failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/budget/size")
def size_single_stock(
    symbol: str = Query(...),
    entry: float = Query(...),
    stop: float = Query(...),
    target: float = Query(...),
    budget: float = Query(500000.0),
    cash_buffer_pct: float = Query(10.0),
    max_loss_pct: float = Query(1.5),
    max_position_pct: float = Query(20.0),
    win_rate: float = Query(50.0),
) -> dict:
    """Calculates exact 4-way share allocation and generates DSE bracket order for a single trade."""
    try:
        max_loss_amount = budget * (max_loss_pct / 100.0)
        return size_position(
            symbol=symbol.upper(),
            entry_price=entry,
            stop_loss=stop,
            target_price=target,
            budget=budget,
            cash_buffer_pct=cash_buffer_pct,
            max_loss_per_trade=max_loss_amount,
            max_position_pct=max_position_pct,
            win_rate=win_rate,
        )
    except Exception as exc:
        logger.exception("Agent 6 Single Stock Sizing failed for %s", symbol)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/alerts/clock")
def get_alerts_clock() -> dict:
    """Returns real-time DSE trading session clock, countdown, and holiday calendar."""
    try:
        return get_dse_clock()
    except Exception as exc:
        logger.exception("Agent 7 DSE Clock failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/alerts/check")
def get_alerts_evaluation(
    bot_token: str | None = Query(None),
    chat_id: str | None = Query(None),
    webhook_url: str | None = Query(None),
) -> dict:
    """Evaluates all active trigger rules against latest market quotes and dispatches notifications."""
    try:
        storage = _storage()
        return check_and_evaluate_alerts(
            storage,
            telegram_bot_token=bot_token,
            telegram_chat_id=chat_id,
            webhook_url=webhook_url,
        )
    except Exception as exc:
        logger.exception("Agent 7 Check Alerts failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/agents/alerts/test-telegram")
def test_telegram_dispatch(
    bot_token: str = Query(...),
    chat_id: str = Query(...),
    symbol: str = Query("SQURPHARMA"),
    message: str = Query("Test Alert from DSE Autonomous Agent Pipeline"),
) -> dict:
    """Dispatches a test notification message to the specified Telegram Bot and Chat."""
    try:
        text = f"<b>🔔 DSE PIPELINE TEST ALERT</b>\n\n<b>Symbol:</b> <code>{symbol.upper()}</code>\n<b>Message:</b> {message}\n<b>Status:</b> Operational\n\n<i>⚡ DSE Instant Alert Agent</i>"
        return send_telegram_alert(bot_token, chat_id, text)
    except Exception as exc:
        logger.exception("Agent 7 Telegram Test failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/agents/alerts/test-webhook")
def test_webhook_dispatch(
    webhook_url: str = Query(...),
    symbol: str = Query("SQURPHARMA"),
    event: str = Query("BREAKOUT_TRIGGER"),
) -> dict:
    """Dispatches a test JSON webhook event to any external endpoint."""
    try:
        payload = {
            "event": event,
            "symbol": symbol.upper(),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "source": "dse_collector.agents.alerts",
            "test": True,
        }
        return send_webhook_alert(webhook_url, payload)
    except Exception as exc:
        logger.exception("Agent 7 Webhook Test failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc






@app.post("/api/agents/broker/autopilot/run")
def trigger_autopilot_execution() -> dict:
    """Evaluates real-time market signals and executes auto-pilot paper trades (Manual user trigger allows force=True, but strictly obeys T+2 settlement)."""
    try:
        settings = Settings.from_env()
        storage = SupabaseStorage(settings.supabase_url, settings.supabase_service_role_key)
        tg_token = os.getenv("TELEGRAM_BOT_TOKEN")
        tg_chat = os.getenv("TELEGRAM_CHAT_ID")
        return evaluate_autopilot_paper_trades(storage, tg_token, tg_chat, force=True)
    except Exception as exc:
        logger.exception("Agent 8 Auto-Pilot run failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ----------------------------------------------------
# DAILY REPORTS & REAL PORTFOLIO ENDPOINTS
# ----------------------------------------------------
@app.get("/api/reports/daily-cards")
def api_daily_report_cards() -> list:
    """Returns aggregated daily performance report cards (most recent first)."""
    try:
        return get_daily_report_cards()
    except Exception as exc:
        logger.exception("Daily report cards failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/reports/statement/{date_str}")
def api_daily_statement(date_str: str) -> dict:
    """Returns itemized trading statement for a specific calendar date."""
    try:
        return get_daily_statement(date_str)
    except Exception as exc:
        logger.exception("Daily statement failed for %s", date_str)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/reports/daily-dispatch")
def api_dispatch_daily_report(force: bool = True) -> dict:
    """Dispatches the daily closing report to Telegram."""
    try:
        settings = Settings.from_env()
        storage = SupabaseStorage(settings.supabase_url, settings.supabase_service_role_key)
        tg_token = os.getenv("TELEGRAM_BOT_TOKEN")
        tg_chat = os.getenv("TELEGRAM_CHAT_ID")
        return dispatch_market_close_daily_report(storage, tg_token, tg_chat, force=force)
    except Exception as exc:
        logger.exception("Daily report dispatch failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/portfolio/real")
def api_get_real_portfolio() -> dict:
    """Returns real broker portfolio statement with live DSE market price synchronization."""
    try:
        storage = _storage()
        return get_real_portfolio_summary(storage=storage)
    except Exception as exc:
        logger.exception("Real portfolio summary failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/portfolio/real/position")
def api_add_real_position(
    symbol: str = Query(...),
    quantity: int = Query(...),
    avg_cost: float = Query(...),
    saleable_quantity: int | None = Query(None),
    group: str = Query("A"),
) -> dict:
    """Adds or updates a real stock holding in the portfolio statement."""
    try:
        return add_or_update_real_position(
            symbol=symbol,
            quantity=quantity,
            avg_cost=avg_cost,
            saleable_quantity=saleable_quantity,
            group=group,
        )
    except Exception as exc:
        logger.exception("Add real position failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.delete("/api/portfolio/real/position/{symbol}")
def api_delete_real_position(symbol: str) -> dict:
    """Removes a real stock holding from the portfolio statement."""
    try:
        return delete_real_position(symbol=symbol)
    except Exception as exc:
        logger.exception("Delete real position failed for %s", symbol)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/portfolio/real/balance")
def api_update_real_balance(
    mature_balance: float | None = Query(None),
    ledger_balance: float | None = Query(None),
    purchase_power: float | None = Query(None),
    receivable_sales: float | None = Query(None),
) -> dict:
    """Updates real cash balances for the broker statement."""
    try:
        return update_real_balance(
            mature_balance=mature_balance,
            ledger_balance=ledger_balance,
            purchase_power=purchase_power,
            receivable_sales=receivable_sales,
        )
    except Exception as exc:
        logger.exception("Update real balance failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/broker/account")
def get_broker_account() -> dict:
    """Returns live DSE paper trading portfolio, balances, and PnL metrics."""
    try:
        storage = _storage()
        return get_account_summary(storage=storage)
    except Exception as exc:
        logger.exception("Agent 8 Broker Account failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/agents/broker/order")
def execute_broker_order(
    symbol: str = Query(...),
    side: str = Query(...),
    qty: int = Query(...),
    price: float = Query(...),
    order_type: str = Query("LIMIT"),
    stop_loss: float | None = Query(None),
    take_profit: float | None = Query(None),
    notes: str = Query(""),
) -> dict:
    """Executes a simulated paper buy or sell order with DSE commission and capital enforcement."""
    try:
        return place_paper_order(
            symbol=symbol,
            side=side,
            quantity=qty,
            price=price,
            order_type=order_type,
            stop_loss=stop_loss,
            take_profit=take_profit,
            notes=notes,
        )
    except Exception as exc:
        logger.exception("Agent 8 Broker Order failed for %s", symbol)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/agents/broker/close")
def close_broker_position(
    symbol: str = Query(...),
    price: float | None = Query(None),
    reason: str = Query("MANUAL_CLOSE"),
) -> dict:
    """Closes an active paper position at specified or current LTP price."""
    try:
        state = load_paper_account()
        return close_paper_position(state, symbol=symbol, exit_price=price, reason=reason)
    except Exception as exc:
        logger.exception("Agent 8 Broker Close failed for %s", symbol)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/agents/broker/reset")
def reset_broker_portfolio(starting_cash: float = Query(500000.0)) -> dict:
    """Resets paper trading account back to clean starting cash balance."""
    try:
        return reset_paper_account(starting_cash=starting_cash)
    except Exception as exc:
        logger.exception("Agent 8 Broker Reset failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc




# --- Agent 9: Corporate Disclosures & News Agent ---
@app.get("/api/agents/news/feed")
def get_corporate_news_feed(
    tickers: str | None = Query(None, description="Comma-separated tickers"),
    limit: int = Query(50, description="Max news records"),
) -> dict:
    """Returns classified live DSE corporate disclosures with sentiment and event risk overview."""
    try:
        ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()] if tickers else None
        return get_watchlist_news_feed(tickers=ticker_list, limit=limit)
    except Exception as exc:
        logger.exception("Agent 9 Corporate News Feed failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/news/symbol/{symbol}")
def get_symbol_corporate_news(symbol: str) -> dict:
    """Returns detailed corporate disclosure audit, upcoming catalyst calendar and risk warnings for a single ticker."""
    try:
        return audit_symbol_disclosures(symbol=symbol)
    except Exception as exc:
        logger.exception("Agent 9 Symbol Audit failed for %s", symbol)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/news/live")
def get_raw_live_disclosures(
    code: str | None = Query(None),
    limit: int = Query(50),
    force_refresh: bool = Query(False),
) -> list:
    """Fetches live raw and classified corporate disclosures from DSE API."""
    try:
        return fetch_live_disclosures(code=code, limit=limit, force_refresh=force_refresh)
    except Exception as exc:
        logger.exception("Agent 9 Live Disclosures failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc



# --- Agent 10: Financial Valuation & Analyst Agent ---
@app.get("/api/agents/analyst/watchlist")
def get_analyst_watchlist(
    symbols: str | None = Query(None, description="Comma-separated tickers"),
) -> dict:
    """Evaluates P/E ratios, Graham fair values, sector benchmarks and fundamental health scores."""
    try:
        sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()] if symbols else None
        return evaluate_watchlist_valuations(symbols=sym_list)
    except Exception as exc:
        logger.exception("Agent 10 Analyst Watchlist failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/analyst/evaluate/{symbol}")
def get_analyst_evaluation(symbol: str) -> dict:
    """Computes full fundamental valuation audit, Graham upside, and trader safety briefing for a single security."""
    try:
        return evaluate_company_valuation(symbol=symbol)
    except Exception as exc:
        logger.exception("Agent 10 Analyst Evaluate failed for %s", symbol)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/analyst/fundamentals/{symbol}")
def get_raw_company_fundamentals(
    symbol: str,
    force_refresh: bool = Query(False),
) -> dict:
    """Fetches raw company profile, 5-year historical financials and P/E from DSE."""
    try:
        return fetch_company_fundamentals(symbol=symbol, force_refresh=force_refresh)
    except Exception as exc:
        logger.exception("Agent 10 Raw Fundamentals failed for %s", symbol)
        raise HTTPException(status_code=500, detail=str(exc)) from exc



# --- Agent 11: Sponsor & Smart Money Flow Agent ---
@app.get("/api/agents/pelosi/watchlist")
def get_smart_money_watchlist(
    symbols: str | None = Query(None, description="Comma-separated tickers"),
) -> dict:
    """Evaluates smart money ownership, institutional accumulation, and insider declarations."""
    try:
        sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()] if symbols else None
        return evaluate_watchlist_smart_money(symbols=sym_list)
    except Exception as exc:
        logger.exception("Agent 11 Smart Money Watchlist failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/pelosi/flow/{symbol}")
def get_symbol_smart_money_flow(symbol: str) -> dict:
    """Computes shareholding breakdown, smart money score, and director trade signal for a single security."""
    try:
        return evaluate_smart_money_flow(symbol=symbol)
    except Exception as exc:
        logger.exception("Agent 11 Smart Money Flow failed for %s", symbol)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/agents/pelosi/declarations")
def get_live_insider_declarations(
    limit: int = Query(30),
) -> list:
    """Returns recent Sponsor / Director buy, sell, and transfer declarations from DSE."""
    try:
        return fetch_insider_declarations(limit=limit)
    except Exception as exc:
        logger.exception("Agent 11 Insider Declarations failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if FRONTEND_DIR.exists():
    assets = FRONTEND_DIR / "assets"
    if assets.exists(): app.mount("/assets", StaticFiles(directory=assets), name="assets")
    @app.get("/{full_path:path}", include_in_schema=False)
    def frontend(full_path: str):
        candidate = FRONTEND_DIR / full_path
        if full_path and candidate.is_file(): return FileResponse(candidate)
        return FileResponse(FRONTEND_DIR / "index.html")
else:
    @app.get("/", include_in_schema=False)
    def root() -> dict: return {"service":"dse-market-data-collector","status":"ok","frontend":"not-built"}


def port() -> int: return int(os.getenv("PORT", "8000"))
