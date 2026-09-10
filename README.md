# DSE Market Data Collector

A lightweight Python collector that fetches the Dhaka Stock Exchange latest-share-price table, normalizes market quotes, and stores minute-level snapshots in Supabase.

## Architecture

`DSE public market page -> HTTP collector -> HTML parser -> normalized quotes -> Supabase`

The collector also writes an operational record for every run so failed collections are visible in `dse_collection_runs`.

## Collected fields

- trading code
- last traded price (LTP)
- high / low
- close price
- yesterday close
- change
- number of trades
- value in million BDT
- volume
- UTC snapshot timestamp

## Repository layout

```text
.github/workflows/collect.yml       scheduled GitHub Actions collector
src/dse_collector/config.py         environment configuration
src/dse_collector/parser.py         DSE HTML parser and normalizer
src/dse_collector/storage.py        Supabase persistence layer
src/dse_collector/main.py           one-shot collector engine
supabase/migrations/                database schema
```

## Supabase setup

Apply `supabase/migrations/001_create_dse_market_tables.sql` to the Supabase project that will hold DSE data.

Add these GitHub repository secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not expose the service-role key in frontend code or commit it to Git.

## Local run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# fill in Supabase credentials
PYTHONPATH=src python -m dse_collector.main
```

## Schedule

GitHub Actions is configured to run every 5 minutes during the current DSE trading/post-closing window, Sunday through Thursday, using UTC cron expressions corresponding to 10:00-14:10 Asia/Dhaka.

The DSE website is an external HTML source rather than a versioned API. If DSE changes the table markup or endpoint, the parser/source configuration may need to be updated.
