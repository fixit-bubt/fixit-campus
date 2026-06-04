-- ============================================================================
-- FixIt — Migration 0020: blood donation contact
-- ----------------------------------------------------------------------------
-- profiles.whatsapp is private (RLS exposes it only to self / admin /
-- matched-claim parties). Blood Donation uses a CONSENT-BY-ACTION model (the
-- design the user chose, matching the screen's own copy):
--
--   • donor_contact(user_id) — registering as a donor IS consent to be reached,
--     so any signed-in student can get a registered donor's name + WhatsApp.
--     Returns nothing if the target isn't actually in the donor registry.
--   • blood_requester_contact(code) — posting a request promises "donors who
--     respond get your WhatsApp." So the requester's name + WhatsApp is revealed
--     ONLY to a donor who has already pledged to that request.
--
-- Both are SECURITY DEFINER and granted to authenticated only — mirrors the
-- listing_contact() / ride_contact() pattern (RLS-gated contact reveal).
-- ============================================================================

-- A registered donor's contact — shown to any signed-in student (registering
-- is consent to be reachable for that blood group).
create or replace function public.donor_contact(p_user_id uuid)
returns table (name text, whatsapp text)
language sql stable security definer set search_path = public
as $$
  select p.full_name, p.whatsapp
  from public.donors d
  join public.profiles p on p.id = d.user_id
  where d.user_id = p_user_id;
$$;
revoke execute on function public.donor_contact(uuid) from public, anon;
grant execute on function public.donor_contact(uuid) to authenticated;

-- The requester's contact on a blood request — revealed ONLY to a donor who has
-- pledged to it (posting a request is consent to share with responders).
create or replace function public.blood_requester_contact(p_code text)
returns table (name text, whatsapp text)
language sql stable security definer set search_path = public
as $$
  select p.full_name, p.whatsapp
  from public.blood_requests b
  join public.profiles p on p.id = b.requester_id
  where b.code = p_code
    and exists (
      select 1 from public.blood_pledges pl
      where pl.request_id = b.id and pl.donor_id = auth.uid()
    );
$$;
revoke execute on function public.blood_requester_contact(text) from public, anon;
grant execute on function public.blood_requester_contact(text) to authenticated;
