-- ============================================================================
-- FixIt — Migration 0083: connection-request notifications (prod-safe)
-- ----------------------------------------------------------------------------
-- 0067 defined notify_connection() via create_notification(), but prod has
-- NEITHER (schema drift) — so a connection request/accept produced no
-- notification at all, and the addressee had to discover the request in the
-- Students directory. This inserts into notifications DIRECTLY (the 0075/0076/
-- 0082 pattern) with inline pref checks.
--
-- reference_id is stored as TEXT (prod's actual column type) and carries the
-- COUNTERPARTY id so the client can offer inline Accept/Decline:
--   * request  -> reference_type 'connection_request',  reference_id = requester
--   * accepted -> reference_type 'connection_accepted', reference_id = addressee
-- ============================================================================

create or replace function public.notify_connection()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_recipient uuid;
  v_ref       uuid;
  v_reftype   text;
  v_title     text;
  v_name      text;
  v_body      text;
begin
  if tg_op = 'INSERT' then
    -- new pending request -> tell the addressee
    v_recipient := new.addressee_id;
    v_ref       := new.requester_id;
    v_reftype   := 'connection_request';
    v_title     := 'New connection request';
    select full_name into v_name from public.profiles where id = new.requester_id;
    v_body      := coalesce(v_name, 'A student') || ' wants to connect with you.';
  elsif tg_op = 'UPDATE'
        and new.status = 'accepted' and old.status is distinct from 'accepted' then
    -- request accepted -> tell the original requester
    v_recipient := new.requester_id;
    v_ref       := new.addressee_id;
    v_reftype   := 'connection_accepted';
    v_title     := 'Connection accepted';
    select full_name into v_name from public.profiles where id = new.addressee_id;
    v_body      := coalesce(v_name, 'A student') || ' accepted your connection request.';
  else
    return null;
  end if;

  if v_recipient is null then
    return null;
  end if;

  -- inline prefs: master pause + 'directory' sector toggle (absent row = on)
  if exists (select 1 from public.notif_prefs
               where user_id = v_recipient and sector = '_paused' and enabled) then
    return null;
  end if;
  if coalesce((select enabled from public.notif_prefs
                 where user_id = v_recipient and sector = 'directory'), true) is false then
    return null;
  end if;

  insert into public.notifications (user_id, sector, title, body, reference_id, reference_type)
  values (v_recipient, 'directory', v_title, v_body, v_ref::text, v_reftype);

  return null;
end;
$$;
revoke execute on function public.notify_connection() from public, anon;

drop trigger if exists notify_connection_trg on public.connections;
create trigger notify_connection_trg
  after insert or update on public.connections
  for each row execute function public.notify_connection();
