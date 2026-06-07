-- ============================================================================
-- FixIt — Migration 0061: Study Hub security & logic hardening (0057 followup)
-- ----------------------------------------------------------------------------
-- Fixes the following audit findings:
--   C8  — join_code column readable by all authenticated users (brute-force)
--   C9  — unqualified intake_id in study_intake_votes RLS policies
--   H39 — check_expired_intake_votes callable by any authenticated user
--   H40 — close_intake_vote callable by any authenticated user
--   H41 — two students can request the same section → dual CR
--   H42 — zero-ballot expiry recorded as 'failed' instead of 'no_quorum'
--   H43 — CR count snapshot race: new CRs extend vote indefinitely
--   H49 — unnecessary UPDATE grant on study_intake_votes
--   H50 — unnecessary INSERT/UPDATE/DELETE grants on study_intake_vote_ballots
--   M51 — vote initiator must separately cast their own ballot
--   M53 — two students can request the same (dept, intake, section) target
-- ============================================================================

-- ── C8: Revoke join_code column from direct authenticated SELECT ─────────────
-- The study_sections_select policy uses USING (true), which exposed join_code
-- to all authenticated users. SECURITY DEFINER RPCs bypass column-level grants
-- so join_section_by_code() still works after this revocation.
revoke select (join_code) on public.study_sections from authenticated;

-- ── C8 (continued): Widen join code to 8-char base64-ish (wider than 6 hex) ─
-- Replace approve_section_request to use gen_random_bytes for ~281 trillion
-- combinations instead of 16 million. Also adds dual-CR guard (H41 companion).
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

  insert into public.study_intakes (department_id, number, is_public)
  values (v_req.department_id, v_req.intake_number, true)
  on conflict (department_id, number) do nothing;

  select id into v_intake_id
  from public.study_intakes
  where department_id = v_req.department_id and number = v_req.intake_number;

  insert into public.study_sections (intake_id, number, is_public)
  values (v_intake_id, v_req.section_number, true)
  on conflict (intake_id, number) do nothing;

  select id into v_section_id
  from public.study_sections
  where intake_id = v_intake_id and number = v_req.section_number;

  -- H41: Block if this section already has an approved CR.
  if exists (
    select 1 from public.study_section_members
    where section_id = v_section_id and role = 'cr' and status = 'approved'
  ) then
    return jsonb_build_object('ok', false, 'error', 'This section already has a Class Representative.');
  end if;

  -- C8: Generate 8-char code from base64 alphabet (translate +/= to safe chars).
  -- charset: A-Z 0-9 X Y Z with +/= replaced → ~2.8 trillion combinations.
  loop
    v_join_code := upper(
      translate(
        left(encode(gen_random_bytes(6), 'base64'), 8),
        '+/=',
        'XYZ'
      )
    );
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

  insert into public.study_section_members
    (section_id, user_id, role, status, decided_by, decided_at)
  values
    (v_section_id, v_req.requester_id, 'cr', 'approved', auth.uid(), now())
  on conflict (section_id, user_id)
    do update set role       = 'cr',
                  status     = 'approved',
                  decided_by = auth.uid(),
                  decided_at = now();

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

-- ── C9: Qualify intake_id explicitly in study_intake_votes RLS policies ──────
drop policy if exists study_intake_votes_select on public.study_intake_votes;
drop policy if exists study_intake_votes_insert on public.study_intake_votes;

create policy study_intake_votes_select on public.study_intake_votes
  for select to authenticated
  using (
    exists (
      select 1
      from public.study_section_members m
      join public.study_sections s on s.id = m.section_id
      where s.intake_id = study_intake_votes.intake_id
        and m.user_id   = auth.uid()
        and m.status    = 'approved'
    )
  );

create policy study_intake_votes_insert on public.study_intake_votes
  for insert to authenticated
  with check (
    initiated_by = auth.uid()
    and exists (
      select 1
      from public.study_section_members m
      join public.study_sections s on s.id = m.section_id
      where s.intake_id = study_intake_votes.intake_id
        and m.user_id   = auth.uid()
        and m.status    = 'approved'
        and m.role      = 'cr'
    )
    and status   = 'open'
    and closes_at > now()
  );

-- ── H42: Extend result check constraint to include 'no_quorum' ───────────────
alter table public.study_intake_votes
  drop constraint if exists study_intake_votes_result_check;
alter table public.study_intake_votes
  add constraint study_intake_votes_result_check
    check (result in ('passed', 'failed', 'no_quorum'));

-- ── H40 / H42: close_intake_vote — add auth check + no_quorum handling ───────
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

  -- H40: Only intake members, the initiator, or admins may close votes.
  if not public.is_admin()
     and v_vote.initiated_by <> auth.uid()
     and not exists (
       select 1
       from public.study_section_members m
       join public.study_sections s on s.id = m.section_id
       where s.intake_id = v_vote.intake_id
         and m.user_id   = auth.uid()
         and m.status    = 'approved'
     )
  then
    raise exception 'Not authorized to close this vote';
  end if;

  select
    count(*) filter (where ballot = 'yes'),
    count(*) filter (where ballot = 'no')
  into v_yes, v_no
  from public.study_intake_vote_ballots
  where vote_id = p_vote_id;

  -- H42: Zero ballots = no quorum — distinct from a genuine tie.
  if v_yes = 0 and v_no = 0 then
    update public.study_intake_votes
    set status = 'closed', result = 'no_quorum'
    where id = p_vote_id;
    return;
  end if;

  -- Tie goes to status quo (no change). Majority required to pass.
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

-- ── H43: Add total_crs_at_open snapshot column ───────────────────────────────
alter table public.study_intake_votes
  add column if not exists total_crs_at_open int;

-- ── H39: check_expired_intake_votes — restrict to intake members/admins ──────
create or replace function public.check_expired_intake_votes(p_intake_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_vote_id uuid;
begin
  -- H39: Only intake members or admins may trigger expiry processing.
  if not public.is_admin() and not exists (
    select 1
    from public.study_section_members m
    join public.study_sections s on s.id = m.section_id
    where s.intake_id = p_intake_id
      and m.user_id   = auth.uid()
      and m.status    = 'approved'
  ) then
    return;
  end if;

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

-- ── M51 / H43: initiate_intake_vote — snapshot CR count + auto-cast ballot ───
create or replace function public.initiate_intake_vote(p_intake_id uuid, p_proposal text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_vote_id   uuid;
  v_total_crs int;
begin
  if p_proposal not in ('public', 'private') then
    return jsonb_build_object('ok', false, 'error', 'Invalid proposal value.');
  end if;

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

  if exists (
    select 1 from public.study_intake_votes
    where intake_id = p_intake_id and status = 'open'
  ) then
    return jsonb_build_object('ok', false, 'error', 'A vote is already open for this intake.');
  end if;

  -- H43: Snapshot the current CR count to avoid race conditions.
  select count(*) into v_total_crs
  from public.study_section_members m
  join public.study_sections s on s.id = m.section_id
  where s.intake_id = p_intake_id
    and m.status    = 'approved'
    and m.role      = 'cr';

  insert into public.study_intake_votes
    (intake_id, initiated_by, proposal, status, closes_at, total_crs_at_open)
  values
    (p_intake_id, auth.uid(), p_proposal, 'open', now() + interval '48 hours', v_total_crs)
  returning id into v_vote_id;

  -- M51: Auto-cast initiator's 'yes' ballot so they don't need a separate step.
  insert into public.study_intake_vote_ballots (vote_id, cr_id, ballot)
  values (v_vote_id, auth.uid(), 'yes');

  return jsonb_build_object('ok', true, 'voteId', v_vote_id);
end;
$$;

-- ── H43: cast_intake_vote — use snapshot count for auto-close ────────────────
create or replace function public.cast_intake_vote(p_vote_id uuid, p_ballot text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_vote        record;
  v_total_votes int;
  v_total_crs   int;
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

  if exists (
    select 1 from public.study_intake_vote_ballots
    where vote_id = p_vote_id and cr_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'error', 'You have already cast your ballot.');
  end if;

  insert into public.study_intake_vote_ballots (vote_id, cr_id, ballot)
  values (p_vote_id, auth.uid(), p_ballot);

  select count(*) into v_total_votes
  from public.study_intake_vote_ballots
  where vote_id = p_vote_id;

  -- H43: Use snapshot count if available; otherwise fall back to live count.
  if v_vote.total_crs_at_open is not null then
    if v_total_votes >= v_vote.total_crs_at_open then
      perform public.close_intake_vote(p_vote_id);
    end if;
  else
    select count(*) into v_total_crs
    from public.study_section_members m
    join public.study_sections s on s.id = m.section_id
    where s.intake_id = v_vote.intake_id
      and m.status    = 'approved'
      and m.role      = 'cr';
    if v_total_votes >= v_total_crs then
      perform public.close_intake_vote(p_vote_id);
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── H41 / M53: Prevent two pending requests for the same section target ───────
create unique index if not exists study_section_req_target_unique
  on public.study_section_requests (department_id, intake_number, section_number)
  where status = 'pending';

-- ── H49: Explicit deny UPDATE policy on study_intake_votes ───────────────────
drop policy if exists study_intake_votes_no_update on public.study_intake_votes;
create policy study_intake_votes_no_update on public.study_intake_votes
  for update to authenticated using (false);

-- ── H50: Revoke unnecessary DML grants on study_intake_vote_ballots ──────────
-- Ballots are cast only via the cast_intake_vote() SECURITY DEFINER RPC.
revoke insert, update, delete on public.study_intake_vote_ballots from authenticated;
