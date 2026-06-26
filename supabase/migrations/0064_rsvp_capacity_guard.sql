-- 0064 atomic event RSVP with server-side capacity enforcement
-- Client-only capacity checks let two concurrent users RSVP past capacity.
-- This RPC locks the event row so the count + insert are atomic.

create or replace function public.rsvp_event(p_event_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cap int;
  v_count int;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'reason', 'auth');
  end if;

  -- Lock the event row to serialize concurrent RSVPs for this event.
  select capacity into v_cap from events where id = p_event_id for update;
  if not found then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;

  if exists (select 1 from event_rsvps where event_id = p_event_id and user_id = v_uid) then
    return json_build_object('ok', true, 'already', true);
  end if;

  if v_cap is not null then
    select count(*) into v_count from event_rsvps where event_id = p_event_id;
    if v_count >= v_cap then
      return json_build_object('ok', false, 'reason', 'full');
    end if;
  end if;

  insert into event_rsvps (event_id, user_id) values (p_event_id, v_uid);
  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.rsvp_event(uuid) from anon;
grant execute on function public.rsvp_event(uuid) to authenticated;
