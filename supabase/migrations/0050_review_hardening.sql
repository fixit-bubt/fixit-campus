-- ============================================================================
-- FixIt — Migration 0050: defense-in-depth hardening (whole-project review)
-- ----------------------------------------------------------------------------
-- Three low-severity, additive hardening items from the project review. None
-- are exploitable today; they close parity gaps so a future change can't widen
-- into a hole.
--   [5]  Freeze owner FK / code / created_at on listings, rides, blood_requests
--        (parity with reports/claims) so an UPDATE can't reassign ownership.
--   [17] revoke execute on two guard trigger functions (they're trigger-only).
--   [18] study_section_grants is written only by the approval trigger — revoke
--        INSERT/UPDATE from authenticated so the trigger-only invariant holds at
--        the GRANT level, not just by the absence of a policy.
-- ============================================================================

-- ── [5] column-immutability guards ──────────────────────────────────────────
create or replace function public.guard_listing_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and (new.seller_id <> old.seller_id or new.code <> old.code or new.created_at <> old.created_at) then
    raise exception 'Cannot change owner, code, or created_at';
  end if;
  return new;
end;
$$;
create trigger guard_listing_columns before update on public.listings
  for each row execute function public.guard_listing_columns();

create or replace function public.guard_ride_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and (new.driver_id <> old.driver_id or new.code <> old.code or new.created_at <> old.created_at) then
    raise exception 'Cannot change owner, code, or created_at';
  end if;
  return new;
end;
$$;
create trigger guard_ride_columns before update on public.rides
  for each row execute function public.guard_ride_columns();

create or replace function public.guard_blood_request_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and (new.requester_id <> old.requester_id or new.code <> old.code or new.created_at <> old.created_at) then
    raise exception 'Cannot change owner, code, or created_at';
  end if;
  return new;
end;
$$;
create trigger guard_blood_request_columns before update on public.blood_requests
  for each row execute function public.guard_blood_request_columns();

revoke execute on function
  public.guard_listing_columns(), public.guard_ride_columns(), public.guard_blood_request_columns()
  from public, anon, authenticated;

-- ── [17] revoke execute on existing guard trigger functions (consistency) ────
revoke execute on function public.guard_connection_update() from public, anon, authenticated;
revoke execute on function public.guard_profile_columns()   from public, anon, authenticated;

-- ── [18] grants table is trigger-written only — drop client write privileges ─
-- SELECT (policy: members of either section) and DELETE (policy: CR of `to`)
-- remain; INSERT/UPDATE happen only via the SECURITY DEFINER approval trigger.
revoke insert, update on public.study_section_grants from authenticated;
