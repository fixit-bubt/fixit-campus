-- ============================================================================
-- FixIt — Migration 0019: ride share contact
-- ----------------------------------------------------------------------------
-- Coordinating a carpool needs a phone number, but profiles.whatsapp is private
-- (RLS exposes it only to self / admin / matched-claim parties). This SECURITY
-- DEFINER RPC returns the name + WhatsApp of one party on a ride, but ONLY to a
-- party in the matching relationship, with a HYBRID privacy rule (the design the
-- user chose):
--
--   • A seat REQUESTER asking for the DRIVER's number → always shown. Offering a
--     ride is itself consent to be reached by people who requested a seat, so a
--     "dead" ride (nobody can contact the driver) can't happen.
--   • The DRIVER asking for a REQUESTER's number → shown ONLY if that requester
--     opted in via profiles.show_whatsapp (else whatsapp is null).
--
-- Anyone with no relationship to the ride/target gets NO row back. Mirrors the
-- listing_contact() / student_directory() pattern (RLS-gated contact reveal).
-- ============================================================================
create or replace function public.ride_contact(p_code text, p_target uuid)
returns table (name text, whatsapp text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_ride_id uuid;
  v_driver  uuid;
begin
  select id, driver_id into v_ride_id, v_driver
  from public.rides where code = p_code;
  if v_ride_id is null then return; end if;

  -- A requester asking for the driver's number → always shown.
  if p_target = v_driver
     and exists (select 1 from public.ride_requests
                 where ride_id = v_ride_id and requester_id = auth.uid()) then
    return query
      select p.full_name, p.whatsapp
      from public.profiles p where p.id = p_target;
    return;
  end if;

  -- The driver asking for a requester's number → gated by show_whatsapp.
  if v_driver = auth.uid()
     and exists (select 1 from public.ride_requests
                 where ride_id = v_ride_id and requester_id = p_target) then
    return query
      select p.full_name,
             case when p.show_whatsapp then p.whatsapp else null end
      from public.profiles p where p.id = p_target;
    return;
  end if;

  -- No relationship → reveal nothing.
  return;
end;
$$;
revoke execute on function public.ride_contact(text, uuid) from public, anon;
grant execute on function public.ride_contact(text, uuid) to authenticated;
