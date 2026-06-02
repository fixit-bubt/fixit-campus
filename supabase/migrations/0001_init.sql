-- ============================================================================
-- FixIt — Migration 0001: core schema
-- Tables: profiles, reports, report_events, lost_found_items, claims
-- Adds keys, foreign keys, CHECK constraints, timestamps, auto-history,
-- and a trigger that creates a profile when a user signs up.
-- Row-Level Security policies are added separately in 0002_rls.sql.
-- ============================================================================

-- gen_random_uuid()
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Shared helper: keep updated_at fresh on every UPDATE
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- profiles  (one row per user, linked 1:1 to Supabase Auth)
-- ============================================================================
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  email       text not null,
  role        text not null default 'student'
                check (role in ('student', 'staff', 'admin')),
  department  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is
  'One row per user, linked to auth.users. Display name, role, department. Passwords live in Supabase Auth.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile when a new auth user signs up (default role: student)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    'student'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- reports  (a campus issue)
-- ============================================================================
create sequence if not exists public.report_code_seq start 1043;

create table public.reports (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique default ('R-' || nextval('public.report_code_seq')),
  category          text not null
                      check (category in ('Electrical','Plumbing','Cleanliness',
                                          'IT / Network','Furniture','Safety / Security','Other')),
  description       text not null check (char_length(description) >= 12),
  building          text not null,
  room              text,
  photo_url         text,
  status            text not null default 'Open'
                      check (status in ('Open','In Progress','Resolved','Rejected','Closed')),
  reporter_id       uuid not null references public.profiles (id) on delete cascade,
  assigned_staff_id uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index reports_reporter_idx       on public.reports (reporter_id);
create index reports_assigned_staff_idx on public.reports (assigned_staff_id);
create index reports_status_idx         on public.reports (status);

create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- ============================================================================
-- report_events  (status history — one row per change)
-- ============================================================================
create table public.report_events (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports (id) on delete cascade,
  status      text not null
                check (status in ('Open','In Progress','Resolved','Rejected','Closed')),
  note        text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index report_events_report_idx on public.report_events (report_id);

-- Automatically log an event on creation and on every status change
create or replace function public.log_report_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.report_events (report_id, status, created_by)
    values (new.id, new.status, new.reporter_id);
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.report_events (report_id, status, created_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger reports_log_event
  after insert or update on public.reports
  for each row execute function public.log_report_event();

-- ============================================================================
-- lost_found_items  (a lost/found post)
-- ============================================================================
create sequence if not exists public.item_code_seq start 302;

create table public.lost_found_items (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique default ('I-' || nextval('public.item_code_seq')),
  type         text not null check (type in ('Lost','Found')),
  title        text not null,
  category     text not null check (category in ('Personal','Electronics','Documents','Other')),
  description  text not null,
  location     text not null,
  item_date    date not null,
  photo_url    text,
  status       text not null default 'Open' check (status in ('Open','Resolved')),
  poster_id    uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index items_poster_idx on public.lost_found_items (poster_id);
create index items_type_idx   on public.lost_found_items (type);

create trigger items_set_updated_at
  before update on public.lost_found_items
  for each row execute function public.set_updated_at();

-- ============================================================================
-- claims  (claim / notify on an item + admin decision)
-- ============================================================================
create sequence if not exists public.claim_code_seq start 52;

create table public.claims (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique default ('C-' || nextval('public.claim_code_seq')),
  item_id      uuid not null references public.lost_found_items (id) on delete cascade,
  claimant_id  uuid not null references public.profiles (id) on delete cascade,
  kind         text not null check (kind in ('claim','notify')),
  message      text not null check (char_length(message) >= 10),
  proof_url    text,
  status       text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  decided_by   uuid references public.profiles (id) on delete set null,
  decided_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index claims_item_idx     on public.claims (item_id);
create index claims_claimant_idx on public.claims (claimant_id);
create index claims_status_idx   on public.claims (status);

create trigger claims_set_updated_at
  before update on public.claims
  for each row execute function public.set_updated_at();

-- ============================================================================
-- End of 0001. After running this, the tables exist but are LOCKED
-- (Row-Level Security on, no policies yet) — that is intentional and safe.
-- Run 0002_rls.sql next to open them up with per-role rules.
-- ============================================================================
