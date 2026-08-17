-- ============================================================================
-- FixIt — Migration 0085: DM context grants (message instead of WhatsApp)
-- ----------------------------------------------------------------------------
-- Problem: every student-to-student "contact" in the app dead-ends in WhatsApp
-- (marketplace, rides, lost & found, blood), because dm_can_send (0081) only
-- allows a DM between ACCEPTED CONNECTIONS. Asking a seller "is this still
-- available?" therefore costs connect -> wait for accept -> message, while
-- WhatsApp costs one tap. So the messaging system built in 0081 goes unused and
-- users hand out a permanent, un-revocable phone number instead.
--
-- Fix: the app ALREADY decides you may contact someone — that is exactly what
-- listing_contact (0018) / ride_contact (0019) / blood_requester_contact (0020)
-- and the matched-claim rule on profiles do when they reveal a number. This
-- migration reuses that same authority to unlock a DM instead:
--
--   open_dm_thread(context_type, code, target) re-checks the relationship for
--   that context and, if it holds, writes a dm_grants row. dm_can_send then
--   accepts EITHER an accepted connection OR a live grant.
--
-- Grants are symmetric (stored as the sorted peer pair, like messages.peer_low/
-- peer_high) so the seller can reply without needing a grant of their own.
--
-- Blocks still win over everything: a block in either direction denies, exactly
-- as before — a grant can never be used to route around being blocked.
--
-- Nothing here removes the WhatsApp links; the in-app path becomes the primary
-- CTA and WhatsApp stays as the fallback (and remains the ONLY option for
-- faculty/doctors/bus helpers, who have no accounts — they live in their own
-- tables, not in profiles).
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Table                                                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- One row per (pair, context). peer_low < peer_high mirrors messages, so the
-- grant is direction-free and either party may open the thread.
-- context_id is NOT a foreign key: it points at whichever table context_type
-- names, so a single column can't reference them all.
create table if not exists public.dm_grants (
  peer_low     uuid        not null references public.profiles (id) on delete cascade,
  peer_high    uuid        not null references public.profiles (id) on delete cascade,
  context_type text        not null check (context_type in ('listing','ride','item','blood')),
  context_id   uuid        not null,
  created_by   uuid        not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  -- Generous window: a grant that lapses mid-conversation would strand both
  -- sides, which is worse than a stale permission on a finished transaction.
  expires_at   timestamptz not null default (now() + interval '90 days'),
  primary key (peer_low, peer_high, context_type, context_id),
  constraint dm_grants_pair_ck check (peer_low < peer_high)
);

create index if not exists dm_grants_low_idx  on public.dm_grants (peer_low, expires_at);
create index if not exists dm_grants_high_idx on public.dm_grants (peer_high, expires_at);
create index if not exists dm_grants_by_idx   on public.dm_grants (created_by);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. RLS — readable by its two parties, writable ONLY by the RPC below       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- A client-writable grants table would be a self-service DM-permission bypass:
-- anyone could insert a row naming any stranger and message them. All writes go
-- through open_dm_thread(), which re-derives the relationship server-side.
alter table public.dm_grants enable row level security;
revoke all on public.dm_grants from anon;
grant select on public.dm_grants to authenticated;
revoke insert, update, delete, truncate on public.dm_grants from authenticated;

drop policy if exists dm_grants_select on public.dm_grants;
create policy dm_grants_select on public.dm_grants
  for select to authenticated
  using (auth.uid() in (peer_low, peer_high));


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. dm_can_send — accepted connection OR live context grant                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Replaces the 0081 definition. Still caller-bound (derives self from
-- auth.uid(), never a third-party social-graph oracle) and still block-first.
create or replace function public.dm_can_send(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    -- Blocks veto both branches below.
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
          and g.expires_at > now()
      )
    );
$$;
revoke execute on function public.dm_can_send(uuid) from public, anon;
grant  execute on function public.dm_can_send(uuid) to authenticated;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. open_dm_thread — validate the context, then issue the grant             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Each branch mirrors the authority of the matching contact-reveal path, so
-- "may I see their number" and "may I message them" can never disagree:
--   listing → any student may contact a listing's seller      (listing_contact)
--   ride    → requester <-> driver on that ride               (ride_contact)
--   item    → poster <-> claimant of an APPROVED claim        (matched-claim)
--   blood   → requester <-> a donor who pledged               (blood_*_contact)
-- Returns true on success; raises a readable exception otherwise.
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

  -- Blocked in either direction → refuse before doing any lookup work.
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = v_me and b.blocked_id = p_target)
       or (b.blocker_id = p_target and b.blocked_id = v_me)
  ) then
    raise exception 'You can''t message this person.';
  end if;

  if p_context_type = 'listing' then
    select l.id, l.seller_id into v_ctx, v_owner
    from public.listings l where l.code = p_code;
    -- Any signed-in student may open a listing thread with its seller, matching
    -- listing_contact()'s openness.
    v_ok := v_ctx is not null and p_target = v_owner;

  elsif p_context_type = 'ride' then
    select r.id, r.driver_id into v_ctx, v_owner
    from public.rides r where r.code = p_code;
    if v_ctx is not null then
      v_ok :=
        -- a requester messaging the driver
        (p_target = v_owner and exists (
           select 1 from public.ride_requests rr
           where rr.ride_id = v_ctx and rr.requester_id = v_me))
        -- the driver messaging one of their requesters
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
        -- a donor who pledged messaging the requester
        (p_target = v_owner and exists (
           select 1 from public.blood_pledges p
           where p.request_id = v_ctx and p.donor_id = v_me))
        -- the requester messaging one of their responders
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
  -- Re-opening an old thread refreshes the window rather than failing.
  do update set expires_at = now() + interval '90 days';

  return true;
end;
$$;
revoke execute on function public.open_dm_thread(text, text, uuid) from public, anon;
grant  execute on function public.open_dm_thread(text, text, uuid) to authenticated;

-- ============================================================================
-- End of migration 0085
-- ============================================================================
