-- ============================================================================
-- FixIt — Migration 0057: Study Hub — student-initiated sections + join codes
-- ----------------------------------------------------------------------------
-- Replaces the admin-pre-creates-everything model with:
--
--   CREATION   A student requests to create a section (dept + intake + section
--              number + optional reason). Admin approves → section created →
--              requester becomes CR → unique 6-char join code generated.
--
--   JOIN       Two paths:
--              • Join code  → instant approval (status = 'approved', joined_via = 'code')
--              • No code    → browse public sections → send request → CR approves
--
--   PRIVACY    Section-level: CR toggles is_public (default true).
--              Intake-level : changed only by a CR vote (majority of CRs in the
--              intake, 48-hour window). Two tiers:
--                  Section public  + Intake private → same-intake members can view
--                  Section public  + Intake public  → whole-department members can view
--                  Section private (any intake)     → own members only
--
-- RLS changes:
--   • study_can_view() rewritten to respect the two privacy flags
--   • study_members_guard() updated to allow code-join auto-approval
--   • CRs may update study_sections.is_public (new update policy)
--   • Admin insert policy on study_sections widened (needed for approve RPC)
--
-- New SECURITY DEFINER RPCs (all revoked from anon/public):
--   • join_section_by_code(p_code)
--   • approve_section_request(p_request_id)
--   • reject_section_request(p_request_id, p_note)
--   • initiate_intake_vote(p_intake_id, p_proposal)
--   • cast_intake_vote(p_vote_id, p_ballot)
--   • close_intake_vote(p_vote_id)            -- internal helper, also callable
--   • check_expired_intake_votes(p_intake_id) -- client calls on manage-page load
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. New columns on existing tables                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table public.study_sections
  add column if not exists join_code  text unique,
  add column if not exists is_public  boolean not null default true;

alter table public.study_intakes
  add column if not exists is_public  boolean not null default true;

alter table public.study_section_members
  add column if not exists joined_via text check (joined_via in ('code', 'request'));

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. New tables                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Student requests admin to create a section and make them CR.
create table if not exists public.study_section_requests (
  id             uuid primary key default gen_random_uuid(),
  requester_id   uuid not null references public.profiles(id)     on delete cascade,
  department_id  uuid not null references public.departments(id)  on delete cascade,
  intake_number  int  not null,    -- e.g. 52
  section_number int  not null,    -- e.g. 1  (Section 1)
  reason         text,
  status         text not null default 'pending'
                      check (status in ('pending', 'approved', 'rejected')),
  admin_note     text,             -- filled on rejection
  section_id     uuid references public.study_sections(id) on delete set null, -- set on approval
  resolved_by    uuid references public.profiles(id) on delete set null,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);
-- One pending request per student at a time.
create unique index if not exists study_section_req_pending_unique
  on public.study_section_requests (requester_id)
  where status = 'pending';
create index if not exists study_section_req_dept_idx
  on public.study_section_requests (department_id);

-- A vote to flip an intake's is_public flag (initiated by any CR in that intake).
create table if not exists public.study_intake_votes (
  id           uuid primary key default gen_random_uuid(),
  intake_id    uuid not null references public.study_intakes(id)  on delete cascade,
  initiated_by uuid not null references public.profiles(id)       on delete cascade,
  proposal     text not null check (proposal in ('public', 'private')),
  status       text not null default 'open' check (status in ('open', 'closed')),
  result       text          check (result  in ('passed', 'failed')),
  closes_at    timestamptz not null,  -- initiated_at + 48 h
  created_at   timestamptz not null default now()
);
-- Only one open vote per intake at a time.
create unique index if not exists study_intake_votes_open_unique
  on public.study_intake_votes (intake_id)
  where status = 'open';

-- One ballot per CR per vote.
create table if not exists public.study_intake_vote_ballots (
  id       uuid primary key default gen_random_uuid(),
  vote_id  uuid not null references public.study_intake_votes(id) on delete cascade,
  cr_id    uuid not null references public.profiles(id)           on delete cascade,
  ballot   text not null check (ballot in ('yes', 'no')),
  voted_at timestamptz not null default now(),
  unique (vote_id, cr_id)
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Rewrite study_can_view — graduated privacy                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Replaces the 0051 department-wide-always-open version with a two-tier system:
--   Tier 0 (always) : direct member of the target section
--   Tier 1          : section is_public=true  → same-intake members can view
--   Tier 2          : section is_public=true AND intake is_public=true
--                     → same-department members can view
create or replace function public.study_can_view(sec uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    -- Tier 0: direct approved member of this section
    exists (
      select 1 from public.study_section_members m
      where m.section_id = sec and m.user_id = auth.uid() and m.status = 'approved'
    )
    or (
      -- Cross-section access requires the target section to be public
      coalesce((select s.is_public from public.study_sections s where s.id = sec), false)
      and (
        -- Tier 1: approved member of ANY section sharing the same intake
        exists (
          select 1
          from public.study_section_members m
          join public.study_sections vs on vs.id = m.section_id
          join public.study_sections ts on ts.id = sec
          where m.user_id = auth.uid()
            and m.status  = 'approved'
            and vs.intake_id = ts.intake_id
        )
        or (
          -- Tier 2: intake is also public → approved member of any section in same dept
          coalesce((
            select i.is_public
            from public.study_sections ts
            join public.study_intakes i on i.id = ts.intake_id
            where ts.id = sec
          ), false)
          and exists (
            select 1
            from public.study_section_members m
            join public.study_sections vs on vs.id = m.section_id
            join public.study_intakes  vi on vi.id = vs.intake_id
            join public.study_sections ts on ts.id = sec
            join public.study_intakes  ti on ti.id = ts.intake_id
            where m.user_id = auth.uid()
              and m.status  = 'approved'
              and vi.department_id = ti.department_id
          )
        )
      )
    );
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Update study_members_guard — allow code-join auto-approval           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- The 0051 guard blocks "self-approve own membership" to prevent admins from
-- reading content. We carve out an exception for joined_via = 'code': the
-- join_section_by_code() RPC validates the code before inserting, and the
-- RLS insert policy still blocks direct self-approved inserts without the RPC.
create or replace function public.study_members_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (new.section_id <> old.section_id or new.user_id <> old.user_id) then
    raise exception 'Cannot move a membership to another section or user';
  end if;
  if new.role = 'cr' and not public.is_admin() then
    raise exception 'Only an admin can assign the CR role';
  end if;
  -- Block self-approval EXCEPT when joining via a validated code.
  -- Direct self-approved inserts (status='approved') are still blocked by the
  -- RLS insert policy; only the SECURITY DEFINER join_section_by_code() RPC
  -- can reach this path with joined_via='code'.
  if new.user_id = auth.uid()
     and new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved')
     and coalesce(new.joined_via, '') <> 'code' then
    raise exception 'You cannot approve your own membership';
  end if;
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    new.decided_by := auth.uid();
    new.decided_at := now();
  end if;
  return new;
end;
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. RLS — new tables                                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

revoke all on
  public.study_section_requests,
  public.study_intake_votes,
  public.study_intake_vote_ballots
  from anon;

alter table public.study_section_requests     enable row level security;
alter table public.study_intake_votes         enable row level security;
alter table public.study_intake_vote_ballots  enable row level security;

grant select, insert, update, delete on
  public.study_section_requests,
  public.study_intake_votes,
  public.study_intake_vote_ballots
  to authenticated;

-- ── study_section_requests ───────────────────────────────────────────────────
-- Requester sees own rows; admin sees all.
create policy study_sec_req_select on public.study_section_requests
  for select to authenticated
  using (requester_id = auth.uid() or public.is_admin());

-- A student may submit one pending request for themselves.
create policy study_sec_req_insert on public.study_section_requests
  for insert to authenticated
  with check (
    requester_id = auth.uid()
    and status = 'pending'
    and intake_number  > 0
    and section_number > 0
  );

-- Only admin may resolve (approve/reject) requests.
create policy study_sec_req_update on public.study_section_requests
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── study_intake_votes ───────────────────────────────────────────────────────
-- Any approved member of the intake may read the vote.
create policy study_intake_votes_select on public.study_intake_votes
  for select to authenticated
  using (
    exists (
      select 1
      from public.study_section_members m
      join public.study_sections s on s.id = m.section_id
      where s.intake_id = intake_id
        and m.user_id  = auth.uid()
        and m.status   = 'approved'
    )
  );

-- Only a CR of a section in this intake may initiate a vote (one open at a time
-- enforced by the partial unique index).
create policy study_intake_votes_insert on public.study_intake_votes
  for insert to authenticated
  with check (
    initiated_by = auth.uid()
    and exists (
      select 1
      from public.study_section_members m
      join public.study_sections s on s.id = m.section_id
      where s.intake_id = intake_id
        and m.user_id  = auth.uid()
        and m.status   = 'approved'
        and m.role     = 'cr'
    )
    and status   = 'open'
    and closes_at > now()
  );

-- Votes are closed only by the cast_intake_vote / close_intake_vote RPCs
-- (SECURITY DEFINER → bypasses RLS). No direct update allowed.

-- ── study_intake_vote_ballots ─────────────────────────────────────────────────
-- Any approved member of the intake may read ballots (transparency).
create policy study_intake_ballots_select on public.study_intake_vote_ballots
  for select to authenticated
  using (
    exists (
      select 1
      from public.study_intake_votes v
      join public.study_section_members m on true
      join public.study_sections s on s.id = m.section_id
      where v.id        = vote_id
        and s.intake_id = v.intake_id
        and m.user_id   = auth.uid()
        and m.status    = 'approved'
    )
  );

-- Ballots are cast only through the cast_intake_vote() RPC (SECURITY DEFINER).
-- No direct insert allowed from clients.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. RLS — CR may toggle section visibility                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- The existing study_sections_admin policy handles admin full-access.
-- Add a narrower update policy so a CR can flip is_public on their own section.
drop policy if exists study_sections_cr_visibility on public.study_sections;
create policy study_sections_cr_visibility on public.study_sections
  for update to authenticated
  using  (public.study_is_cr(id))
  with check (public.study_is_cr(id));

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. SECURITY DEFINER RPCs                                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── join_section_by_code ─────────────────────────────────────────────────────
create or replace function public.join_section_by_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_section_id uuid;
begin
  -- Find the section whose join code matches (case-insensitive trim).
  select id into v_section_id
  from public.study_sections
  where join_code = upper(trim(p_code));

  if v_section_id is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid join code.');
  end if;

  -- Already a member (any status)?
  if exists (
    select 1 from public.study_section_members
    where section_id = v_section_id and user_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'error', 'You are already in this section.');
  end if;

  -- Insert as an instantly-approved member. The guard allows joined_via='code'.
  insert into public.study_section_members
    (section_id, user_id, role, status, joined_via, decided_by, decided_at)
  values
    (v_section_id, auth.uid(), 'member', 'approved', 'code', auth.uid(), now());

  return jsonb_build_object('ok', true, 'sectionId', v_section_id);
end;
$$;

-- ── approve_section_request ──────────────────────────────────────────────────
create or replace function public.approve_section_request(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_req        record;
  v_intake_id  uuid;
  v_section_id uuid;
  v_join_code  text;
  v_attempts   int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve section requests';
  end if;

  select * into v_req from public.study_section_requests where id = p_request_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Request not found.');
  end if;
  if v_req.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'Request is already resolved.');
  end if;

  -- Create intake if it doesn't exist for this dept + number.
  insert into public.study_intakes (department_id, number, is_public)
  values (v_req.department_id, v_req.intake_number, true)
  on conflict (department_id, number) do nothing;

  select id into v_intake_id
  from public.study_intakes
  where department_id = v_req.department_id and number = v_req.intake_number;

  -- Create section if it doesn't exist for this intake + number.
  insert into public.study_sections (intake_id, number, is_public)
  values (v_intake_id, v_req.section_number, true)
  on conflict (intake_id, number) do nothing;

  select id into v_section_id
  from public.study_sections
  where intake_id = v_intake_id and number = v_req.section_number;

  -- Generate a unique 6-char alphanumeric join code (hex subset: 0-9, A-F).
  loop
    v_join_code := upper(left(replace(gen_random_uuid()::text, '-', ''), 6));
    exit when not exists (
      select 1 from public.study_sections where join_code = v_join_code
    );
    v_attempts := v_attempts + 1;
    if v_attempts > 30 then
      raise exception 'Could not generate a unique join code — try again.';
    end if;
  end loop;

  update public.study_sections
  set join_code = v_join_code
  where id = v_section_id;

  -- Assign the requester as CR (upsert in case they already have a member row).
  insert into public.study_section_members
    (section_id, user_id, role, status, decided_by, decided_at)
  values
    (v_section_id, v_req.requester_id, 'cr', 'approved', auth.uid(), now())
  on conflict (section_id, user_id)
    do update set role       = 'cr',
                  status     = 'approved',
                  decided_by = auth.uid(),
                  decided_at = now();

  -- Mark the request approved.
  update public.study_section_requests
  set status      = 'approved',
      section_id  = v_section_id,
      resolved_by = auth.uid(),
      resolved_at = now()
  where id = p_request_id;

  return jsonb_build_object(
    'ok',        true,
    'sectionId', v_section_id,
    'joinCode',  v_join_code
  );
end;
$$;

-- ── reject_section_request ───────────────────────────────────────────────────
create or replace function public.reject_section_request(p_request_id uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_req record;
begin
  if not public.is_admin() then
    raise exception 'Only admins can reject section requests';
  end if;

  select * into v_req from public.study_section_requests where id = p_request_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Request not found.');
  end if;
  if v_req.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'Request is already resolved.');
  end if;

  update public.study_section_requests
  set status      = 'rejected',
      admin_note  = p_note,
      resolved_by = auth.uid(),
      resolved_at = now()
  where id = p_request_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── initiate_intake_vote ─────────────────────────────────────────────────────
create or replace function public.initiate_intake_vote(p_intake_id uuid, p_proposal text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_vote_id uuid;
begin
  if p_proposal not in ('public', 'private') then
    return jsonb_build_object('ok', false, 'error', 'Invalid proposal value.');
  end if;

  -- Caller must be a CR in this intake.
  if not exists (
    select 1
    from public.study_section_members m
    join public.study_sections s on s.id = m.section_id
    where s.intake_id = p_intake_id
      and m.user_id   = auth.uid()
      and m.status    = 'approved'
      and m.role      = 'cr'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Only a CR of this intake can start a vote.');
  end if;

  -- Reject if a vote is already open (partial unique index also guards this).
  if exists (
    select 1 from public.study_intake_votes
    where intake_id = p_intake_id and status = 'open'
  ) then
    return jsonb_build_object('ok', false, 'error', 'A vote is already open for this intake.');
  end if;

  insert into public.study_intake_votes
    (intake_id, initiated_by, proposal, status, closes_at)
  values
    (p_intake_id, auth.uid(), p_proposal, 'open', now() + interval '48 hours')
  returning id into v_vote_id;

  return jsonb_build_object('ok', true, 'voteId', v_vote_id);
end;
$$;

-- ── close_intake_vote (internal helper, also safe to call directly) ──────────
create or replace function public.close_intake_vote(p_vote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_vote   record;
  v_yes    int;
  v_no     int;
  v_passed boolean;
begin
  select * into v_vote from public.study_intake_votes where id = p_vote_id;
  if not found or v_vote.status <> 'open' then return; end if;

  select
    count(*) filter (where ballot = 'yes'),
    count(*) filter (where ballot = 'no')
  into v_yes, v_no
  from public.study_intake_vote_ballots
  where vote_id = p_vote_id;

  -- Tie goes to the status quo (no change).
  v_passed := v_yes > v_no;

  update public.study_intake_votes
  set status = 'closed',
      result = case when v_passed then 'passed' else 'failed' end
  where id = p_vote_id;

  if v_passed then
    update public.study_intakes
    set is_public = (v_vote.proposal = 'public')
    where id = v_vote.intake_id;
  end if;
end;
$$;

-- ── cast_intake_vote ─────────────────────────────────────────────────────────
create or replace function public.cast_intake_vote(p_vote_id uuid, p_ballot text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_vote        record;
  v_total_crs   int;
  v_total_votes int;
begin
  if p_ballot not in ('yes', 'no') then
    return jsonb_build_object('ok', false, 'error', 'Ballot must be "yes" or "no".');
  end if;

  select * into v_vote from public.study_intake_votes where id = p_vote_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Vote not found.');
  end if;
  if v_vote.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'This vote is already closed.');
  end if;
  if v_vote.closes_at < now() then
    perform public.close_intake_vote(p_vote_id);
    return jsonb_build_object('ok', false, 'error', 'This vote has expired and has been closed.');
  end if;

  -- Must be a CR in this intake.
  if not exists (
    select 1
    from public.study_section_members m
    join public.study_sections s on s.id = m.section_id
    where s.intake_id = v_vote.intake_id
      and m.user_id   = auth.uid()
      and m.status    = 'approved'
      and m.role      = 'cr'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Only CRs of this intake can vote.');
  end if;

  -- Already voted?
  if exists (
    select 1 from public.study_intake_vote_ballots
    where vote_id = p_vote_id and cr_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'error', 'You have already cast your ballot.');
  end if;

  insert into public.study_intake_vote_ballots (vote_id, cr_id, ballot)
  values (p_vote_id, auth.uid(), p_ballot);

  -- Close the vote automatically if all CRs in the intake have voted.
  select count(*) into v_total_crs
  from public.study_section_members m
  join public.study_sections s on s.id = m.section_id
  where s.intake_id = v_vote.intake_id
    and m.status    = 'approved'
    and m.role      = 'cr';

  select count(*) into v_total_votes
  from public.study_intake_vote_ballots
  where vote_id = p_vote_id;

  if v_total_votes >= v_total_crs then
    perform public.close_intake_vote(p_vote_id);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── check_expired_intake_votes ───────────────────────────────────────────────
-- Client calls this on manage-page load so expired votes are closed promptly
-- without needing a cron job.
create or replace function public.check_expired_intake_votes(p_intake_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_vote_id uuid;
begin
  for v_vote_id in
    select id from public.study_intake_votes
    where intake_id = p_intake_id
      and status    = 'open'
      and closes_at < now()
  loop
    perform public.close_intake_vote(v_vote_id);
  end loop;
end;
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 8. Permissions                                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

revoke execute on function
  public.join_section_by_code(text),
  public.approve_section_request(uuid),
  public.reject_section_request(uuid, text),
  public.initiate_intake_vote(uuid, text),
  public.cast_intake_vote(uuid, text),
  public.close_intake_vote(uuid),
  public.check_expired_intake_votes(uuid)
  from public, anon;

grant execute on function
  public.join_section_by_code(text),
  public.approve_section_request(uuid),
  public.reject_section_request(uuid, text),
  public.initiate_intake_vote(uuid, text),
  public.cast_intake_vote(uuid, text),
  public.close_intake_vote(uuid),
  public.check_expired_intake_votes(uuid)
  to authenticated;

-- ============================================================================
-- Summary of what changed vs. what stayed the same:
--
-- UNCHANGED:
--   • study_intakes_select / study_sections_select  → still (true) — browse works
--   • study_members_select / update / delete        — unchanged
--   • study_courses_*, study_materials_*, study_qb_*,
--     study_books_*, study_pins_*                   — unchanged (all gate on study_can_view)
--   • study_access_requests / study_section_grants  — dormant but harmless
--   • storage bucket + policies                     — unchanged
--   • study_is_member / study_can_edit / study_is_cr
--     study_member_of_intake / study_editor_of_intake
--     study_can_read_object / study_guard_storage_path — unchanged
--
-- CHANGED:
--   • study_can_view()        — new graduated privacy logic
--   • study_members_guard()   — carve-out for joined_via='code'
--   • study_sections_insert   — admin can now create sections via the approve RPC
--     (the existing study_sections_admin policy already covers this — no change
--      needed, the RPC runs SECURITY DEFINER and bypasses RLS anyway)
--   + study_sections_cr_visibility (new UPDATE policy for CR visibility toggle)
-- ============================================================================
