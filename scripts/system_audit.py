import sys
sys.stdout.reconfigure(encoding='utf-8')
import os
import urllib.request
import json

sys.path.insert(0, '.')

print("=" * 60)
print(" DSE MULTI-AGENT SYSTEM - FULL CODE-SIDE AUDIT")
print("=" * 60)

errors = []
successes = []

# Instantiate storage
from src.dse_collector.config import Settings
from src.dse_collector.storage import SupabaseStorage
settings = Settings.from_env()
storage = SupabaseStorage(settings.supabase_url, settings.supabase_service_role_key)

# --- 1. AUDIT ALL 11 AGENT MODULES DIRECTLY ---
print("\n[TEST 1/4] Direct Backend Agent Modules Invocations...")

try:
    from src.dse_collector.agents.scanner import run_scanner
    scans = run_scanner(storage)
    assert 'candidates' in scans
    successes.append(f"Agent 1 (Scanner): OK ({len(scans['candidates'])} setups scanned)")
except Exception as e:
    errors.append(f"Agent 1 (Scanner) failed: {e}")

try:
    from src.dse_collector.agents.entry import evaluate_all_candidates
    entries = evaluate_all_candidates(storage)
    assert 'entries' in entries
    successes.append(f"Agent 2 (Entry): OK ({len(entries['entries'])} entry orders planned)")
except Exception as e:
    errors.append(f"Agent 2 (Entry) failed: {e}")

try:
    from src.dse_collector.agents.exit import evaluate_exit_watchlist
    exits = evaluate_exit_watchlist(storage)
    assert 'plans' in exits
    successes.append(f"Agent 3 (Exit): OK ({len(exits['plans'])} exit & TP plans computed)")
except Exception as e:
    errors.append(f"Agent 3 (Exit) failed: {e}")

try:
    from src.dse_collector.agents.timemachine import evaluate_timemachine_watchlist
    tm = evaluate_timemachine_watchlist(storage)
    assert 'simulations' in tm
    successes.append(f"Agent 4 (TimeMachine): OK ({len(tm['simulations'])} Monte-Carlo backtests)")
except Exception as e:
    errors.append(f"Agent 4 (TimeMachine) failed: {e}")

try:
    from src.dse_collector.agents.risk import audit_watchlist_candidates
    risk = audit_watchlist_candidates(storage)
    assert 'audits' in risk
    successes.append(f"Agent 5 (Risk): OK ({len(risk['audits'])} risk audits performed)")
except Exception as e:
    errors.append(f"Agent 5 (Risk) failed: {e}")

try:
    from src.dse_collector.agents.budget import evaluate_budget_watchlist
    budget = evaluate_budget_watchlist(storage)
    assert 'orders' in budget
    successes.append(f"Agent 6 (Budget): OK ({len(budget['orders'])} position sizing orders sized)")
except Exception as e:
    errors.append(f"Agent 6 (Budget) failed: {e}")

try:
    from src.dse_collector.agents.alerts import get_dse_clock, check_and_evaluate_alerts
    clock = get_dse_clock()
    alerts = check_and_evaluate_alerts(storage)
    assert 'status' in clock and 'fired_alerts_count' in alerts
    successes.append(f"Agent 7 (Alerts): OK (Market Clock: {clock['status']})")
except Exception as e:
    errors.append(f"Agent 7 (Alerts) failed: {e}")

try:
    from src.dse_collector.agents.broker import get_account_summary
    broker = get_account_summary()
    assert 'account' in broker
    successes.append(f"Agent 8 (Broker): OK (Account Equity: ৳{broker['account']['total_account_equity']:,.0f})")
except Exception as e:
    errors.append(f"Agent 8 (Broker) failed: {e}")

try:
    from src.dse_collector.agents.news import get_watchlist_news_feed, audit_symbol_disclosures
    news = get_watchlist_news_feed(['SQURPHARMA'])
    audit = audit_symbol_disclosures('SQURPHARMA')
    assert 'sentiment_overview' in news and 'actionable_briefing' in audit
    successes.append(f"Agent 9 (News): OK ({news['total_disclosures_monitored']} disclosures monitored)")
except Exception as e:
    errors.append(f"Agent 9 (News) failed: {e}")

try:
    from src.dse_collector.agents.analyst import evaluate_watchlist_valuations, evaluate_company_valuation
    vals = evaluate_watchlist_valuations(['SQURPHARMA'])
    squr_val = evaluate_company_valuation('SQURPHARMA')
    assert 'summary' in vals and 'metrics' in squr_val
    successes.append(f"Agent 10 (Analyst): OK (Average P/E: {vals['summary']['average_pe']}x)")
except Exception as e:
    errors.append(f"Agent 10 (Analyst) failed: {e}")

try:
    from src.dse_collector.agents.pelosi import evaluate_watchlist_smart_money, evaluate_smart_money_flow
    pelosi = evaluate_watchlist_smart_money(['SQURPHARMA'])
    squr_flow = evaluate_smart_money_flow('SQURPHARMA')
    assert 'summary' in pelosi and 'shareholding' in squr_flow
    successes.append(f"Agent 11 (Pelosi): OK (Smart Money Hold: {pelosi['summary']['average_smart_money_holding_pct']}%)")
except Exception as e:
    errors.append(f"Agent 11 (Pelosi) failed: {e}")


# --- 2. AUDIT FASTAPI LIVE ENDPOINTS ON PORT 8000 ---
print("\n[TEST 2/4] Testing Live HTTP API Endpoints on Port 8000...")

endpoints = [
    ("/api/agents/pipeline", "Pipeline Overview", 10),
    ("/api/agents/scanner/run", "Agent 1 Scanner API", 20),
    ("/api/agents/entry/watchlist", "Agent 2 Entry Watchlist API", 20),
    ("/api/agents/exit/watchlist", "Agent 3 Exit Watchlist API", 20),
    ("/api/agents/timemachine/watchlist", "Agent 4 TimeMachine API", 30),
    ("/api/agents/risk/watchlist", "Agent 5 Risk Guard API", 20),
    ("/api/agents/budget/watchlist", "Agent 6 Position Sizing API", 20),
    ("/api/agents/alerts/clock", "Agent 7 Market Clock API", 10),
    ("/api/agents/alerts/check", "Agent 7 Alerts Check API", 20),
    ("/api/agents/broker/account", "Agent 8 Paper Broker API", 10),
    ("/api/agents/news/feed", "Agent 9 Corporate News Feed API", 20),
    ("/api/agents/news/symbol/SQURPHARMA", "Agent 9 Symbol News API", 20),
    ("/api/agents/analyst/watchlist", "Agent 10 Valuation Watchlist API", 20),
    ("/api/agents/analyst/evaluate/SQURPHARMA", "Agent 10 Symbol Valuation API", 20),
    ("/api/agents/pelosi/watchlist", "Agent 11 Smart Money Watchlist API", 20),
    ("/api/agents/pelosi/flow/MPETROLEUM", "Agent 11 Symbol Flow API", 20),
    ("/api/dashboard/overview", "Core Overview API", 10),
    ("/api/dashboard/sectors", "Core Sectors API", 10),
    ("/api/dashboard/ingestion-status", "Core Ingestion API", 10),
]

for path, desc, timeout_secs in endpoints:
    url = f"http://127.0.0.1:8000{path}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout_secs) as r:
            assert r.status == 200
            successes.append(f"HTTP 200: {desc} ({path})")
    except Exception as e:
        errors.append(f"HTTP Failed for {desc} ({path}): {e}")


# --- 3. AUDIT PIPELINE FINAL STATUS ---
print("\n[TEST 3/4] Checking Pipeline 11 Agents Status in agent_status.json...")
try:
    with open('src/dse_collector/agents/agent_status.json', 'r', encoding='utf-8') as f:
        st = json.load(f)
    assert len(st) == 11
    open_count = sum(1 for a in st if a['status'] == 'open')
    assert open_count == 11, f"Expected 11 open agents, got {open_count}"
    successes.append(f"Pipeline Integrity: All 11/11 Agents in status.json are OPEN & APPROVED")
except Exception as e:
    errors.append(f"Status check failed: {e}")


# --- 4. SUMMARY AUDIT RESULT ---
print("\n" + "=" * 60)
print(f" AUDIT SUMMARY: {len(successes)} PASSED | {len(errors)} FAILED")
print("=" * 60)

for s in successes:
    print(f"  [PASS] {s}")

if errors:
    print("\nFAILURES DETECTED:")
    for err in errors:
        print(f"  [FAIL] {err}")
    sys.exit(1)
else:
    print("\n>>> ALL 11 AGENTS & ENDPOINTS ARE 100% OPERATIONAL AND PASSING! <<<")
    sys.exit(0)
