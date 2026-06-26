-- 0067 — Notifications system (in-app notification center + per-sector preferences)
--
-- Two tables, already read by the CampusOne client on the shared backend but
-- never populated from client code. This migration (a) defines them idempotently
-- so a blank DB matches production, (b) adds the create_notification() helper
-- that respects per-user preferences, and (c) wires 1:1 triggers that actually
-- generate rows for connection / report / claim events. Broad fan-out events
-- (announcements, events) are intentionally NOT triggered here — one row per user
-- per event would explode the table; those can be added later if wanted.

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  sector         text not null,
  title          text not null,
  body           text not null default '',
  read           boolean not null default false,
  reference_id   uuid,
  reference_type text,
  created_at     timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read = false;

-- Per-user, per-sector preferences. The 'sector' column also stores two special
-- master rows: '_paused' (stop everything) and '_quiet' (quiet hours), which use
-- only the `enabled` flag. unique(user_id, sector) powers the client upsert.
create table if not exists public.notif_prefs (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  sector   text not null,
  enabled  boolean not null default true,
  push     boolean not null default true,
  email    boolean not null default false,
  inapp    boolean not null default true,
  unique (user_id, sector)
);

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.notifications enable row level security;
alter table public.notif_prefs   enable row level security;

revoke all on public.notifications from anon;
revoke all on public.notif_prefs   from anon;
grant select, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.notif_prefs to authenticated;

-- notifications: a user sees and mutates only their own. No client INSERT —
-- rows are created exclusively by create_notification() (SECURITY DEFINER below),
-- so a user can never forge a notification for someone else.
drop policy if exists notif_select_own on public.notifications;
create policy notif_select_own on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notif_update_own on public.notifications;
create policy notif_update_own on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notif_delete_own on public.notifications;
create policy notif_delete_own on public.notifications
  for delete using (user_id = auth.uid());

-- notif_prefs: full CRUD on own rows (the client upserts these).
drop policy if exists notif_prefs_select_own on public.notif_prefs;
create policy notif_prefs_select_own on public.notif_prefs
  for select using (user_id = auth.uid());

drop policy if exists notif_prefs_insert_own on public.notif_prefs;
create policy notif_prefs_insert_own on public.notif_prefs
  for insert with check (user_id = auth.uid());

drop policy if exists notif_prefs_update_own on public.notif_prefs;
create policy notif_prefs_update_own on public.notif_prefs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notif_prefs_delete_own on public.notif_prefs;
create policy notif_prefs_delete_own on public.notif_prefs
  for delete using (user_id = auth.uid());

-- ============================================================================
-- Helper: create_notification — the only writer. Honors the recipient's prefs:
--   * '_paused' master row enabled  -> drop silently
--   * per-sector row enabled = false -> drop silently
--   * no row for the sector          -> default ON (insert)
-- SECURITY DEFINER so triggers running as the acting user can still insert a row
-- owned by a different recipient.
-- ============================================================================

create or replace function public.create_notification(
  p_user_id        uuid,
  p_sector         text,
  p_title          text,
  p_body           text default '',
  p_reference_id   uuid default null,
  p_reference_type text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
begin
  if p_user_id is null then
    return;
  end if;

  -- master pause
  if exists (
    select 1 from notif_prefs
    where user_id = p_user_id and sector = '_paused' and enabled
  ) then
    return;
  end if;

  -- per-sector toggle (absent row = default on)
  select enabled into v_enabled
  from notif_prefs
  where user_id = p_user_id and sector = p_sector;
  if v_enabled is false then
    return;
  end if;

  insert into notifications (user_id, sector, title, body, reference_id, reference_type)
  values (p_user_id, p_sector, p_title, coalesce(p_body, ''), p_reference_id, p_reference_type);
end;
$$;

revoke execute on function public.create_notification(uuid, text, text, text, uuid, text) from anon;

-- ============================================================================
-- Triggers (all 1:1 — exactly one recipient per event, no fan-out)
-- ============================================================================

-- Connections: notify the addressee of a new request, and the requester when accepted.
create or replace function public.notify_connection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if tg_op = 'INSERT' then
    select full_name into v_name from profiles where id = new.requester_id;
    perform create_notification(
      new.addressee_id, 'directory',
      'New connection request',
      coalesce(v_name, 'A student') || ' wants to connect with you.',
      new.id, 'connection'
    );
  elsif tg_op = 'UPDATE'
      and new.status = 'accepted' and old.status is distinct from 'accepted' then
    select full_name into v_name from profiles where id = new.addressee_id;
    perform create_notification(
      new.requester_id, 'directory',
      'Connection accepted',
      coalesce(v_name, 'A student') || ' accepted your connection request.',
      new.id, 'connection'
    );
  end if;
  return null;
end;
$$;

drop trigger if exists notify_connection_trg on public.connections;
create trigger notify_connection_trg
  after insert or update on public.connections
  for each row execute function public.notify_connection();

-- Reports: notify the reporter on status change, and a staff member on assignment.
create or replace function public.notify_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- status change -> reporter
  if new.status is distinct from old.status then
    perform create_notification(
      new.reporter_id, 'reports',
      'Report ' || new.code || ' is now ' || new.status,
      'The status of your report changed to ' || new.status || '.',
      new.id, 'report'
    );
  end if;
  -- newly assigned -> assigned staff (skip if staff assigned their own report)
  if new.assigned_staff_id is distinct from old.assigned_staff_id
     and new.assigned_staff_id is not null
     and new.assigned_staff_id <> new.reporter_id then
    perform create_notification(
      new.assigned_staff_id, 'reports',
      'New report assigned to you',
      'Report ' || new.code || ' (' || new.category || ') was assigned to you.',
      new.id, 'report'
    );
  end if;
  return null;
end;
$$;

drop trigger if exists notify_report_trg on public.reports;
create trigger notify_report_trg
  after update on public.reports
  for each row execute function public.notify_report();

-- Claims: notify the claimant when their lost & found claim is decided.
create or replace function public.notify_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('Approved', 'Rejected') then
    perform create_notification(
      new.claimant_id, 'lostfound',
      'Your claim was ' || new.status,
      'Claim ' || new.code || ' was ' || lower(new.status) || '.',
      new.id, 'claim'
    );
  end if;
  return null;
end;
$$;

drop trigger if exists notify_claim_trg on public.claims;
create trigger notify_claim_trg
  after update on public.claims
  for each row execute function public.notify_claim();
