-- ============================================================================
-- FixIt — Migration 0006: extra profile fields
-- Adds WhatsApp, intake, section, and a profile photo to profiles.
--   • avatar_url is exposed in public_profiles (photos show across the app).
--   • whatsapp / intake / section stay PRIVATE — revealed to others only via
--     the contact reveal on an approved Lost & Found claim (profiles RLS).
-- ============================================================================

alter table public.profiles
  add column if not exists whatsapp   text,
  add column if not exists intake     text,
  add column if not exists section    text,
  add column if not exists avatar_url text;

-- Re-create the public directory view to include the avatar (names + photo +
-- role + department only — never email/whatsapp/intake/section).
create or replace view public.public_profiles as
  select id, full_name, role, department, avatar_url
  from public.profiles;

grant select on public.public_profiles to authenticated;
revoke all on public.public_profiles from anon;
