create table if not exists public.dse_collector_lock (
    lock_name text primary key,
    owner text,
    locked_until timestamptz,
    updated_at timestamptz not null default now()
);

insert into public.dse_collector_lock (lock_name)
values ('main')
on conflict (lock_name) do nothing;

alter table public.dse_collection_runs
    add column if not exists trigger text not null default 'cron';

alter table public.dse_collection_runs
    drop constraint if exists dse_collection_runs_status_check;

alter table public.dse_collection_runs
    add constraint dse_collection_runs_status_check
    check (status in ('running', 'success', 'failed', 'skipped'));

create or replace function public.acquire_dse_collector_lock(
    p_owner text,
    p_ttl_seconds integer default 240
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    acquired boolean := false;
begin
    update public.dse_collector_lock
       set owner = p_owner,
           locked_until = now() + make_interval(secs => greatest(p_ttl_seconds, 30)),
           updated_at = now()
     where lock_name = 'main'
       and (locked_until is null or locked_until < now() or owner = p_owner)
    returning true into acquired;

    return coalesce(acquired, false);
end;
$$;

create or replace function public.release_dse_collector_lock(p_owner text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    released boolean := false;
begin
    update public.dse_collector_lock
       set owner = null,
           locked_until = null,
           updated_at = now()
     where lock_name = 'main'
       and owner = p_owner
    returning true into released;

    return coalesce(released, false);
end;
$$;

revoke all on function public.acquire_dse_collector_lock(text, integer) from public, anon, authenticated;
revoke all on function public.release_dse_collector_lock(text) from public, anon, authenticated;
grant execute on function public.acquire_dse_collector_lock(text, integer) to service_role;
grant execute on function public.release_dse_collector_lock(text) to service_role;

alter table public.dse_collector_lock enable row level security;
