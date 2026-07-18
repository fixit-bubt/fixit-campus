-- ============================================================================
-- FixIt — Migration 0070: anon read for public reference data
-- ----------------------------------------------------------------------------
-- The landing page grows public (no-login) Faculty / Events / Bus & Prayer
-- screens. Only non-personal reference tables open up, and contact-ish
-- columns stay authenticated-only via column-level grants:
--   faculty     -> email, phone excluded
--   bus_routes  -> helper_name, helper_phone excluded
--   events      -> created_by excluded
-- Everything else (reports, profiles, blood, marketplace, …) stays locked.
-- Anon SELECT with a column grant means public screens must list columns
-- explicitly — select('*') as anon fails with "permission denied".
-- ============================================================================

-- ---- departments (needed to label faculty) --------------------------------
grant select on public.departments to anon;
create policy departments_anon_select on public.departments
  for select to anon using (true);

-- ---- faculty (public directory data; no email/phone) -----------------------
grant select (id, department_id, name, designation, photo_url,
              research_interests, qualifications, on_leave, is_chairman,
              scholar_url, researchgate_url, linkedin_url, orcid_url,
              website_url, profile_url)
  on public.faculty to anon;
create policy faculty_anon_select on public.faculty
  for select to anon using (true);

-- ---- events (campus events are announced publicly anyway) ------------------
grant select (id, code, title, category, organizer, date, time, end_time,
              venue, description, capacity, banner_url, created_at)
  on public.events to anon;
create policy events_anon_select on public.events
  for select to anon using (true);

-- ---- bus routes (schedules only; helper contact stays signed-in) -----------
grant select (id, name, area, bus_no, days, friday_note, stops, leg_mins,
              to_departures, from_departures, active)
  on public.bus_routes to anon;
create policy bus_routes_anon_select on public.bus_routes
  for select to anon using (true);

-- ---- prayer times + musallah locations -------------------------------------
grant select on public.prayer_times to anon;
create policy prayer_anon_select on public.prayer_times
  for select to anon using (true);

grant select on public.musallah_locations to anon;
create policy musallah_anon_select on public.musallah_locations
  for select to anon using (true);
