-- ============================================================================
-- FixIt — Migration 0086: DM context grant hardening (review fixes for 0085)
-- ----------------------------------------------------------------------------
-- Review of 0085 turned up four issues, fixed here:
--
--  1. NO ROLE GATE. open_dm_thread() is granted to `authenticated`, which is
--     every signed-in user — including the staff/admin accounts. 0081 scoped
--     DMs to students on purpose (admin has no DM read path anywhere in its
--     policies), and hiding the button client-side is not a boundary. Both
--     parties must now be students.
--
--  2. NO OPT-OUT. listing_contact only reveals a number when show_whatsapp is
--     true, so a seller who kept their number private was unreachable. 0085
--     made them DM-able with no equivalent control. profiles.allow_dms is that
--     control — it gates GRANT-based DMs only. Accepted connections are mutual
--     consent and keep working regardless.
--
--  3. EXPIRY CLIFF. dm_can_send required expires_at > now(), so on day 91 a
--     live conversation silently went read-only for both sides. A grant that
--     has produced at least one message now stays usable. Scoped deliberately
--     to GRANTS: it must not resurrect a connection-based DM whose connection
--     row was later removed.
--
--  4. NO THROTTLE on grant creation (messages have a 20/10s brake, grants had
--     none). Capped per user per hour.
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. profiles.allow_dms — opt out of context-grant DMs                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Defaults true: the feature is the point, and a student who posts a listing
-- expects to be reachable about it. Opting out never affects connections.
alter table public.profiles
  add column if not exists allow_dms boolean not null default true;

-- No column grants needed here: profiles carries TABLE-level privileges for
-- `authenticated` (verified: pg_class.relacl = authenticated=arwdDxtm, and no
-- pg_attribute.attacl entries), so the new column is covered automatically.
-- Who may write it is decided by the existing profiles RLS (id = auth.uid()),
-- not by grants.


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. is_student() — caller-bound role check                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- SECURITY DEFINER: profiles RLS doesn't let a caller read arbitrary rows, and
-- this is also used to check the TARGET's role. Role values are lowercase in
-- the DB ('student'/'staff'/'admin'); the client capitalises for display only.
create or replace function public.is_student_id(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = p_id and role = 'student');
$$;
revoke execute on function public.is_student_id(uuid) from public, anon;
grant  execute on function public.is_student_id(uuid) to authenticated;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. dm_can_send — connection OR (grant that is live OR already talking)     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create or replace function public.dm_can_send(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    -- Blocks veto everything below.
    not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = other)
         or (b.blocker_id = other      and b.blocked_id = auth.uid())
    )
    and (
      exists (
        select 1 from public.connections c
        where c.status = 'accepted'
          and ((c.requester_id = auth.uid() and c.addressee_id = other)
            or (c.requester_id = other      and c.addressee_id = auth.uid()))
      )
      or exists (
        select 1 from public.dm_grants g
        where g.peer_low  = least(auth.uid(), other)
          and g.peer_high = greatest(auth.uid(), other)
          and (
            g.expires_at > now()
            -- A started conversation outlives its grant window: expiring
            -- mid-thread would strand both sides with a read-only history.
            or exists (
              select 1 from public.messages m
              where m.kind = 'dm'
                and m.peer_low  = g.peer_low
                and m.peer_high = g.peer_high
            )
          )
      )
    );
$$;
revoke execute on function public.dm_can_send(uuid) from public, anon;
grant  execute on function public.dm_can_send(uuid) to authenticated;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. open_dm_thread — + student gate, + allow_dms, + throttle                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create or replace function public.open_dm_thread(
  p_context_type text,
  p_code         text,
  p_target       uuid
)
returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  v_me     uuid := auth.uid();
  v_ctx    uuid;
  v_owner  uuid;
  v_ok     boolean := false;
begin
  if v_me is null then raise exception 'Not signed in.'; end if;
  if p_target is null or p_target = v_me then raise exception 'Invalid recipient.'; end if;

  -- DMs are a student-domain feature (0081). The client hides the button for
  -- staff/admin, but the RPC is the actual boundary.
  if not public.is_student_id(v_me) or not public.is_student_id(p_target) then
    raise exception 'Messaging is available to students only.';
  end if;

  -- Blocked in either direction → refuse before doing any lookup work.
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = v_me and b.blocked_id = p_target)
       or (b.blocker_id = p_target and b.blocked_id = v_me)
  ) then
    raise exception 'You can''t message this person.';
  end if;

  -- Recipient opted out of being messaged from a listing/ride/claim/request.
  if not coalesce((select allow_dms from public.profiles where id = p_target), true) then
    raise exception 'This student isn''t accepting messages.';
  end if;

  -- Throttle: a grant sends nothing by itself, but minting them against every
  -- seller shouldn't be free either.
  if (select count(*) from public.dm_grants
      where created_by = v_me and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many new chats started. Try again later.';
  end if;

  if p_context_type = 'listing' then
    select l.id, l.seller_id into v_ctx, v_owner
    from public.listings l where l.code = p_code;
    v_ok := v_ctx is not null and p_target = v_owner;

  elsif p_context_type = 'ride' then
    select r.id, r.driver_id into v_ctx, v_owner
    from public.rides r where r.code = p_code;
    if v_ctx is not null then
      v_ok :=
        (p_target = v_owner and exists (
           select 1 from public.ride_requests rr
           where rr.ride_id = v_ctx and rr.requester_id = v_me))
        or (v_owner = v_me and exists (
           select 1 from public.ride_requests rr
           where rr.ride_id = v_ctx and rr.requester_id = p_target));
    end if;

  elsif p_context_type = 'item' then
    select i.id, i.poster_id into v_ctx, v_owner
    from public.lost_found_items i where i.code = p_code;
    if v_ctx is not null then
      v_ok := exists (
        select 1 from public.claims c
        where c.item_id = v_ctx
          and c.status = 'Approved'
          and ((c.claimant_id = v_me      and p_target = v_owner)
            or (c.claimant_id = p_target  and v_owner  = v_me))
      );
    end if;

  elsif p_context_type = 'blood' then
    select b.id, b.requester_id into v_ctx, v_owner
    from public.blood_requests b where b.code = p_code;
    if v_ctx is not null then
      v_ok :=
        (p_target = v_owner and exists (
           select 1 from public.blood_pledges p
           where p.request_id = v_ctx and p.donor_id = v_me))
        or (v_owner = v_me and exists (
           select 1 from public.blood_pledges p
           where p.request_id = v_ctx and p.donor_id = p_target));
    end if;

  else
    raise exception 'Unknown context.';
  end if;

  if not v_ok then
    raise exception 'You can''t message this person about that yet.';
  end if;

  insert into public.dm_grants (peer_low, peer_high, context_type, context_id, created_by)
  values (least(v_me, p_target), greatest(v_me, p_target), p_context_type, v_ctx, v_me)
  on conflict (peer_low, peer_high, context_type, context_id)
  do update set expires_at = now() + interval '90 days';

  return true;
end;
$$;
revoke execute on function public.open_dm_thread(text, text, uuid) from public, anon;
grant  execute on function public.open_dm_thread(text, text, uuid) to authenticated;

-- ============================================================================
-- End of migration 0086
-- ============================================================================
