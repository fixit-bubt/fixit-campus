-- ============================================================================
-- FixIt — Migration 0074: revoke stray anon grants on dashboard-created tables
-- ----------------------------------------------------------------------------
-- Audit 2026-07-18 found four tables created in the Supabase dashboard (not in
-- any migration) that carry blanket ALL-privileges grants to the anon role:
--   app_config      — holds push_secret (1 row); shielded today only by having
--                     no RLS policy, but anon still holds SELECT/INSERT/UPDATE/
--                     DELETE, so any future permissive policy would expose it
--   courses         — course catalog; actively anon-readable via a dashboard
--                     policy anyone_read_courses (role public) + the anon grant
--   push_tokens     — device push tokens + user_id
--   study_bookmarks — per-user bookmarks
--
-- Same class of issue 0072 fixed for routines/calendar/notifications. Revoke the
-- anon grants; authenticated grants and RLS policies are left untouched. Guarded
-- with to_regclass so a blank DB rebuilt from migrations (where these tables may
-- not exist) does not error.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'public.app_config',
    'public.courses',
    'public.push_tokens',
    'public.study_bookmarks'
  ] loop
    if to_regclass(t) is not null then
      execute format('revoke all on %s from anon', t);
    end if;
  end loop;
end $$;
