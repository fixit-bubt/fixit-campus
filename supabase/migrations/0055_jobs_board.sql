-- ============================================================================
-- FixIt — Migration 0055: Jobs & Internships board
-- ----------------------------------------------------------------------------
-- A campus-wide board where verified posters share opportunities and every
-- signed-in user can browse them.
--
-- Design rules:
--   • Public to campus — any signed-in user reads ACTIVE listings.
--   • Posting is gated by can_post_jobs(): admin, an event organizer, OR a club
--     president/VP (mirrors can_create_events, so "anyone who can post an Event
--     can post a Job"). A listing may be tagged to a club the poster runs.
--   • Auto-expiry is computed on the client from `deadline` (Dhaka time) — no
--     cron. The deadline-not-in-the-past rule lives in the INSERT policy, NOT a
--     table CHECK, so a row never becomes un-editable once its deadline passes.
--   • Moderation: soft-delete via `deleted_at` (house convention). Posters
--     withdraw their own listing; admins remove (with a reason) or restore.
--     These run through SECURITY DEFINER RPCs (matching the Club Hub RPCs) so
--     the moderation columns can't be written by a direct UPDATE.
--   • Reporting: any user flags a listing that isn't theirs (one per user);
--     only admins read the reports (the moderation queue).
--
-- Tables:    jobs, job_reports
-- Helper:    can_post_jobs()
-- RPCs:      job_withdraw(), job_admin_remove(), job_admin_restore(), job_report()
-- Storage:   job-circulars (public — application PDFs)
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0. Storage bucket                                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Circulars are public (the whole point is to be reachable). Upload is gated to
-- people who may post jobs; download is open.
insert into storage.buckets (id, name, public) values
  ('job-circulars', 'job-circulars', true)
on conflict (id) do nothing;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. can_post_jobs() — who may publish a listing                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Same shape as can_create_events(): admin OR event_organizers OR club officer.
create or replace function public.can_post_jobs()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.event_organizers where user_id = auth.uid())
      or exists (select 1 from public.club_members
                 where user_id = auth.uid() and role in ('president','vp'));
$$;
revoke execute on function public.can_post_jobs() from public, anon;
grant  execute on function public.can_post_jobs() to authenticated;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. jobs — one row per opportunity                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create sequence if not exists public.job_code_seq start 1001;

create table public.jobs (
  id              uuid        primary key default gen_random_uuid(),
  code            text        not null unique default ('JOB-' || nextval('public.job_code_seq')),
  title           text        not null check (char_length(title) >= 3),
  company         text        not null check (char_length(company) >= 2),
  job_type        text        not null check (job_type in ('internship','part_time','full_time')),
  location        text        not null check (char_length(location) >= 2),
  work_mode       text        not null default 'onsite' check (work_mode in ('onsite','remote','hybrid')),
  description     text        not null check (char_length(description) >= 10),
  requirements    text,
  stipend         text,
  deadline        date        not null,
  apply_method    text        not null check (apply_method in ('link','email','file')),
  apply_value     text,                    -- url or email (null when method = file)
  apply_file_url  text,                    -- public URL in job-circulars (null otherwise)
  apply_file_name text,
  posted_by       uuid        not null references public.profiles (id) on delete cascade,
  posted_by_name  text        not null,    -- snapshot, so attribution always renders
  club_id         uuid        references public.clubs (id) on delete set null,
  deleted_at      timestamptz,             -- soft-delete marker (withdrawn / removed)
  removed_by      uuid        references public.profiles (id) on delete set null,
  removed_reason  text,                    -- set only on admin removal
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- exactly one apply payload, matching the chosen method
  constraint jobs_apply_payload_ck check (
    (apply_method = 'file' and apply_file_url is not null and apply_value is null)
    or (apply_method in ('link','email') and apply_value is not null and apply_file_url is null)
  )
);

create index jobs_active_idx   on public.jobs (created_at desc) where deleted_at is null;
create index jobs_deadline_idx on public.jobs (deadline);
create index jobs_club_idx     on public.jobs (club_id);

-- bump updated_at on edit
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- Immutability + moderation-column guard. code/owner/created_at are never
-- writable; the soft-delete columns are writable only by the RPCs below, which
-- flip a transaction-local flag before their UPDATE.
create or replace function public.guard_jobs_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.code <> old.code or new.posted_by <> old.posted_by or new.created_at <> old.created_at then
    raise exception 'Cannot change code, owner, or created date.';
  end if;
  if (new.deleted_at     is distinct from old.deleted_at
      or new.removed_by  is distinct from old.removed_by
      or new.removed_reason is distinct from old.removed_reason)
     and coalesce(current_setting('app.jobs_mod', true), '') <> 'on' then
    raise exception 'Listings are withdrawn or removed through the proper action.';
  end if;
  return new;
end;
$$;
create trigger jobs_guard_columns
  before update on public.jobs
  for each row execute function public.guard_jobs_columns();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. job_reports — user flags (admin-only read)                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create table public.job_reports (
  id          uuid        primary key default gen_random_uuid(),
  job_id      uuid        not null references public.jobs (id) on delete cascade,
  reporter_id uuid        not null references public.profiles (id) on delete cascade,
  reason      text        not null check (reason in ('spam','scam','expired','inappropriate','other')),
  note        text,
  created_at  timestamptz not null default now(),
  unique (job_id, reporter_id)             -- one report per user per listing
);
create index job_reports_job_idx on public.job_reports (job_id);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. RLS — jobs                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- SELECT  — any signed-in user sees ACTIVE listings; admins also see removed.
-- INSERT  — allowlisted poster, as self; club tag must be a club they run;
--           deadline can't be in the past; can't create pre-removed.
-- UPDATE  — the poster, while still allowed to post (content edits only — the
--           guard trigger blocks moderation columns here). Removed listings are
--           invisible to the poster (SELECT), so they can't be edited.
-- DELETE  — admin only (hard delete; withdraw/remove are soft, via RPC).
revoke all on public.jobs from anon;
alter table public.jobs enable row level security;
grant select, insert, update, delete on public.jobs to authenticated;

create policy jobs_select on public.jobs
  for select to authenticated
  using (deleted_at is null or public.is_admin());

create policy jobs_insert on public.jobs
  for insert to authenticated
  with check (
    posted_by = auth.uid()
    and public.can_post_jobs()
    and (club_id is null or public.club_can_post(club_id))
    and deadline >= (now() at time zone 'Asia/Dhaka')::date
    and deleted_at is null
  );

-- content edits only, by the poster, while still allowed to post and the
-- listing is active (removed listings are invisible to the poster via SELECT;
-- this is the matching defense-in-depth on UPDATE).
create policy jobs_update on public.jobs
  for update to authenticated
  using  (posted_by = auth.uid() and public.can_post_jobs() and deleted_at is null)
  with check (posted_by = auth.uid() and public.can_post_jobs());

create policy jobs_delete on public.jobs
  for delete to authenticated
  using (public.is_admin());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. RLS — job_reports                                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Read: admins only. Writes go exclusively through job_report() (SECURITY
-- DEFINER), so no INSERT grant/policy is exposed to clients. Admins may clear.
revoke all on public.job_reports from anon;
alter table public.job_reports enable row level security;
grant select, delete on public.job_reports to authenticated;

create policy job_reports_select on public.job_reports
  for select to authenticated using (public.is_admin());

create policy job_reports_delete on public.job_reports
  for delete to authenticated using (public.is_admin());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. Moderation + reporting RPCs                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Poster withdraws their own active listing (soft-delete; no reason).
create or replace function public.job_withdraw(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.jobs_mod', 'on', true);
  update public.jobs
     set deleted_at = now()
   where code = p_code and posted_by = auth.uid() and deleted_at is null;
  if not found then raise exception 'Listing not found or not yours.'; end if;
end;
$$;
revoke execute on function public.job_withdraw(text) from public, anon;
grant  execute on function public.job_withdraw(text) to authenticated;

-- Admin removes a listing with a reason (idempotent on deleted_at).
create or replace function public.job_admin_remove(p_code text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  perform set_config('app.jobs_mod', 'on', true);
  update public.jobs
     set deleted_at = coalesce(deleted_at, now()),
         removed_by = auth.uid(),
         removed_reason = nullif(btrim(p_reason), '')
   where code = p_code;
  if not found then raise exception 'Listing not found.'; end if;
end;
$$;
revoke execute on function public.job_admin_remove(text, text) from public, anon;
grant  execute on function public.job_admin_remove(text, text) to authenticated;

-- Admin restores a removed listing.
create or replace function public.job_admin_restore(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  perform set_config('app.jobs_mod', 'on', true);
  update public.jobs
     set deleted_at = null, removed_by = null, removed_reason = null
   where code = p_code;
  if not found then raise exception 'Listing not found.'; end if;
end;
$$;
revoke execute on function public.job_admin_restore(text) from public, anon;
grant  execute on function public.job_admin_restore(text) to authenticated;

-- Any signed-in user flags a listing that isn't theirs. UNIQUE(job_id,
-- reporter_id) makes a second report surface as 23505 → "already reported".
create or replace function public.job_report(p_code text, p_reason text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_job public.jobs;
begin
  select * into v_job from public.jobs where code = p_code;
  if v_job.id is null then raise exception 'Listing not found.'; end if;
  if v_job.deleted_at is not null then raise exception 'This listing is no longer available.'; end if;
  if v_job.posted_by = auth.uid() then raise exception 'You can''t report your own listing.'; end if;
  if p_reason not in ('spam','scam','expired','inappropriate','other') then raise exception 'Invalid reason.'; end if;
  insert into public.job_reports (job_id, reporter_id, reason, note)
    values (v_job.id, auth.uid(), p_reason, nullif(btrim(p_note), ''));
end;
$$;
revoke execute on function public.job_report(text, text, text) from public, anon;
grant  execute on function public.job_report(text, text, text) to authenticated;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. Storage policies — job-circulars                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Path convention enforced by the app: {user_id}/{uuid}.pdf
-- (storage.foldername(name))[1] = user_id (first path segment).
create policy "job-circulars: public read"
  on storage.objects for select
  using (bucket_id = 'job-circulars');

create policy "job-circulars: poster upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'job-circulars'
    and public.can_post_jobs()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "job-circulars: owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'job-circulars' and owner = auth.uid());

-- ============================================================================
-- End of migration 0055
-- ============================================================================
