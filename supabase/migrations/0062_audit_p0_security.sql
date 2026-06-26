-- 0062 audit P0 security hardening
-- Fixes verified data-exposure findings from the 2026-06-19 audit.

-- 1. ride_requests: was readable by everyone (USING true). Restrict SELECT to the
--    requester or the ride's driver. Seat counts move to ride_request_counts() below.
drop policy if exists ride_req_select on public.ride_requests;
create policy ride_req_select on public.ride_requests
  for select to authenticated
  using (
    requester_id = (select auth.uid())
    or exists (
      select 1 from public.rides r
      where r.id = ride_requests.ride_id
        and r.driver_id = (select auth.uid())
    )
  );

-- aggregate seat counts, safe to expose now that row SELECT is restricted
create or replace function public.ride_request_counts()
returns table(ride_id uuid, taken bigint)
language sql
security definer
set search_path = public
as $$
  select rr.ride_id, count(*)::bigint
  from ride_requests rr
  group by rr.ride_id;
$$;
revoke execute on function public.ride_request_counts() from anon;
grant execute on function public.ride_request_counts() to authenticated;

-- 2. donor_contact: honor the donor's show_whatsapp consent flag; pin search_path
create or replace function public.donor_contact(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_whatsapp text;
begin
  select case when show_whatsapp then whatsapp else null end
    into v_whatsapp
  from profiles
  where id = p_user_id;

  return json_build_object('whatsapp', v_whatsapp);
end;
$$;

-- 3. public_profiles: run with caller rights instead of owner rights (advisor ERROR
--    security_definer_view). Unused by the client; exposes only non-contact columns.
alter view public.public_profiles set (security_invoker = on);

-- 4. storage: drop broad object-listing SELECT policies on public buckets. Public
--    buckets still serve objects via their public URL without a SELECT policy.
drop policy if exists "attachments: public read" on storage.objects;
drop policy if exists "club-covers: authenticated read" on storage.objects;
drop policy if exists "job-circulars: public read" on storage.objects;
drop policy if exists "photos: public read" on storage.objects;

-- 5. pin search_path on the remaining mutable-search_path functions
alter function public.set_ride_expires_at() set search_path = public;
alter function public.gen_section_join_code() set search_path = public;
alter function public.set_section_join_code() set search_path = public;

-- 6. club_member_counts existed in the DB but not in source control. Re-declare it
--    here for reproducible deploys and revoke the unnecessary anon grant.
create or replace function public.club_member_counts()
returns table(club_id uuid, members bigint)
language sql
security definer
set search_path = public
as $$
  select cm.club_id, count(*)::bigint
  from club_members cm
  group by cm.club_id;
$$;
revoke execute on function public.club_member_counts() from anon;
