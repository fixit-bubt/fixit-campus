-- ============================================================================
-- FixIt — Migration 0082: fix notify_dm_message() type mismatch
-- ----------------------------------------------------------------------------
-- Prod's notifications.reference_id is TEXT (schema drift — 0067 declared it
-- uuid). 0081's throttle check compared `reference_id = new.sender_id`
-- (text = uuid), which raised 42883 inside the AFTER INSERT trigger and aborted
-- EVERY DM insert ("You can only message..." on the client). Group chats were
-- unaffected (the function returns before this code for non-dm).
--
-- Fix: compare and store the sender id as text (cast both sides so it works
-- whether reference_id is text or uuid).
-- ============================================================================

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

  -- throttle: at most one 'messages' notification per sender->recipient / 6h
  if exists (
    select 1 from public.notifications
    where user_id = v_recipient
      and sector = 'messages'
      and reference_type = 'dm'
      and reference_id::text = new.sender_id::text
      and created_at > now() - interval '6 hours'
  ) then
    return new;
  end if;

  -- inline prefs (this backend has no create_notification): master pause + sector
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
    coalesce(v_name, 'A student') || ' sent you a message.',
    new.sender_id::text, 'dm'
  );

  return new;
end;
$$;
revoke execute on function public.notify_dm_message() from public, anon;
