-- ============================================================================
-- FixIt — Migration 0058: staff expertise field
-- Adds an optional free-text expertise column to profiles so admins can label
-- staff members' area (e.g. "Electrical Engineering", "IT Support").
-- Also exposed in public_profiles so any signed-in user can see it.
-- ============================================================================

alter table public.profiles
  add column if not exists expertise text;

-- Re-create the public directory view to include expertise.
create or replace view public.public_profiles as
  select id, full_name, role, department, expertise, avatar_url
  from public.profiles;

grant select on public.public_profiles to authenticated;
revoke all on public.public_profiles from anon;

-- ============================================================================
-- End of migration 0058
-- ============================================================================
