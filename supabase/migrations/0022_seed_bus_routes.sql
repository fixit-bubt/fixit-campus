-- ============================================================================
-- FixIt — Migration 0022: seed the campus shuttle bus routes
-- ----------------------------------------------------------------------------
-- 0016 created public.bus_routes (admin-managed reference data) but left it
-- empty; the routes lived as an in-screen BUS_ROUTES constant. This seeds those
-- six routes so Bus Schedule runs on live data. An admin can add/edit more.
--
-- NOTE on `days`: the schema models it as text[], but the Bus screen treats the
-- day range as a single opaque display string ("Sat–Wed") — it's never parsed
-- into weekdays (unlike doctors.days). So we store it as a one-element array and
-- the store joins it back to a string. leg_mins has one entry per gap between
-- consecutive stops (length = stops - 1) and drives the representative timetable.
-- Idempotent: on conflict do nothing.
-- ============================================================================
insert into public.bus_routes
  (id, name, area, bus_no, helper_name, helper_phone, days, friday_note, stops, leg_mins, to_departures, from_departures)
values
  ('BR-07', 'Uttara Line',      'Uttara',      'BUBT-07', 'Md. Jasim',       '+8801712-554477', '{"Sat–Wed"}', 'No service on Friday & government holidays.',
   '{"Uttara House Building","Airport","Khilkhet","Mirpur-14","Mirpur-12","BUBT Campus"}', '{15,15,20,10,15}', '{"06:45","07:30"}', '{"16:30","18:15"}'),
  ('BR-03', 'Mirpur Line',      'Mirpur',      'BUBT-03', 'Sohel Rana',      '+8801813-220099', '{"Sat–Wed"}', 'No service on Friday & government holidays.',
   '{"Mirpur-1","Mirpur-2","Mirpur-10","Mirpur-11","Rupnagar","BUBT Campus"}', '{8,10,8,10,7}', '{"07:00","07:45"}', '{"16:30","17:45"}'),
  ('BR-05', 'Dhanmondi Line',   'Dhanmondi',   'BUBT-05', 'Abdul Karim',     '+8801911-778822', '{"Sat–Wed"}', 'No service on Friday & government holidays.',
   '{"Dhanmondi 27","Shyamoli","Gabtoli","Technical","Mirpur-1","BUBT Campus"}', '{12,10,8,10,12}', '{"06:50","07:40"}', '{"16:30","18:00"}'),
  ('BR-09', 'Mohammadpur Line', 'Mohammadpur', 'BUBT-09', 'Rasel Ahmed',     '+8801677-334411', '{"Sat–Wed"}', 'No service on Friday & government holidays.',
   '{"Mohammadpur Bus Stand","Shyamoli Square","Kallyanpur","Mirpur-1","Rupnagar","BUBT Campus"}', '{10,8,10,12,8}', '{"07:00","07:50"}', '{"16:30","17:50"}'),
  ('BR-02', 'Gulshan Line',     'Gulshan',     'BUBT-02', 'Tanvir Hossain',  '+8801556-990011', '{"Sat–Wed"}', 'No service on Friday & government holidays.',
   '{"Gulshan-1","Mohakhali","Bijoy Sarani","Agargaon","Mirpur-10","BUBT Campus"}', '{12,10,12,12,14}', '{"06:40","07:30"}', '{"16:30","18:10"}'),
  ('BR-11', 'Savar Line',       'Savar',       'BUBT-11', 'Mizanur Rahman',  '+8801722-446688', '{"Sat–Wed"}', 'No service on Friday & government holidays.',
   '{"Savar Bazar","Hemayetpur","Amin Bazar","Gabtoli","Technical","BUBT Campus"}', '{15,12,12,10,12}', '{"06:30","07:20"}', '{"16:30","17:40"}')
on conflict (id) do nothing;
