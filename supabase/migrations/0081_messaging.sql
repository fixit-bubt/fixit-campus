-- ============================================================================
-- FixIt — Migration 0081: Messaging (1-to-1 DMs + club/section group chats)
-- ----------------------------------------------------------------------------
-- One `messages` table, conversation identity derived (no conversations table):
--   • dm      -> canonical pair (peer_low, peer_high), peer_low < peer_high
--   • club    -> club_id       (members = club_members)
--   • section -> section_id    (approved study_section_members)
--
-- Delivery: Supabase Realtime BROADCAST via DB trigger (realtime.broadcast_changes)
--   -> per-conversation private topics, authorized once at channel JOIN by the
--      RLS policy on realtime.messages. (Not postgres_changes — cheaper at scale.)
--
-- Moderation: club officers (president/vp/editor) + section CR may soft-delete
--   any message in their group chat. DMs are fully private — admin has NO read
--   path anywhere in these policies.
--
-- Soft-delete only (no DELETE grant): deleted rows keep the row, scrub body to
--   '', stamp deleted_by; deletes propagate as broadcast UPDATE events.
--
-- Hardening (from adversarial review):
--   • dm_can_send is caller-bound (was a third-party social-graph oracle)
--   • body NOT NULL + branch-explicit CHECK (NULL slipped the length check)
--   • created_at/edited_at/deleted_at/deleted_by pinned server-side (were
--     client-forgeable -> poisoned ordering + fake "(edited)")
--   • sender_id nullable + ON DELETE SET NULL (was an account-deletion brick)
--   • per-sender flood brake (20 msg / 10 s)
--   • realtime topic policy guards the ::uuid cast (malformed topic -> deny)
--
-- Prod note: this backend has NO create_notification() helper (schema drift vs
--   0067). Like 0075/0076, the DM-notify trigger INSERTs into notifications
--   directly with inline pref checks.
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Tables                                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table if not exists public.messages (
  id         uuid        primary key default gen_random_uuid(),
  kind       text        not null check (kind in ('dm','club','section')),
  club_id    uuid        references public.clubs          (id) on delete cascade,
  section_id uuid        references public.study_sections (id) on delete cascade,
  peer_low   uuid        references public.profiles       (id) on delete cascade,
  peer_high  uuid        references public.profiles       (id) on delete cascade,
  -- sender_id nullable + SET NULL so deleting a user never bricks: their old
  -- messages remain and render as "Unknown". Kind-shape check tolerates null.
  sender_id  uuid        references public.profiles (id) on delete set null,
  body       text        not null,
  edited_at  timestamptz,
  deleted_at timestamptz,
  deleted_by uuid        references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  -- body: 1..4000 chars while live; exactly '' once soft-deleted. Branch-explicit
  -- so a NULL body can never satisfy the constraint (a bare length check would).
  constraint messages_body_ck check (
    (deleted_at is null  and char_length(body) between 1 and 4000)
    or (deleted_at is not null and body = '')
  ),

  -- exactly one conversation shape per row
  constraint messages_shape_ck check (
       (kind = 'dm'
          and peer_low is not null and peer_high is not null and peer_low < peer_high
          and (sender_id is null or sender_id in (peer_low, peer_high))
          and club_id is null and section_id is null)
    or (kind = 'club'
          and club_id is not null
          and peer_low is null and peer_high is null and section_id is null)
    or (kind = 'section'
          and section_id is not null
          and peer_low is null and peer_high is null and club_id is null)
  )
);

create index if not exists messages_dm_idx         on public.messages (peer_low, peer_high, created_at desc);
create index if not exists messages_club_idx       on public.messages (club_id, created_at desc);
create index if not exists messages_section_idx    on public.messages (section_id, created_at desc);
create index if not exists messages_created_idx    on public.messages (created_at desc);
create index if not exists messages_sender_idx     on public.messages (sender_id);
create index if not exists messages_peer_high_idx  on public.messages (peer_high);
create index if not exists messages_deleted_by_idx on public.messages (deleted_by);


create table if not exists public.user_blocks (
  blocker_id uuid        not null references public.profiles (id) on delete cascade,
  blocked_id uuid        not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);


-- Per-user read marker per conversation. conv_key text keeps the upsert trivial.
create table if not exists public.message_reads (
  user_id      uuid        not null references public.profiles (id) on delete cascade,
  conv_key     text        not null check (conv_key ~ '^(dm|club|section):[0-9a-f-]{36}$'),
  last_read_at timestamptz not null default now(),
  primary key (user_id, conv_key)
);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Helper — dm_can_send (caller-bound; NOT a third-party oracle)           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Derives self = auth.uid() internally (matches club_is_member/study_is_member).
-- True iff caller has an accepted connection with `other` AND no block exists in
-- either direction. SECURITY DEFINER because the caller can read neither the
-- other party's connections nor blocks directly.
create or replace function public.dm_can_send(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and ((c.requester_id = auth.uid() and c.addressee_id = other)
        or (c.requester_id = other      and c.addressee_id = auth.uid()))
  )
  and not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = other)
       or (b.blocker_id = other      and b.blocked_id = auth.uid())
  );
$$;
revoke execute on function public.dm_can_send(uuid) from public, anon;
grant  execute on function public.dm_can_send(uuid) to authenticated;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. RLS                                                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table public.messages      enable row level security;
alter table public.user_blocks   enable row level security;
alter table public.message_reads enable row level security;

revoke all on public.messages      from anon;
revoke all on public.user_blocks   from anon;
revoke all on public.message_reads from anon;

-- No DELETE grant on messages (soft-delete only).
grant select, insert, update on public.messages      to authenticated;
grant select, insert, delete on public.user_blocks   to authenticated;
grant select, insert, update, delete on public.message_reads to authenticated;

-- ---- messages ----
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated using (
     (kind = 'dm'      and auth.uid() in (peer_low, peer_high))
  or (kind = 'club'    and public.club_is_member(club_id))
  or (kind = 'section' and public.study_is_member(section_id))
);

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid()
  and edited_at is null and deleted_at is null and deleted_by is null
  and (
       (kind = 'dm'
          and dm_can_send(case when peer_low = auth.uid() then peer_high else peer_low end))
    or (kind = 'club'    and public.club_is_member(club_id))
    or (kind = 'section' and public.study_is_member(section_id))
  )
);

-- Edit (sender) or soft-delete (sender or moderator). Column-level rules and the
-- edit-vs-delete split are enforced by the BEFORE UPDATE guard trigger below.
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated
  using (
       sender_id = auth.uid()
    or (kind = 'club'    and public.club_can_post(club_id))
    or (kind = 'section' and public.study_is_cr(section_id))
  )
  with check (
       sender_id = auth.uid()
    or (kind = 'club'    and public.club_can_post(club_id))
    or (kind = 'section' and public.study_is_cr(section_id))
  );

-- ---- user_blocks (blocked party must NOT be able to see they're blocked) ----
drop policy if exists user_blocks_select on public.user_blocks;
create policy user_blocks_select on public.user_blocks for select to authenticated
  using (blocker_id = auth.uid());

drop policy if exists user_blocks_insert on public.user_blocks;
create policy user_blocks_insert on public.user_blocks for insert to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists user_blocks_delete on public.user_blocks;
create policy user_blocks_delete on public.user_blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- ---- message_reads (own rows only) ----
drop policy if exists message_reads_select on public.message_reads;
create policy message_reads_select on public.message_reads for select to authenticated
  using (user_id = auth.uid());

drop policy if exists message_reads_insert on public.message_reads;
create policy message_reads_insert on public.message_reads for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists message_reads_update on public.message_reads;
create policy message_reads_update on public.message_reads for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists message_reads_delete on public.message_reads;
create policy message_reads_delete on public.message_reads for delete to authenticated
  using (user_id = auth.uid());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Guard triggers                                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- BEFORE INSERT: pin system columns (kill client-forged timestamps) + flood brake.
create or replace function public.messages_insert_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now();
  new.edited_at  := null;
  new.deleted_at := null;
  new.deleted_by := null;

  if (select count(*) from public.messages
        where sender_id = auth.uid()
          and created_at > now() - interval '10 seconds') >= 20 then
    raise exception 'Slow down — you are sending messages too fast';
  end if;

  return new;
end;
$$;
revoke execute on function public.messages_insert_guard() from public, anon, authenticated;

drop trigger if exists messages_insert_guard_trg on public.messages;
create trigger messages_insert_guard_trg
  before insert on public.messages
  for each row execute function public.messages_insert_guard();


-- BEFORE UPDATE: immutable structural columns; edit = sender only; delete =
-- sender or moderator; all timestamp/flag columns recomputed here so they can
-- never be forged or erased by the client.
create or replace function public.messages_update_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- structural columns are immutable
  if new.id <> old.id
     or new.kind <> old.kind
     or new.sender_id is distinct from old.sender_id
     or new.club_id   is distinct from old.club_id
     or new.section_id is distinct from old.section_id
     or new.peer_low  is distinct from old.peer_low
     or new.peer_high is distinct from old.peer_high
     or new.created_at <> old.created_at then
    raise exception 'These message fields cannot be changed';
  end if;

  -- nothing may change once removed (no edit, no undelete)
  if old.deleted_at is not null then
    raise exception 'This message was removed';
  end if;

  -- DELETE intent: client set deleted_at to any non-null value
  if new.deleted_at is not null then
    if auth.uid() is distinct from old.sender_id
       and not (old.kind = 'club'    and public.club_can_post(old.club_id))
       and not (old.kind = 'section' and public.study_is_cr(old.section_id)) then
      raise exception 'Only the sender or a moderator can remove a message';
    end if;
    new.deleted_at := now();
    new.deleted_by := auth.uid();
    new.body       := '';           -- scrub content (satisfies body_ck deleted branch)
    new.edited_at  := old.edited_at;
    return new;
  end if;

  -- EDIT path: sender only (a moderator hitting this path is rejected here, so
  -- moderators can delete but never rewrite someone else's words)
  if auth.uid() is distinct from old.sender_id then
    raise exception 'Only the sender can edit a message';
  end if;
  if new.body is distinct from old.body then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  new.deleted_at := null;
  new.deleted_by := null;
  return new;
end;
$$;
revoke execute on function public.messages_update_guard() from public, anon, authenticated;

drop trigger if exists messages_update_guard_trg on public.messages;
create trigger messages_update_guard_trg
  before update on public.messages
  for each row execute function public.messages_update_guard();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. DM notification (throttled, DM-only, direct insert — no create_notif.)  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Group chats never notify (badges cover them). At most one 'messages'
-- notification per sender->recipient per 6 hours. Never includes message body.
create or replace function public.notify_dm_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_recipient uuid;
  v_name      text;
begin
  if new.kind <> 'dm' then
    return new;
  end if;

  v_recipient := case when new.sender_id = new.peer_low then new.peer_high else new.peer_low end;
  if v_recipient is null then
    return new;
  end if;

  -- throttle: skip if we already notified this recipient about this sender recently
  if exists (
    select 1 from public.notifications
    where user_id = v_recipient
      and sector = 'messages'
      and reference_type = 'dm'
      and reference_id = new.sender_id
      and created_at > now() - interval '6 hours'
  ) then
    return new;
  end if;

  -- inline prefs (this backend has no create_notification): master pause + sector toggle
  if exists (select 1 from public.notif_prefs
               where user_id = v_recipient and sector = '_paused' and enabled) then
    return new;
  end if;
  if coalesce((select enabled from public.notif_prefs
                 where user_id = v_recipient and sector = 'messages'), true) is false then
    return new;
  end if;

  select full_name into v_name from public.profiles where id = new.sender_id;

  insert into public.notifications (user_id, sector, title, body, reference_id, reference_type)
  values (
    v_recipient, 'messages', 'New message',
    coalesce(v_name, 'A student') || ' sent you a message.',   -- never the message text
    new.sender_id, 'dm'                                          -- deep-link -> /messages/dm/<sender>
  );

  return new;
end;
$$;
revoke execute on function public.notify_dm_message() from public, anon;

drop trigger if exists messages_dm_notify_trg on public.messages;
create trigger messages_dm_notify_trg
  after insert on public.messages
  for each row execute function public.notify_dm_message();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. Realtime broadcast fan-out + receive authorization                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- One broadcast per message change into its conversation topic. Wrapped so a
-- realtime hiccup can NEVER roll back the actual message write (realtime.send
-- already swallows internally, but this is belt-and-suspenders).
create or replace function public.broadcast_message_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_topic text;
begin
  v_topic := case new.kind
    when 'dm'      then 'chat:dm:' || new.peer_low || ':' || new.peer_high
    when 'club'    then 'chat:club:' || new.club_id
    when 'section' then 'chat:section:' || new.section_id
  end;

  begin
    perform realtime.broadcast_changes(
      v_topic, tg_op, tg_op, tg_table_name, tg_table_schema, new, old
    );
  exception when others then
    -- never let a broadcast failure abort the message; client refetches on reconnect
    null;
  end;

  return new;
end;
$$;
revoke execute on function public.broadcast_message_change() from public, anon;

drop trigger if exists messages_broadcast_trg on public.messages;
create trigger messages_broadcast_trg
  after insert or update on public.messages
  for each row execute function public.broadcast_message_change();

-- Receive authorization — evaluated ONCE at channel join (private channels).
-- The uuid-shape regex guards the ::uuid cast so a malformed topic denies (false)
-- instead of raising an error.
drop policy if exists chat_topic_read on realtime.messages;
create policy chat_topic_read on realtime.messages for select to authenticated using (
  case
    when realtime.topic() like 'chat:dm:%' then
      auth.uid()::text in (
        split_part(realtime.topic(), ':', 3),
        split_part(realtime.topic(), ':', 4)
      )
    when realtime.topic() ~ '^chat:club:[0-9a-f-]{36}$' then
      public.club_is_member(split_part(realtime.topic(), ':', 3)::uuid)
    when realtime.topic() ~ '^chat:section:[0-9a-f-]{36}$' then
      public.study_is_member(split_part(realtime.topic(), ':', 3)::uuid)
    else false
  end
);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. Lock down grants (Supabase default-privileges grant ALL on new public   ║
-- ║    tables to authenticated; enforce soft-delete-only at the grant layer).  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
revoke delete, truncate on public.messages from authenticated;
revoke truncate on public.user_blocks   from authenticated;
revoke truncate on public.message_reads from authenticated;
revoke update on public.user_blocks from authenticated;  -- blocks are insert/delete only
