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
