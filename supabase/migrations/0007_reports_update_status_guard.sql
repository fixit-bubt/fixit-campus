-- ============================================================================
-- FixIt — Migration 0007: reporters can't change their report's status
-- The reports_update policy let the reporter edit while status='Open' (USING),
-- but its WITH CHECK didn't re-require 'Open' — so a reporter could set their
-- own Open report to Resolved/Closed/etc, bypassing the staff workflow.
-- Adding status='Open' to the reporter branch of WITH CHECK closes that:
-- reporters may edit fields / soft-delete only while it stays Open; all real
-- status transitions remain with the assigned staff and admins.
-- ============================================================================

drop policy if exists reports_update on public.reports;

create policy reports_update on public.reports for update to authenticated
  using (
    public.is_admin()
    or (reporter_id = auth.uid() and status = 'Open')
    or assigned_staff_id = auth.uid()
  )
  with check (
    public.is_admin()
    or (reporter_id = auth.uid() and status = 'Open')
    or assigned_staff_id = auth.uid()
  );
