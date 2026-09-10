# DSE Market Data Collector

A request-triggered Dhaka Stock Exchange market-data collector designed for Render + Supabase.

## Architecture

External scheduler (cron-job.org or Supabase Cron) -> Render HTTP endpoint -> one collector run -> Supabase.

There is no infinite Python loop and no background worker. Each authenticated request runs the collector once and exits.

## API

- `GET /health` - public Render health check
- `GET /api/collector/status` - latest collector run; Bearer auth required
- `POST /api/collector/run` - execute one collector cycle; Bearer auth required

Authentication header:

```text
Authorization: Bearer YOUR_CRON_SECRET
```

The collector is idempotent at `trade_code + snapshot_at` and uses a Supabase-backed lock to prevent overlapping runs.

## Supabase setup

Apply migrations in order:

1. `supabase/migrations/001_create_dse_market_tables.sql`
2. `supabase/migrations/002_collector_lock_and_status.sql`

Required Render secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

See `.env.example` for optional settings.

## Render deploy

The repository contains `render.yaml`. Create a Render Blueprint/Web Service from this repository and provide the three required secrets.

Render starts:

```bash
uvicorn dse_collector.web:app --host 0.0.0.0 --port $PORT --app-dir src
```

## Scheduler

Configure cron-job.org or Supabase Cron to call:

```text
POST https://YOUR-RENDER-SERVICE.onrender.com/api/collector/run
Authorization: Bearer YOUR_CRON_SECRET
```

Recommended cadence during the market session: every 5 minutes.

Default market guard:

- timezone: `Asia/Dhaka`
- days: Sunday-Thursday
- window: `10:00-14:10`

Requests outside that window are logged as `skipped`. Change the environment variables if DSE trading hours change.

## Manual test

To force a collection outside the configured trading window:

```text
POST /api/collector/run?force=true
```

Use the same Bearer token. `force=true` is intended for deployment/testing only.

## Local CLI

```bash
pip install -r requirements.txt
PYTHONPATH=src python -m dse_collector.main
```

CLI mode forces a single run and does not start a loop.
