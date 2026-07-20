-- ============================================================================
-- FixIt — Migration 0078: whole-app audit fixes (2026-07-21)
-- ----------------------------------------------------------------------------
-- Three server-side fixes surfaced by the full audit:
--   #1  Non-admin user directory returned only the caller's own row, because
--       public_profiles was flipped to security_invoker (0062/0066) while the
--       client still reads it — so under profiles RLS a non-admin sees only
--       themselves, blanking every cross-user name lookup (reporter, assigned
--       staff, club rosters, L&F poster/claimant). Fix WITHOUT weakening the
--       anon lockdown: a SECURITY DEFINER directory RPC that returns only safe
--       columns, callable by authenticated users. The client switches non-admin
--       reads to this RPC.
--   #4  The 'routines' storage bucket was never created in prod, so posting a
--       class routine WITH a file failed ("Bucket not found"). Create it +
--       an admin/staff insert policy (reads are public via the public bucket).
--   #13 jobs_update WITH CHECK omitted the club_can_post() guard that
--       jobs_insert has, letting a poster re-tag an existing listing to a club
--       they don't run (API-only trust-spoof). Add the guard.
-- ============================================================================

-- ── #1: safe directory RPC (definer; safe columns only) ──────────────────────
create or replace function public.directory_profiles()
returns table (id uuid, full_name text, role text, department text, avatar_url text)
language sql security definer set search_path = public stable as $$
  select id, full_name, role, department, avatar_url
  from public.profiles
  order by full_name;
$$;

revoke all     on function public.directory_profiles() from public, anon;
grant  execute on function public.directory_profiles() to authenticated;

-- ── #4: routines storage bucket (public read; admin/staff upload) ────────────
insert into storage.buckets (id, name, public)
values ('routines', 'routines', true)
on conflict (id) do nothing;

drop policy if exists routines_bucket_read   on storage.objects;
drop policy if exists routines_bucket_insert on storage.objects;
drop policy if exists routines_bucket_delete on storage.objects;

create policy routines_bucket_read on storage.objects
  for select to public
  using (bucket_id = 'routines');

create policy routines_bucket_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'routines'
    and (
      public.is_admin()
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'staff')
    )
  );

create policy routines_bucket_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'routines'
    and (
      public.is_admin()
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'staff')
    )
  );

-- ── #13: close the jobs_update club-tag hole ─────────────────────────────────
drop policy if exists jobs_update on public.jobs;
create policy jobs_update on public.jobs
  for update to authenticated
  using  (posted_by = auth.uid() and public.can_post_jobs() and deleted_at is null)
  with check (
    posted_by = auth.uid()
    and public.can_post_jobs()
    and (club_id is null or public.club_can_post(club_id))
  );
