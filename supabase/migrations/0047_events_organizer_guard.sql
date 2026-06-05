-- ============================================================================
-- FixIt — Migration 0047: events edit/delete require an ACTIVE organizer
-- ----------------------------------------------------------------------------
-- events_update / events_delete (0016) allowed `is_admin() OR created_by =
-- auth.uid()`. Because created_by is captured at insert time, an organizer who
-- created an event and was later removed from the organizer allowlist (demoted)
-- kept the ability to edit/delete that official event via a direct API call —
-- the same privilege-residue pattern already fixed for announcements (0028) and
-- attachments (0030).
--
-- Unlike announcements (admin-only), events are legitimately created by non-admin
-- organizers, so we don't go admin-only. Instead we require the creator to still
-- be an active organizer: is_admin() OR (created_by = auth.uid() AND
-- can_create_events()). An active organizer keeps managing their own events; a
-- demoted one loses edit/delete; admins always can.
-- ============================================================================
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (public.is_admin() or (created_by = auth.uid() and public.can_create_events()))
  with check (public.is_admin() or (created_by = auth.uid() and public.can_create_events()));

drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete to authenticated
  using (public.is_admin() or (created_by = auth.uid() and public.can_create_events()));
