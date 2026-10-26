# 📈 DSE Market Data Collector & Dashboard

A Dhaka Stock Exchange (DSE) market-data collector and monitoring dashboard backed by Supabase.

## Current system

The repository currently contains:

- Python 3.12 / FastAPI collector API
- React + TypeScript monitoring dashboard
- live DSE market snapshot collection
- historical daily OHLCV collection
- Supabase persistence
- automatic historical backfill in 3-stock batches
- candlestick and volume visualization
- historical coverage and ingestion monitoring
- lightweight Render wake endpoint for external cron


## 🤖 Autonomous Multi-Agent Trading System (`/agents`)

The repository includes a comprehensive 11-agent autonomous intelligence and day-trading pipeline specifically engineered for the Dhaka Stock Exchange (DSE), accessible via the **"Analysis with Agent"** workspace (`/agents`):

| # | Agent Name | ID | Core Capability & DSE Integration |
|---|------------|----|-----------------------------------|
| 1 | **DSE Chart Setup Scanner** | `trader-scanner` | Scans 400+ DSE securities for 20D breakouts, bull flags, MA20 reclaims, and oversold bounces. |
| 2 | **Tactical Entry Planner** | `trader-entry` | Computes optimal limit order zones, pullback entry tiers, and breakout confirmation thresholds. |
| 3 | **Dynamic Exit & Target Agent** | `trader-exit` | Formulates 1:2 and 1:3 multi-tranche take-profit targets with ATR-based trailing stops. |
| 4 | **TimeMachine Replay Agent** | `trader-timemachine` | Runs Monte Carlo simulations and historical backtests across multiple DSE market regimes. |
| 5 | **Capital Risk & Exposure Guard** | `trader-risk` | Enforces single-stock portfolio allocation caps, circuit breaker guards, and sector concentration limits. |
| 6 | **Position Sizing & Budget Agent** | `trader-budget` | Calculates exact share purchase quantities using 4-way sizing constraints and Kelly criterion. |
| 7 | **Instant Alert & Notification Agent** | `trader-alerts` | Real-time BST market clock (10:00-14:20), Bangladesh holidays, and instant Telegram / Webhook dispatch. |
| 8 | **DSE Paper Trading Execution Broker** | `trader-broker` | High-fidelity virtual execution engine with ৳500K balance, 0.4% DSE brokerage fee, and bracket orders. |
| 9 | **Corporate Disclosures & News Agent** | `trader-news` | Connects directly to DSE Live News API (`dsebd.org/api/live/news`) for PSI, dividends, EPS growth, and board meetings. |
| 10 | **Financial Valuation & Analyst Agent** | `trader-analyst` | Computes Sector Median P/E discounts, P/B ratios, and Benjamin Graham Intrinsic Fair Values. |
| 11 | **Sponsor & Smart Money Flow Agent** | `trader-pelosi` | Tracks Sponsor/Director buy/sell filings (Form 1 & 2), monthly institutional ownership, and tight public floats. |

### Running the Multi-Agent System:

```bash
# 1. Run full 31-point system code-side audit:
python scripts/system_audit.py

# 2. Launch FastAPI Backend + Agent Engine:
.venv\Scripts\uvicorn.exe src.dse_collector.web:app --host 127.0.0.1 --port 8000 --reload

# 3. Launch React Dashboard:
pnpm --filter @workspace/dse-market-dashboard run dev
```

Visit **`http://localhost:5173/agents`** or **`http://127.0.0.1:8000/agents`** to interact with the multi-agent trading terminal.

### Telegram Live Signal Setup:

Add your Telegram credentials to your `.env` file to receive live breakout and price target alerts:

```env
TELEGRAM_BOT_TOKEN="your_bot_token_from_botfather"
TELEGRAM_CHAT_ID="your_chat_id_from_userinfobot"
```

## Data flow

```text
DSE public data source
        │
        ▼
Python / FastAPI collector
        │
        ├── Live market snapshot collection
        │
        └── Historical daily OHLCV backfill
                │
                ▼
             Supabase
                │
                ▼
        FastAPI read endpoints
                │
                ▼
      React monitoring dashboard
```

## Historical collection

Historical backfill is scheduler-driven.

- Internal scheduler interval: 120 seconds
- Batch size: 3 stocks per historical cycle
- Each selected stock is requested for the active historical period
- Results are upserted into `dse_daily_history`
- Historical run state is recorded in `dse_collection_runs`
- The collector progresses through available historical periods
- Periods outside the publicly available DSE archive window are skipped rather than repeatedly retried

The DSE public archive is a rolling source. The application should only present historical periods for which verified data is actually stored; unavailable older periods are not treated as application data.

## Render Free wake flow

On Render Free, the web service may spin down while idle. The application therefore exposes a lightweight endpoint:

```text
GET /api/wake
```

It returns only `ok`. It does not collect market data, write to Supabase, or require a collector secret.

The deployed setup can use an external scheduler such as cron-job.org every two minutes:

```text
cron-job.org
    │
    ▼
GET /api/wake
    │
    ▼
Render service remains awake
    │
    ▼
Internal 120-second historical scheduler runs
```

The wake request and the historical collection job are intentionally separate.

## Supabase tables

The collector currently relies on these core tables:

- `dse_market_quotes` — live/intraday market snapshots
- `dse_daily_history` — daily OHLCV historical records
- `dse_collection_runs` — live and historical run history/status
- `dse_collector_lock` — collector locking support

Daily historical records are uniquely identified by stock symbol and trade date.

## API overview

Public/read endpoints include:

```text
GET /health
GET /api/healthz
GET /api/wake
GET /api/market/overview
GET /api/market/stocks
GET /api/market/stocks/{symbol}/history
GET /api/market/stocks/{symbol}/daily-history
GET /api/market/monitoring
GET /api/market/ingestion
GET /api/market/ingestion/tracker
GET /api/market/ingestion/logs
```

Collector actions are protected and require the configured collector authorization secret:

```text
POST /api/collector/run
POST /api/collector/historical/run
GET  /api/collector/status
```

## Frontend

The React/TypeScript dashboard includes:

- Live Overview
- Historical Explorer
- Sector Mapping
- Ingestion Monitor
- searchable stock browser
- stored daily OHLCV candlestick chart
- volume visualization
- historical coverage monitoring
- mobile navigation

Frontend source:

```text
artifacts/dse-market-dashboard/
```

## Backend / collector

Collector source:

```text
src/dse_collector/
```

Important modules include:

```text
web.py          FastAPI application and internal scheduler
backfill.py     phased historical batch collection
storage.py      Supabase persistence/read helpers
dashboard.py    dashboard data shaping and monitoring
main.py         live collection entry point
config.py       environment configuration
```

## Environment configuration

Keep all secrets server-side. Typical collector configuration includes:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only secret>
CRON_SECRET=<collector-action secret>
COLLECTOR_INTERVAL_SECONDS=120
```

Never commit the Supabase service-role key, collector secret, database password, or other credentials to GitHub or expose them to the React browser bundle.

## Deployment model

Current production model:

```text
React dashboard + FastAPI web service
                │
              Render
                │
                ▼
             Supabase

cron-job.org ──GET /api/wake──► Render
```

The internal scheduler only runs while the Render process is awake.

## Data integrity principles

- Do not generate mock OHLCV data for missing DSE history.
- Do not show unavailable historical periods as if they exist.
- Upsert daily history by symbol + trade date.
- Keep service-role credentials server-side only.
- Keep manual collector actions protected.
- Treat the public DSE source availability window as an external limitation.

## Development workflow

Recommended repository workflow:

```text
Create branch
    ↓
Make scoped change
    ↓
Test / verify
    ↓
Commit
    ↓
Open pull request
    ↓
Review
    ↓
Merge
```

## Roadmap

Planned improvements include:

- authoritative DSE sector mapping
- scalable historical coverage aggregation
- scheduler/wake-state accuracy improvements
- database-driven historical range reporting
- stock detail page
- market movers
- data quality center
- historical coverage map
- CSV export center

## Purpose

The goal is to maintain a reliable DSE market-data foundation that can later serve the separate DSE Signal application without recollecting the same raw market history.

## License

MIT
