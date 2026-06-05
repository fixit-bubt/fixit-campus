-- ============================================================================
-- FixIt — Migration 0049: enforce ride seat capacity at the database
-- ----------------------------------------------------------------------------
-- requestSeat only inserts a ride_requests row; the "ride is full" check lived
-- only in the UI, so a direct API call — or two students racing for the last
-- seat — could overbook a ride past seats_total. Enforce it server-side with a
-- BEFORE INSERT trigger that locks the ride row (so concurrent requests for the
-- same ride serialize) and rejects once the seats are taken.
-- ============================================================================
create or replace function public.ride_capacity_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare cap int; taken int;
begin
  -- Lock the ride row: concurrent inserts for the same ride wait here, so the
  -- count below can't be stale (prevents a TOCTOU overbook of the last seat).
  select seats_total into cap from public.rides where id = new.ride_id for update;
  if cap is null then return new; end if; -- ride removed; let the FK handle it
  select count(*) into taken from public.ride_requests where ride_id = new.ride_id;
  if taken >= cap then
    raise exception 'This ride is full';
  end if;
  return new;
end;
$$;

create trigger ride_capacity_guard
  before insert on public.ride_requests
  for each row execute function public.ride_capacity_guard();

revoke execute on function public.ride_capacity_guard() from public, anon, authenticated;
