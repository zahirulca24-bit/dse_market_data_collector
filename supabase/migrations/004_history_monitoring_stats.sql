-- Aggregate historical monitoring inside Postgres so the API never has to
-- download the full dse_daily_history table or depend on a row ceiling.
create or replace function public.dse_history_monitoring_stats(
  p_start_date date,
  p_end_date date
)
returns table (
  trade_code text,
  earliest_date date,
  latest_date date,
  row_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    h.trade_code,
    min(h.trade_date) as earliest_date,
    max(h.trade_date) as latest_date,
    count(*)::bigint as row_count
  from public.dse_daily_history h
  where h.trade_date >= p_start_date
    and h.trade_date <= p_end_date
  group by h.trade_code
  order by h.trade_code;
$$;

create or replace function public.dse_history_total_rows()
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint from public.dse_daily_history;
$$;
