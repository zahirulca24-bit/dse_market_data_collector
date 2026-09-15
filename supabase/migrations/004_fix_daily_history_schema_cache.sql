-- Run this in your Supabase Dashboard → SQL Editor
-- This drops and recreates the dse_daily_history table
-- so that PostgREST automatically picks it up in the schema cache.

DROP TABLE IF EXISTS public.dse_daily_history;

CREATE TABLE public.dse_daily_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_code text NOT NULL,
    trade_date date NOT NULL,
    open numeric,
    high numeric,
    low numeric,
    close numeric,
    volume bigint,
    value_mn numeric,
    source text,
    collected_at timestamptz DEFAULT now(),
    CONSTRAINT dse_daily_history_trade_code_date_key UNIQUE (trade_code, trade_date),
    CONSTRAINT dse_daily_history_high_low_check CHECK (high >= low),
    CONSTRAINT dse_daily_history_open_check CHECK (open > 0 OR open IS NULL),
    CONSTRAINT dse_daily_history_high_check CHECK (high > 0 OR high IS NULL),
    CONSTRAINT dse_daily_history_low_check CHECK (low > 0 OR low IS NULL),
    CONSTRAINT dse_daily_history_close_check CHECK (close > 0 OR close IS NULL),
    CONSTRAINT dse_daily_history_volume_check CHECK (volume >= 0 OR volume IS NULL)
);

GRANT ALL ON public.dse_daily_history TO anon, authenticated, service_role;
ALTER TABLE public.dse_daily_history ENABLE ROW LEVEL SECURITY;

-- Verify
SELECT COUNT(*) AS total_rows FROM public.dse_daily_history;
