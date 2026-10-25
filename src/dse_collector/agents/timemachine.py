from __future__ import annotations

import logging
import math
import random
import time
from typing import Any

from ..storage import SupabaseStorage
from .entry import evaluate_all_candidates
from .exit import calculate_atr14

logger = logging.getLogger("dse_collector.agents.timemachine")


def run_historical_backtest(
    symbol: str,
    bars: list[dict],
    setup: str = "breakout_20d",
    target_r: float = 2.0,
    horizon_days: int = 10,
) -> dict[str, Any]:
    """
    Backtests the exact setup rules across all past trading sessions for the symbol.
    """
    if len(bars) < 35:
        return {
            "symbol": symbol,
            "status": "INSUFFICIENT_HISTORY",
            "message": "Needs at least 35 historical sessions for backtesting.",
            "total_triggers": 0,
            "win_rate": 0.0,
            "expectancy": 0.0,
            "trades": [],
        }

    bars.sort(key=lambda b: b["trade_date"])
    trades = []

    for i in range(25, len(bars) - horizon_days):
        closes = [float(b["close"]) for b in bars[i - 21 : i - 1] if b.get("close")]
        if len(closes) < 20:
            continue

        current_close = float(bars[i]["close"])
        prev_close = float(bars[i - 1]["close"])
        hi20 = max(closes)
        ma20 = sum(closes[-20:]) / 20.0
        prev_ma20 = sum(closes[-21:-1]) / 20.0 if len(closes) >= 21 else ma20

        # Evaluate if setup was triggered on day i
        is_trigger = False
        if setup == "reclaim_ma20":
            is_trigger = prev_close < prev_ma20 and current_close >= ma20
        elif setup == "bull_flag":
            # 10% pole over 10 days before last 5, and last 5 in 5% range
            if len(closes) >= 16 and closes[-16] > 0:
                run = (closes[-6] / closes[-16]) - 1.0
                rng5 = (max(closes[-5:]) - min(closes[-5:])) / current_close if current_close > 0 else 0
                is_trigger = run > 0.10 and rng5 < 0.05
        else:  # default breakout_20d
            is_trigger = current_close > hi20

        if not is_trigger:
            continue

        entry = current_close
        atr = calculate_atr14(bars[max(0, i - 14) : i])
        stop = round(entry - 1.5 * atr, 2)
        risk = round(entry - stop, 2)
        if risk <= 0:
            continue
        target = round(entry + target_r * risk, 2)

        # Check forward horizon outcome
        outcome = "TIMEOUT"
        pnl_r = 0.0
        exit_price = entry
        exit_date = bars[min(i + horizon_days, len(bars) - 1)]["trade_date"]

        for f in range(i + 1, min(i + horizon_days + 1, len(bars))):
            bar_f = bars[f]
            h_f = float(bar_f.get("high") or bar_f["close"])
            l_f = float(bar_f.get("low") or bar_f["close"])

            if l_f <= stop:
                outcome = "STOP"
                pnl_r = -1.0
                exit_price = stop
                exit_date = bar_f["trade_date"]
                break
            elif h_f >= target:
                outcome = "TARGET"
                pnl_r = target_r
                exit_price = target
                exit_date = bar_f["trade_date"]
                break

        if outcome == "TIMEOUT":
            last_bar = bars[min(i + horizon_days, len(bars) - 1)]
            last_c = float(last_bar["close"])
            exit_price = last_c
            pnl_r = round((last_c - entry) / risk, 2)

        trades.append({
            "trigger_date": bars[i]["trade_date"],
            "entry_price": entry,
            "stop_loss": stop,
            "target": target,
            "exit_price": exit_price,
            "exit_date": exit_date,
            "outcome": outcome,
            "pnl_r": pnl_r,
        })

    total_triggers = len(trades)
    if total_triggers == 0:
        return {
            "symbol": symbol,
            "status": "NO_TRIGGERS_FOUND",
            "message": f"Setup '{setup}' did not trigger in past {len(bars)} trading days.",
            "total_triggers": 0,
            "win_rate": 0.0,
            "expectancy": 0.0,
            "trades": [],
        }

    wins = sum(1 for t in trades if t["outcome"] == "TARGET" or t["pnl_r"] > 0)
    target_hits = sum(1 for t in trades if t["outcome"] == "TARGET")
    stop_hits = sum(1 for t in trades if t["outcome"] == "STOP")
    timeouts = sum(1 for t in trades if t["outcome"] == "TIMEOUT")

    resolved = target_hits + stop_hits
    win_rate = round((target_hits / resolved * 100.0), 1) if resolved > 0 else 0.0

    total_pnl_r = sum(t["pnl_r"] for t in trades)
    expectancy = round(total_pnl_r / total_triggers, 2)

    gross_gains = sum(t["pnl_r"] for t in trades if t["pnl_r"] > 0)
    gross_losses = abs(sum(t["pnl_r"] for t in trades if t["pnl_r"] < 0))
    profit_factor = round(gross_gains / gross_losses, 2) if gross_losses > 0 else (9.99 if gross_gains > 0 else 0.0)

    return {
        "symbol": symbol,
        "setup": setup,
        "total_historical_bars": len(bars),
        "total_triggers": total_triggers,
        "target_hits": target_hits,
        "stop_hits": stop_hits,
        "timeouts": timeouts,
        "win_rate": win_rate,
        "expectancy_r": expectancy,
        "profit_factor": profit_factor,
        "recent_trades": trades[-5:],  # Last 5 sample trades
    }


def run_monte_carlo(
    entry_price: float,
    stop_loss: float,
    target_price: float,
    recent_bars: list[dict],
    replays: int = 1000,
    horizon_days: int = 10,
    seed: int = 19,
) -> dict[str, Any]:
    """
    Runs 1,000 forward Monte Carlo simulations of the trade based on recent empirical volatility.
    """
    if len(recent_bars) < 15:
        daily_returns = [0.015, -0.010, 0.005, -0.005, 0.02, -0.015]
    else:
        closes = [float(b["close"]) for b in recent_bars if b.get("close")]
        daily_returns = []
        for i in range(1, len(closes)):
            if closes[i - 1] > 0:
                daily_returns.append((closes[i] - closes[i - 1]) / closes[i - 1])

    risk = entry_price - stop_loss
    if risk <= 0:
        risk = entry_price * 0.03

    rnd = random.Random(seed)
    hit_target = 0
    hit_stop = 0
    timeouts = 0
    pnl_r_list = []

    # Percentile tracking arrays across days
    paths_by_day = [[] for _ in range(horizon_days + 1)]

    for _ in range(replays):
        price = entry_price
        paths_by_day[0].append(price)
        resolved = False

        for day in range(1, horizon_days + 1):
            if not resolved:
                ret = rnd.choice(daily_returns) + rnd.gauss(0, 0.008)
                price = max(0.10, price * (1 + ret))

                if price <= stop_loss:
                    hit_stop += 1
                    pnl_r_list.append(-1.0)
                    resolved = True
                    price = stop_loss
                elif price >= target_price:
                    hit_target += 1
                    target_r = round((target_price - entry_price) / risk, 1)
                    pnl_r_list.append(target_r)
                    resolved = True
                    price = target_price

            paths_by_day[day].append(price)

        if not resolved:
            timeouts += 1
            final_pnl_r = round((price - entry_price) / risk, 2)
            pnl_r_list.append(final_pnl_r)

    prob_target = round((hit_target / replays) * 100.0, 1)
    prob_stop = round((hit_stop / replays) * 100.0, 1)
    prob_timeout = round((timeouts / replays) * 100.0, 1)
    avg_mc_r = round(sum(pnl_r_list) / len(pnl_r_list), 2) if pnl_r_list else 0.0

    # Build fan chart percentiles (5th, 25th, 50th, 75th, 95th)
    fan_bands = []
    for day in range(horizon_days + 1):
        vals = sorted(paths_by_day[day])
        n = len(vals)
        fan_bands.append({
            "day": day,
            "p5": round(vals[int(n * 0.05)], 2),
            "p25": round(vals[int(n * 0.25)], 2),
            "median": round(vals[int(n * 0.50)], 2),
            "p75": round(vals[int(n * 0.75)], 2),
            "p95": round(vals[int(n * 0.95)], 2),
        })

    return {
        "replays": replays,
        "seed": seed,
        "horizon_days": horizon_days,
        "prob_target_first": prob_target,
        "prob_stop_first": prob_stop,
        "prob_open_at_close": prob_timeout,
        "avg_mc_r": avg_mc_r,
        "fan_bands": fan_bands,
    }


def generate_verdict(backtest: dict[str, Any], mc: dict[str, Any]) -> dict[str, str]:
    """
    Generates an honest, statistical verdict synthesizing real history and Monte Carlo replays.
    """
    exp = backtest.get("expectancy_r", 0.0)
    win_rate = backtest.get("win_rate", 0.0)
    prob_target = mc.get("prob_target_first", 0.0)
    prob_stop = mc.get("prob_stop_first", 0.0)

    if exp >= 0.20 and prob_target > prob_stop:
        verdict = "Strong Statistical Edge"
        badge = "HIGH EXPECTANCY (+{:.2f}R)".format(exp)
        color = "emerald"
        narrative = f"Historically produced positive expectancy ({exp:+.2f}R per trade) with {win_rate}% win rate on 2R targets. Monte Carlo gives {prob_target}% odds of hitting target vs {prob_stop}% stop."
    elif exp > 0.0 or prob_target >= prob_stop:
        verdict = "Positive Edge / Leans Toward Target"
        badge = "MODERATE EDGE (+{:.2f}R)".format(exp)
        color = "cyan"
        narrative = f"Setup leans toward target with profit factor {backtest.get('profit_factor', 1.2)}. Probability of reaching profit target is {prob_target}%."
    elif exp >= -0.08:
        verdict = "Close to Break-Even / Coin Flip"
        badge = "NEUTRAL EDGE ({:.2f}R)".format(exp)
        color = "amber"
        narrative = f"Outcome odds are evenly balanced ({prob_target}% target vs {prob_stop}% stop). Strict position sizing and trailing stops recommended."
    else:
        verdict = "Unfavorable Expectancy / High Failure Rate"
        badge = "NEGATIVE EDGE ({:.2f}R)".format(exp)
        color = "rose"
        narrative = f"Historical testing showed stopouts outweighed target hits (Expectancy {exp:+.2f}R). Consider skipping or taking faster 1R profits."

    return {
        "verdict": verdict,
        "badge": badge,
        "color": color,
        "narrative": narrative,
    }


def evaluate_timemachine_for_symbol(
    storage: SupabaseStorage,
    symbol: str,
    entry_price: float,
    stop_loss: float,
    target_price: float,
    setup: str = "breakout_20d",
) -> dict[str, Any]:
    """
    Runs full TimeMachine (Historical Backtest + Monte Carlo Replays) for a given stock.
    """
    bars = storage.daily_history_for_symbol(symbol.upper(), limit=500)
    if not bars:
        return {"error": f"No historical daily bars found for symbol {symbol}"}

    backtest = run_historical_backtest(symbol.upper(), bars, setup=setup, target_r=2.0)
    mc = run_monte_carlo(entry_price, stop_loss, target_price, bars[-60:], replays=1000, seed=19)
    verdict = generate_verdict(backtest, mc)

    return {
        "status": "success",
        "symbol": symbol.upper(),
        "setup": setup,
        "entry_price": entry_price,
        "stop_loss": stop_loss,
        "target_price": target_price,
        "backtest": backtest,
        "monte_carlo": mc,
        "verdict": verdict,
    }


def evaluate_timemachine_watchlist(
    storage: SupabaseStorage,
    force_refresh: bool = False,
) -> dict[str, Any]:
    """
    Computes TimeMachine simulations for top candidates from the Agent 2/3 pipeline.
    """
    entry_data = evaluate_all_candidates(storage, force_refresh=force_refresh)
    entries = entry_data.get("entries", [])[:15]  # Top 15 liquid setups

    results = []
    for e in entries:
        sym = e["symbol"]
        entry_price = float(e.get("order_card", {}).get("recommended_limit_price") or e["ltp"])
        bars = storage.daily_history_for_symbol(sym, limit=500)
        if not bars:
            continue

        atr = calculate_atr14(bars[-14:])
        stop_loss = round(entry_price - 1.5 * atr, 2)
        risk = entry_price - stop_loss
        target_price = round(entry_price + 2.0 * risk, 2)

        backtest = run_historical_backtest(sym, bars, setup=e["setup"], target_r=2.0)
        mc = run_monte_carlo(entry_price, stop_loss, target_price, bars[-60:], replays=1000, seed=19)
        verdict = generate_verdict(backtest, mc)

        results.append({
            "symbol": sym,
            "setup": e["setup"],
            "entry_price": entry_price,
            "stop_loss": stop_loss,
            "target_price": target_price,
            "backtest": backtest,
            "monte_carlo": mc,
            "verdict": verdict,
        })

    return {
        "status": "success",
        "agent": {
            "id": "trader-timemachine",
            "name": "TimeMachine Backtest & Replay Agent",
            "version": "1.0.0",
            "status": "running",
            "description": "Simulates 1,000 forward Monte Carlo paths and backtests historical expectancy across 500 DSE sessions.",
        },
        "evaluated_count": len(results),
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "simulations": results,
    }
