-- ============================================================================
-- FixIt — Migration 0025: tighten report update guards
-- ----------------------------------------------------------------------------
-- The reports_update policy (0007) lets the assigned staff update the row, and
-- guard_report_update (0014) only protected reporter_id, assigned_staff_id, and
-- WHO may change status. Two gaps remained, both reachable by a direct API call:
--   • deleted_at was unguarded, so an assigned staff member could soft-delete
--     (hide) a report — beyond the documented "owner-while-Open" delete rule.
--   • the status state-machine wasn't enforced, so assigned staff could set
--     admin-only statuses (Rejected/Closed) or skip steps (Open->Resolved),
--     bypassing the staff workflow shown in the UI.
-- This re-creates the guard to (a) allow a deleted_at change only when the
-- reporter is soft-deleting their own still-Open report (admins exempt), and
-- (b) restrict assigned-staff status moves to Open->In Progress and
-- In Progress->Resolved. Admins keep full freedom via the early return.
-- ============================================================================
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
  -- Soft-delete: only the reporter, and only while still Open, may set/clear it.
  if new.deleted_at is distinct from old.deleted_at
     and not (old.reporter_id = auth.uid() and old.status = 'Open') then
    raise exception 'Only the reporter (while Open) or an admin can delete a report';
  end if;
  -- Status: only the assigned staff may change it, and only along the workflow.
  if new.status is distinct from old.status then
    if old.assigned_staff_id is null or old.assigned_staff_id <> auth.uid() then
      raise exception 'Only the assigned staff or an admin can change a report''s status';
    end if;
    if not (
         (old.status = 'Open' and new.status = 'In Progress')
      or (old.status = 'In Progress' and new.status = 'Resolved')
    ) then
      raise exception 'Assigned staff may only move Open->In Progress or In Progress->Resolved';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_report_update() from public, anon, authenticated;

-- The reports_guard_update trigger (0014) already calls this function by name.
