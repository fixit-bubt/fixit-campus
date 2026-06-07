-- ============================================================================
-- FixIt — Migration 0056: Job bookmarks (save a listing)
-- ----------------------------------------------------------------------------
-- Lets a signed-in user save listings to a personal shortlist. Powers the
-- "Saved Jobs" view and the in-app deadline reminder (saved listings closing
-- soon are surfaced on the Saved view + the dashboard widget — computed on the
-- client in Dhaka time; no cron/notification infra needed).
--
-- Mirrors faculty_bookmarks / saved_bus_routes: a thin join table, every row
-- private to its owner.
-- ============================================================================

create table public.job_bookmarks (
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  job_id     uuid        not null references public.jobs (id)     on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index job_bookmarks_user_idx on public.job_bookmarks (user_id);

-- RLS — a bookmark is visible/writable only by its owner.
revoke all on public.job_bookmarks from anon;
alter table public.job_bookmarks enable row level security;
grant select, insert, delete on public.job_bookmarks to authenticated;

create policy job_bookmarks_select on public.job_bookmarks
  for select to authenticated using (user_id = auth.uid());

create policy job_bookmarks_insert on public.job_bookmarks
  for insert to authenticated with check (user_id = auth.uid());

create policy job_bookmarks_delete on public.job_bookmarks
  for delete to authenticated using (user_id = auth.uid());

-- ============================================================================
-- End of migration 0056
-- ============================================================================
