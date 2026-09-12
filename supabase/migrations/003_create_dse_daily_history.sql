create table if not exists public.dse_daily_history (
    id uuid primary key default gen_random_uuid(),
    trade_code text not null,
    trade_date date not null,
    open numeric,
    high numeric,
    low numeric,
    close numeric,
    volume bigint,
    value_mn numeric,
    source text,
    collected_at timestamptz default now(),
    
    constraint dse_daily_history_trade_code_date_key unique (trade_code, trade_date),
    constraint dse_daily_history_high_low_check check (high >= low),
    constraint dse_daily_history_open_check check (open > 0 or open is null),
    constraint dse_daily_history_high_check check (high > 0 or high is null),
    constraint dse_daily_history_low_check check (low > 0 or low is null),
    constraint dse_daily_history_close_check check (close > 0 or close is null),
    constraint dse_daily_history_volume_check check (volume >= 0 or volume is null)
);

alter table public.dse_daily_history enable row level security;
