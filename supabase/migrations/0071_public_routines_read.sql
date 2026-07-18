-- ============================================================================
-- FixIt — Migration 0071: anon read for routines (public explore, phase 2)
-- ----------------------------------------------------------------------------
-- Class/exam routine files are campus-public notices. published_by (uuid of
-- the staff poster) stays authenticated-only via the column grant. The
-- routines storage bucket is already public (0068).
-- ============================================================================

grant select (id, type, title, department, semester, intake, section,
              file_url, image_url, created_at)
  on public.routines to anon;
create policy routines_anon_select on public.routines
  for select to anon using (true);
