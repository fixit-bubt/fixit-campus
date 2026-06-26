-- 0068 — Academic Calendar + Class/Exam Routines
--
-- Two read-by-all features the CampusOne client already queries on the shared
-- backend but that never had a migration (tables were created manually, schema
-- unknown to the repo). This defines them idempotently so a blank DB matches
-- production, matching the columns CampusOne reads.

-- ============================================================================
-- Academic Calendar — admin-curated dates (holidays, exams, semester, general)
-- ============================================================================
create table if not exists public.academic_calendar (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  event_date  date not null,
  end_date    date,
  event_type  text not null default 'general'
                check (event_type in ('holiday', 'exam', 'semester', 'general')),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists academic_calendar_date_idx on public.academic_calendar (event_date);

alter table public.academic_calendar enable row level security;
revoke all on public.academic_calendar from anon;
grant select, insert, update, delete on public.academic_calendar to authenticated;

-- Everyone signed in can read; only admins curate.
drop policy if exists academic_calendar_select on public.academic_calendar;
create policy academic_calendar_select on public.academic_calendar
  for select to authenticated using (true);

drop policy if exists academic_calendar_insert on public.academic_calendar;
create policy academic_calendar_insert on public.academic_calendar
  for insert to authenticated with check (public.is_admin());

drop policy if exists academic_calendar_update on public.academic_calendar;
create policy academic_calendar_update on public.academic_calendar
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists academic_calendar_delete on public.academic_calendar;
create policy academic_calendar_delete on public.academic_calendar
  for delete to authenticated using (public.is_admin());

-- ============================================================================
-- Routines — class / exam schedule files posted by staff or admin
-- ============================================================================
create table if not exists public.routines (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('class', 'exam')),
  title        text not null,
  department   text,
  semester     text,
  intake       text,
  section      text,
  file_url     text,
  image_url    text,
  published_by uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists routines_type_idx on public.routines (type);
create index if not exists routines_published_by_idx on public.routines (published_by);

alter table public.routines enable row level security;
revoke all on public.routines from anon;
grant select, insert, update, delete on public.routines to authenticated;

-- Everyone signed in can read. Staff/admin post (and must stamp themselves as the
-- publisher). The publisher or an admin can delete.
drop policy if exists routines_select on public.routines;
create policy routines_select on public.routines
  for select to authenticated using (true);

drop policy if exists routines_insert on public.routines;
create policy routines_insert on public.routines
  for insert to authenticated
  with check (public.is_staff_or_admin() and published_by = auth.uid());

drop policy if exists routines_delete on public.routines;
create policy routines_delete on public.routines
  for delete to authenticated
  using (published_by = auth.uid() or public.is_admin());

-- ============================================================================
-- Storage: routines bucket (public — routine PDFs / images)
-- Path convention enforced by the app: {user_id}/{uuid}.{ext}
-- ============================================================================
insert into storage.buckets (id, name, public) values
  ('routines', 'routines', true)
on conflict (id) do nothing;

drop policy if exists "routines: public read" on storage.objects;
create policy "routines: public read"
  on storage.objects for select
  using (bucket_id = 'routines');

drop policy if exists "routines: staff upload" on storage.objects;
create policy "routines: staff upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'routines'
    and public.is_staff_or_admin()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "routines: owner delete" on storage.objects;
create policy "routines: owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'routines' and owner = auth.uid());
