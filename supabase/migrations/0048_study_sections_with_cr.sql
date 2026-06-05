-- ============================================================================
-- FixIt — Migration 0048: roster-independent "has a CR" signal for sections
-- ----------------------------------------------------------------------------
-- study_section_members RLS hides a section's roster from non-members (correct),
-- so the client can't tell whether a LOCKED section even has a CR. That made the
-- whole cross-section access flow unreachable: every other section looked like
-- "no CR yet", so a CR could never see/press "Request access".
--
-- This SECURITY DEFINER function returns ONLY the set of section ids that have an
-- approved CR — no names, no roster, nothing sensitive. The client uses it to
-- decide whether to offer "Request access" on a locked section.
-- ============================================================================
create or replace function public.study_sections_with_cr()
returns table (section_id uuid)
language sql stable security definer set search_path = public as $$
  select distinct m.section_id
  from public.study_section_members m
  where m.role = 'cr' and m.status = 'approved';
$$;

revoke execute on function public.study_sections_with_cr() from public, anon;
grant  execute on function public.study_sections_with_cr() to authenticated;
