-- ============================================================================
-- FixIt — Migration 0080: report vote counts for admin triage
-- ----------------------------------------------------------------------------
-- The admin "All Reports" view wants a "me too" count per report so high-demand
-- issues can be prioritised. report_votes rows are private to their owner
-- (0079 report_votes_select is user_id = auth.uid()), so an admin cannot read
-- other users' votes directly. This SECURITY DEFINER RPC returns ONLY the
-- aggregate count per report (no voter identity) and only to staff/admin — for
-- anyone else the is_staff_or_admin() guard filters every row out, so it returns
-- an empty set.
-- ============================================================================

create or replace function public.report_vote_counts()
returns table (report_id uuid, vote_count bigint)
language sql
security definer
stable
set search_path = public
as $$
  select v.report_id, count(*) as vote_count
  from public.report_votes v
  where public.is_staff_or_admin()
  group by v.report_id;
$$;

revoke execute on function public.report_vote_counts() from public, anon;
grant execute on function public.report_vote_counts() to authenticated;

-- ============================================================================
-- End of migration 0080
-- ============================================================================
