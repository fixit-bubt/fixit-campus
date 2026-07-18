-- ============================================================================
-- FixIt — Migration 0072: tighten legacy anon grants on dashboard-created tables
-- ----------------------------------------------------------------------------
-- routines / academic_calendar / notifications / notif_prefs were created
-- manually in the dashboard (see 0067/0068 headers), which hands anon a full
-- table grant (SELECT/INSERT/UPDATE on every column). RLS was always on, and
-- no anon write policy exists, so nothing was writable — but once 0071 added
-- the anon read policy for routines, the broad grant exposed published_by too.
-- Reset anon to exactly the 0071 column list; the other three tables get no
-- anon grants at all.
-- ============================================================================

revoke all on public.routines from anon;
grant select (id, type, title, department, semester, intake, section,
              file_url, image_url, created_at)
  on public.routines to anon;

revoke all on public.academic_calendar from anon;
revoke all on public.notifications     from anon;
revoke all on public.notif_prefs       from anon;
