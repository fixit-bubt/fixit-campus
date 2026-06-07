-- ============================================================================
-- FixIt — Migration 0060: ride expiry + lifetime ride count stat
-- ----------------------------------------------------------------------------
-- 1. Rides auto-expire: 8 hrs after posting for one-way, 12 hrs for recurring.
--    A trigger sets expires_at on insert. A SECURITY DEFINER RPC (called by
--    the client on every rides load) deletes rows whose expires_at has passed.
-- 2. app_stats table records a running rides_posted counter so the total is
--    preserved even after old rows are deleted.
-- ============================================================================

-- ---- 1. expires_at on rides ------------------------------------------------
alter table public.rides add column if not exists expires_at timestamptz;

create or replace function public.set_ride_expires_at()
returns trigger language plpgsql as $$
begin
  if new.expires_at is null then
    -- Recurring rides get 12 hours; one-way rides get 8 hours.
    if new.recurring is not null and cardinality(new.recurring) > 0 then
      new.expires_at := now() + interval '12 hours';
    else
      new.expires_at := now() + interval '8 hours';
    end if;
  end if;
  return new;
end;
$$;

create trigger rides_set_expires_at
  before insert on public.rides
  for each row execute function public.set_ride_expires_at();

-- RPC: delete all rides whose expiry has passed (runs as postgres, called by
-- any authenticated client on page load — "lazy deletion" pattern).
create or replace function public.delete_expired_rides()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.rides where expires_at is not null and expires_at < now();
end;
$$;

revoke all on function public.delete_expired_rides() from anon;
grant execute on function public.delete_expired_rides() to authenticated;

-- ---- 2. app_stats (running counters) ---------------------------------------
create table if not exists public.app_stats (
  key        text primary key,
  value      bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.app_stats enable row level security;
revoke all on public.app_stats from anon;
grant select on public.app_stats to authenticated;

create policy app_stats_select on public.app_stats
  for select to authenticated using (true);

-- Seed rides_posted with the current ride count (so history is preserved).
insert into public.app_stats (key, value)
  values ('rides_posted', (select count(*) from public.rides))
  on conflict (key) do nothing;

-- Trigger: increment rides_posted whenever a ride is inserted.
create or replace function public.increment_rides_posted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_stats (key, value, updated_at)
    values ('rides_posted', 1, now())
    on conflict (key) do update
      set value = app_stats.value + 1, updated_at = now();
  return new;
end;
$$;

create trigger rides_increment_counter
  after insert on public.rides
  for each row execute function public.increment_rides_posted();
