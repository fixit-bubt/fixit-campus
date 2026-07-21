-- ============================================================================
-- FixIt — Migration 0079: Campus Issues board (anonymous public report feed)
-- ----------------------------------------------------------------------------
-- Adds a campus-wide, ANONYMOUS board so students can see issues others have
-- already reported and add a "me too" instead of filing a duplicate. Reports
-- stay private-by-design: the base reports_select policy (0002) is UNTOUCHED,
-- so a normal client still reads only its own / assigned / admin rows. The
-- board is served ONLY through the campus_issues_feed() SECURITY DEFINER RPC,
-- which returns safe columns only (NEVER reporter_id / assigned_staff_id) for
-- reports that (a) opted in (show_on_board), (b) are not soft-deleted,
-- (c) are not in the 'Safety / Security' category, and (d) are not Rejected.
--
-- "Me too" votes live in report_votes (one row per user per report, mirrors
-- job_bookmarks/0056). Vote rows are private to their owner under RLS; the
-- public count and the caller's own vote state are exposed only through the
-- RPCs, so no one can read who voted. All vote writes go through
-- toggle_report_vote() so board-eligibility is enforced server-side.
-- ============================================================================

-- 1. Opt-in flag on reports. Default FALSE, so the board is strictly OPT-IN:
--    adding the column hides every PRE-EXISTING report — they predate the board
--    and their reporters never consented to a campus-wide broadcast. Only reports
--    whose reporter opts in (on the report form, or via the RPC in step 6) are
--    ever shown, and Safety / Security is excluded unconditionally by the feed.
alter table public.reports
  add column if not exists show_on_board boolean not null default false;

-- Note: reports_update (0007) only lets a reporter update their own report while
-- status = 'Open'. Opting a report IN/OUT of the board at ANY status is done via
-- set_report_board_visibility() (step 6), a SECURITY DEFINER RPC that bypasses
-- that policy. guard_report_update() (0025) only guards reporter_id /
-- assigned_staff_id / deleted_at / status, so a show_on_board-only update passes
-- it; and log_report_event()/notify_report() fire only on status changes, so
-- toggling board visibility writes no timeline event and sends no notification.

-- 2. "Me too" votes — one per user per report, each row private to its owner.
create table if not exists public.report_votes (
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  report_id  uuid        not null references public.reports (id)  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, report_id)
);

create index if not exists report_votes_report_idx on public.report_votes (report_id);

revoke all on public.report_votes from anon;
alter table public.report_votes enable row level security;
-- Writes go through toggle_report_vote() (SECURITY DEFINER); clients only read
-- their own rows. No direct insert/delete grant, so votes can't be forged and
-- can't target reports that aren't board-eligible.
grant select on public.report_votes to authenticated;

drop policy if exists report_votes_select on public.report_votes;
create policy report_votes_select on public.report_votes
  for select to authenticated using (user_id = auth.uid());

-- 3. Eligibility helper (bypasses reports RLS so it can see other users' rows).
create or replace function public.is_report_board_eligible(p_report_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.reports r
    where r.id = p_report_id
      and r.deleted_at is null
      and r.show_on_board
      and r.category <> 'Safety / Security'
      and r.status <> 'Rejected'
  );
$$;

revoke execute on function public.is_report_board_eligible(uuid) from public, anon;
grant execute on function public.is_report_board_eligible(uuid) to authenticated;

-- 4. The board feed — safe columns only, never reporter identity. vote_count is
--    the total "me too" count; voted is whether the caller has voted.
create or replace function public.campus_issues_feed()
returns table (
  id          uuid,
  code        text,
  category    text,
  description text,
  building    text,
  room        text,
  status      text,
  created_at  timestamptz,
  vote_count  bigint,
  voted       boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    r.id,
    r.code,
    r.category,
    r.description,
    r.building,
    r.room,
    r.status,
    r.created_at,
    (select count(*) from public.report_votes v where v.report_id = r.id) as vote_count,
    exists (
      select 1 from public.report_votes v
      where v.report_id = r.id and v.user_id = auth.uid()
    ) as voted
  from public.reports r
  where r.deleted_at is null
    and r.show_on_board
    and r.category <> 'Safety / Security'
    and r.status <> 'Rejected'
  order by
    (select count(*) from public.report_votes v where v.report_id = r.id) desc,
    r.created_at desc;
$$;

revoke execute on function public.campus_issues_feed() from public, anon;
grant execute on function public.campus_issues_feed() to authenticated;

-- 5. Toggle a "me too" vote. Enforces board-eligibility server-side, then
--    inserts or removes the caller's vote and returns the fresh count + state.
create or replace function public.toggle_report_vote(p_report_id uuid)
returns table (vote_count bigint, voted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has boolean;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not public.is_report_board_eligible(p_report_id) then
    raise exception 'report is not on the campus issues board';
  end if;

  select exists (
    select 1 from public.report_votes
    where report_id = p_report_id and user_id = auth.uid()
  ) into v_has;

  if v_has then
    delete from public.report_votes
    where report_id = p_report_id and user_id = auth.uid();
  else
    insert into public.report_votes (user_id, report_id)
    values (auth.uid(), p_report_id);
  end if;

  return query
    select
      (select count(*) from public.report_votes where report_id = p_report_id),
      exists (
        select 1 from public.report_votes
        where report_id = p_report_id and user_id = auth.uid()
      );
end;
$$;

revoke execute on function public.toggle_report_vote(uuid) from public, anon;
grant execute on function public.toggle_report_vote(uuid) to authenticated;

-- 6. Let a reporter opt their OWN report onto / off the board at ANY status
--    (the base reports_update policy only permits reporter edits while Open, so
--    without this a reporter could never retract a report staff already moved
--    past Open). Runs as owner to bypass that policy; the show_on_board-only
--    UPDATE still satisfies guard_report_update(). Safety / Security can never be
--    made visible.
create or replace function public.set_report_board_visibility(p_report_id uuid, p_visible boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category  text;
  v_effective boolean;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select category into v_category
  from public.reports
  where id = p_report_id and reporter_id = auth.uid() and deleted_at is null;
  if v_category is null then
    raise exception 'report not found';
  end if;
  v_effective := p_visible and v_category <> 'Safety / Security';
  update public.reports
  set show_on_board = v_effective
  where id = p_report_id and reporter_id = auth.uid();
  return v_effective;
end;
$$;

revoke execute on function public.set_report_board_visibility(uuid, boolean) from public, anon;
grant execute on function public.set_report_board_visibility(uuid, boolean) to authenticated;

-- ============================================================================
-- End of migration 0079
-- ============================================================================
