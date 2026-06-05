-- ============================================================================
-- FixIt — Migration 0031: faculty directory
-- ----------------------------------------------------------------------------
-- Adds a searchable, bookmarkable BUBT faculty directory for students.
--
-- Tables:
--   departments      — 13 BUBT departments (reference data, admin-managed)
--   faculty          — ~411 teaching faculty across all departments
--   faculty_bookmarks— per-user saved teachers (own-row RLS)
--
-- Seed data (departments + faculty rows) is in 0032_seed_faculty.sql.
--
-- Conventions mirrored from 0016+:
--   • uuid PKs + gen_random_uuid()
--   • created_at / updated_at + set_updated_at() trigger
--   • revoke anon → enable RLS → grant authenticated → policies
--   • reference data: authenticated SELECT + admin ALL
--   • user-owned join table: own-row SELECT / INSERT / DELETE
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ departments                                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  branch      text not null,          -- Engineering | Business | Science | Law | Arts & Humanities | Social Sciences
  dept_number text not null unique,   -- BUBT internal number (27, 35, …)
  chairman    text,
  created_at  timestamptz not null default now()
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ faculty                                                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create table public.faculty (
  id                 uuid primary key default gen_random_uuid(),
  department_id      uuid not null references public.departments (id) on delete cascade,
  name               text not null,
  designation        text not null,
  email              text,
  phone              text,                          -- populated for CSE only
  photo_url          text,
  research_interests text[] not null default '{}',
  qualifications     jsonb,                         -- JSON array of degree strings — CSE only
  on_leave           boolean not null default false,
  is_chairman        boolean not null default false,
  scholar_url        text,
  researchgate_url   text,
  linkedin_url       text,
  orcid_url          text,
  website_url        text,
  profile_url        text,                          -- original bubt.edu.bd page
  data_source        text not null default 'main_site'
                       check (data_source in ('cse_subdomain', 'main_site')),
  last_synced_at     timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index faculty_department_idx  on public.faculty (department_id);
create index faculty_research_gin    on public.faculty using gin (research_interests);
create index faculty_name_fts        on public.faculty using gin (to_tsvector('simple', name));

create trigger faculty_set_updated_at before update on public.faculty
  for each row execute function public.set_updated_at();

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ faculty_bookmarks  (student saves a teacher)                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create table public.faculty_bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  faculty_id uuid not null references public.faculty  (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, faculty_id)
);
create index faculty_bookmarks_user_idx on public.faculty_bookmarks (user_id);

-- ============================================================================
-- RLS
-- ============================================================================
revoke all on public.departments, public.faculty, public.faculty_bookmarks from anon;

alter table public.departments       enable row level security;
alter table public.faculty           enable row level security;
alter table public.faculty_bookmarks enable row level security;

grant select                 on public.departments       to authenticated;
grant select                 on public.faculty           to authenticated;
grant select, insert, delete on public.faculty_bookmarks to authenticated;

-- Departments: any authenticated user reads; admins manage.
create policy departments_select on public.departments
  for select to authenticated using (true);
create policy departments_admin_write on public.departments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Faculty: any authenticated user reads; admins manage.
create policy faculty_select on public.faculty
  for select to authenticated using (true);
create policy faculty_admin_write on public.faculty
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Bookmarks: own rows only.
create policy faculty_bookmarks_select on public.faculty_bookmarks
  for select to authenticated using (user_id = auth.uid());
create policy faculty_bookmarks_insert on public.faculty_bookmarks
  for insert to authenticated with check (user_id = auth.uid());
create policy faculty_bookmarks_delete on public.faculty_bookmarks
  for delete to authenticated using (user_id = auth.uid());
