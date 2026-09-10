create extension if not exists pgcrypto;

create table if not exists public.dse_market_quotes (
    id uuid primary key default gen_random_uuid(),
    trade_code text not null,
    ltp numeric(18,4),
    high numeric(18,4),
    low numeric(18,4),
    close_price numeric(18,4),
    yesterday_close numeric(18,4),
    change numeric(18,4),
    trade_count bigint,
    value_mn numeric(20,4),
    volume bigint,
    snapshot_at timestamptz not null,
    source text not null default 'dsebd.org',
    created_at timestamptz not null default now(),
    constraint dse_market_quotes_trade_code_snapshot_key unique (trade_code, snapshot_at)
);

create index if not exists dse_market_quotes_snapshot_idx
    on public.dse_market_quotes (snapshot_at desc);

create index if not exists dse_market_quotes_trade_code_snapshot_idx
    on public.dse_market_quotes (trade_code, snapshot_at desc);

create table if not exists public.dse_collection_runs (
    id uuid primary key default gen_random_uuid(),
    source_url text not null,
    status text not null check (status in ('running', 'success', 'failed')),
    rows_collected integer not null default 0,
    error_message text,
    started_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists dse_collection_runs_started_idx
    on public.dse_collection_runs (started_at desc);

alter table public.dse_market_quotes enable row level security;
alter table public.dse_collection_runs enable row level security;

comment on table public.dse_market_quotes is 'Minute-level snapshots collected from the Dhaka Stock Exchange public market page.';
comment on table public.dse_collection_runs is 'Operational log for DSE collector executions.';
