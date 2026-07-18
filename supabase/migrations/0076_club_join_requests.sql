-- ============================================================================
-- FixIt — Migration 0076: club join requests (self-serve membership)
-- ----------------------------------------------------------------------------
-- Students could only be added to a club by an officer (0053 forbids
-- self-insert into club_members). This adds a request flow: a student files a
-- request, a president/VP (or admin) approves — the approval inserts the
-- member row client-side (allowed by 0053's manager-insert policy) and marks
-- the request. A trigger notifies the requester of the decision (sector
-- 'clubs'), inserting into notifications directly with the same inline
-- notif_prefs checks as 0075 (prod has no create_notification helper).
-- ============================================================================

create table public.club_join_requests (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  message     text not null default '',
  status      text not null default 'pending' check (status in ('pending','approved','denied')),
  decided_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);

create index club_join_requests_club_idx on public.club_join_requests (club_id);
create index club_join_requests_user_idx on public.club_join_requests (user_id);
-- One live request per user per club; history of decided ones is kept.
create unique index club_join_requests_pending_uni
  on public.club_join_requests (club_id, user_id) where status = 'pending';

revoke all on public.club_join_requests from anon;
alter table public.club_join_requests enable row level security;
grant select, insert, update, delete on public.club_join_requests to authenticated;

-- Requester sees their own; officers see their club's; admins see all.
create policy cjr_select on public.club_join_requests
  for select to authenticated
  using (user_id = auth.uid() or public.club_can_manage(club_id) or public.is_admin());

-- A student files their own request for a club they're not already in.
create policy cjr_insert on public.club_join_requests
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and not public.club_is_member(club_id)
  );

-- Officers/admins decide; a request can only move off 'pending'.
create policy cjr_update on public.club_join_requests
  for update to authenticated
  using  (status = 'pending' and (public.club_can_manage(club_id) or public.is_admin()))
  with check (status in ('approved','denied') and decided_by = auth.uid());

-- Requester can withdraw a pending request.
create policy cjr_delete on public.club_join_requests
  for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');

-- Notify the requester when their request is decided.
create or replace function public.notify_club_request_decided()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club text;
begin
  if new.status = old.status or new.status = 'pending' then
    return new;
  end if;
  if exists (select 1 from notif_prefs where user_id = new.user_id and sector = '_paused' and enabled) then
    return new;
  end if;
  if coalesce((select enabled from notif_prefs where user_id = new.user_id and sector = 'clubs'), true) is false then
    return new;
  end if;
  select name into v_club from clubs where id = new.club_id;
  insert into notifications (user_id, sector, title, body, reference_id, reference_type)
  values (
    new.user_id,
    'clubs',
    case when new.status = 'approved'
      then 'Welcome to ' || coalesce(v_club, 'the club') || '!'
      else 'Update on your ' || coalesce(v_club, 'club') || ' request' end,
    case when new.status = 'approved'
      then 'Your join request was approved — you are now a member.'
      else 'Your join request was not approved this time.' end,
    new.club_id,
    'club'
  );
  return new;
end;
$$;

revoke execute on function public.notify_club_request_decided() from public, anon;

create trigger club_request_decided_notify
  after update on public.club_join_requests
  for each row execute function public.notify_club_request_decided();
