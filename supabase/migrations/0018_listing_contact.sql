-- ============================================================================
-- FixIt — Migration 0018: marketplace seller contact
-- ----------------------------------------------------------------------------
-- A buyer needs the seller's WhatsApp to arrange a deal, but profiles RLS only
-- exposes whatsapp to self / admin / matched-claim parties. This SECURITY
-- DEFINER RPC returns a listing's seller name + whatsapp — but only when the
-- seller has opted in via profiles.show_whatsapp (else whatsapp is null).
-- Mirrors the student_directory() / booked_slots() pattern.
-- ============================================================================
create or replace function public.listing_contact(p_code text)
returns table (name text, whatsapp text)
language sql stable security definer set search_path = public
as $$
  select p.full_name,
         case when p.show_whatsapp then p.whatsapp else null end
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  where l.code = p_code;
$$;
revoke execute on function public.listing_contact(text) from public, anon;
grant execute on function public.listing_contact(text) to authenticated;
