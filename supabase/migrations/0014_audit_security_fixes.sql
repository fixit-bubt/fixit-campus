-- ============================================================================
-- FixIt — Migration 0014: security fixes from the final audit
--  1. CRITICAL — connections: the addressee could rewrite requester_id when
--     accepting, forging a non-consensual "accepted" connection and stealing
--     the victim's contact. Make the parties + created_at immutable on UPDATE.
--  2. HIGH — reports: a reporter could self-assign + set any status in one
--     UPDATE, bypassing the workflow. Lock down who may change status /
--     reporter_id / assigned_staff_id.
--  3. HIGH — claims: the "one approved claim per item" rule was a non-atomic
--     check (TOCTOU). Back it with a partial unique index so two concurrent
--     approvals can't both succeed.
--  4. MEDIUM — profiles: a user could change their own id/email via the
--     table-wide UPDATE grant. Make id + email immutable here (managed by Auth).
-- ============================================================================

-- 1. connections: parties + created_at immutable -----------------------------
create or replace function public.guard_connection_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.requester_id is distinct from old.requester_id
     or new.addressee_id is distinct from old.addressee_id
     or new.created_at  is distinct from old.created_at then
    raise exception 'A connection''s parties cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists connections_guard_update on public.connections;
create trigger connections_guard_update
  before update on public.connections
  for each row execute function public.guard_connection_update();

-- 2. reports: only admins assign; only assigned staff/admin change status -----
create or replace function public.guard_report_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.reporter_id is distinct from old.reporter_id then
    raise exception 'A report''s reporter cannot be changed';
  end if;
  if new.assigned_staff_id is distinct from old.assigned_staff_id then
    raise exception 'Only an admin can change report assignment';
  end if;
  if new.status is distinct from old.status
     and (old.assigned_staff_id is null or old.assigned_staff_id <> auth.uid()) then
    raise exception 'Only the assigned staff or an admin can change a report''s status';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_report_update() from public, anon, authenticated;

drop trigger if exists reports_guard_update on public.reports;
create trigger reports_guard_update
  before update on public.reports
  for each row execute function public.guard_report_update();

-- 3. claims: at most one Approved claim per item (atomic) ---------------------
-- (Fails if an item already has 2+ Approved claims — none expected on fresh data.)
create unique index if not exists claims_one_approved_per_item
  on public.claims (item_id)
  where status = 'Approved';

-- 4. profiles: id + email are managed by Auth, not editable here --------------
create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id is distinct from old.id) or (new.email is distinct from old.email) then
    raise exception 'id and email are managed by the system and cannot be changed here';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_columns on public.profiles;
create trigger profiles_guard_columns
  before update on public.profiles
  for each row execute function public.guard_profile_columns();
