-- ============================================================================
-- FixIt — Migration 0028: official notices are admin-only to edit/delete
-- ----------------------------------------------------------------------------
-- Posting announcements is admin-only (announcements_insert requires is_admin),
-- but the UPDATE/DELETE policies allowed `is_admin() OR created_by = auth.uid()`.
-- Since created_by is captured at insert time, a user who posted as an admin and
-- was later demoted to Student kept the ability to edit/delete those official
-- notices via a direct API call. Gate both on is_admin() only, matching the
-- admin-controlled lifecycle (every author was an admin at insert anyway).
-- ============================================================================
drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete on public.announcements for delete to authenticated
  using (public.is_admin());
