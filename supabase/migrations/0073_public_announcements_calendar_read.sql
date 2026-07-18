-- ============================================================================
-- FixIt — Migration 0073: anon read for announcements + academic calendar
-- ----------------------------------------------------------------------------
-- Phase 3 of "browse without login": official notices and academic dates are
-- campus-public. created_by (poster uuid) stays authenticated-only via the
-- column grant, so anon select('*') fails and public screens list columns.
-- Verified beforehand: neither table had any pre-existing anon grant.
-- ============================================================================

grant select (id, code, title, body, department, priority, pinned,
              attachment_url, created_at, updated_at)
  on public.announcements to anon;
create policy announcements_anon_select on public.announcements
  for select to anon using (true);

grant select (id, title, description, event_date, end_date, event_type,
              created_at)
  on public.academic_calendar to anon;
create policy academic_calendar_anon_select on public.academic_calendar
  for select to anon using (true);
