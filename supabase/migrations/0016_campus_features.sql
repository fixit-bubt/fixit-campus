-- ============================================================================
-- FixIt — Migration 0016: campus-features schema + RLS
-- ----------------------------------------------------------------------------
-- Adds the eight campus-life features (announcements, marketplace, events,
-- ride share, blood donation, medical appointments, bus routes, prayer times)
-- as a single batch. The store wires each feature to these tables one at a time,
-- keeping the useApp() value keys identical so the screens don't change.
--
-- Conventions mirrored from 0001–0015:
--   • uuid PKs (gen_random_uuid) + a human `code` via a sequence default.
--   • created_at/updated_at timestamptz + set_updated_at() trigger.
--   • Per-user collections (RSVP, pledges, seat requests, read receipts) are
--     JOIN TABLES, not array columns (cleaner RLS, no null-array crashes).
--   • RLS: revoke anon → enable RLS → grant authenticated → policies.
--   • Reference data (doctors, bus routes, prayer times) is admin-managed.
--   • Off-app contact uses profiles.whatsapp (via getContact), not a mock.
--
-- Access decisions (final): community (marketplace/rides/blood) = any signed-in
-- user; events = admins + an admin-curated organizer allowlist; announcements =
-- admin only. Applied to the FixIt project via the SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Shared helper: is the current user staff OR admin? (mirrors is_admin/is_student)
-- ----------------------------------------------------------------------------
create or replace function public.is_staff_or_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('staff','admin'));
$$;
revoke execute on function public.is_staff_or_admin() from public, anon;
grant execute on function public.is_staff_or_admin() to authenticated;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ FEATURE 1 — ANNOUNCEMENTS                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create sequence if not exists public.announcement_code_seq start 53;

create table public.announcements (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique default ('AN-' || nextval('public.announcement_code_seq')),
  title        text not null check (char_length(title) >= 3),
  body         text not null check (char_length(body) >= 1),
  department   text not null,
  priority     text not null default 'General' check (priority in ('Urgent','Important','General')),
  pinned       boolean not null default false,
  attachment_url text,                         -- Storage path/URL (PDF), nullable
  created_by   uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index announcements_created_idx on public.announcements (created_at desc);
create trigger announcements_set_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();

-- Read receipts (replaces the mock readBy array).
create table public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

revoke all on public.announcements, public.announcement_reads from anon;
alter table public.announcements      enable row level security;
alter table public.announcement_reads enable row level security;
grant select, insert, update, delete on public.announcements      to authenticated;
grant select, insert, delete         on public.announcement_reads  to authenticated;
grant usage on sequence public.announcement_code_seq to authenticated;

-- Read: any signed-in user. Write: ADMIN ONLY (decided — official notices).
-- (Screen tweak in wiring: show "Post notice" for Admin only, not Staff.)
create policy announcements_select on public.announcements for select to authenticated
  using (true);
create policy announcements_insert on public.announcements for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());
create policy announcements_update on public.announcements for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());
create policy announcements_delete on public.announcements for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- Read receipts: you manage only your own.
create policy ann_reads_select on public.announcement_reads for select to authenticated
  using (user_id = auth.uid());
create policy ann_reads_insert on public.announcement_reads for insert to authenticated
  with check (user_id = auth.uid());
create policy ann_reads_delete on public.announcement_reads for delete to authenticated
  using (user_id = auth.uid());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ FEATURE 2 — MARKETPLACE                                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create sequence if not exists public.listing_code_seq start 207;

create table public.listings (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique default ('L-' || nextval('public.listing_code_seq')),
  title        text not null check (char_length(title) >= 2),
  price        integer not null check (price >= 0),       -- ৳ BDT, whole taka
  condition    text not null check (condition in ('New','Like New','Used')),
  negotiable   boolean not null default false,
  category     text not null check (category in ('Books','Electronics','Furniture','Notes','Other')),
  description  text not null,
  photo_url    text,
  status       text not null default 'Available' check (status in ('Available','Sold')),
  seller_id    uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index listings_seller_idx on public.listings (seller_id);
create index listings_status_idx on public.listings (status);
create trigger listings_set_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

revoke all on public.listings from anon;
alter table public.listings enable row level security;
grant select, insert, update, delete on public.listings to authenticated;
grant usage on sequence public.listing_code_seq to authenticated;

-- DECIDED: marketplace is open to ALL signed-in users (any role can buy/sell).
create policy listings_select on public.listings for select to authenticated
  using (true);
create policy listings_insert on public.listings for insert to authenticated
  with check (seller_id = auth.uid());
create policy listings_update on public.listings for update to authenticated
  using (seller_id = auth.uid() or public.is_admin())
  with check (seller_id = auth.uid() or public.is_admin());
create policy listings_delete on public.listings for delete to authenticated   -- hard delete
  using (seller_id = auth.uid() or public.is_admin());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ FEATURE 3 — EVENTS                                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create sequence if not exists public.event_code_seq start 42;

create table public.events (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique default ('EV-' || nextval('public.event_code_seq')),
  title        text not null,
  category     text not null check (category in ('Academic','Cultural','Sports','Club','Career')),
  organizer    text not null,                              -- display name of the club/dept
  date         date not null,
  time         text not null,                              -- 'HH:MM'
  end_time     text,                                       -- 'HH:MM', nullable
  venue        text not null,
  description  text not null,
  capacity     integer check (capacity is null or capacity > 0),
  banner_url   text,
  created_by   uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index events_date_idx on public.events (date);
create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();

-- RSVPs (replaces the mock attendees array).
create table public.event_rsvps (
  event_id  uuid not null references public.events (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- DECIDED: events are published by ADMINS + admin-designated organizers
-- (e.g. club presidents), NOT every student. This is an admin-curated allowlist
-- — a lightweight stand-in for a full clubs system, which it can grow into.
create table public.event_organizers (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  note       text,                                         -- e.g. 'President, Computer Club'
  created_at timestamptz not null default now()
);

-- May the current user publish events? (admin or on the organizer allowlist)
create or replace function public.can_create_events()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin()
      or exists (select 1 from public.event_organizers where user_id = auth.uid());
$$;
revoke execute on function public.can_create_events() from public, anon;
grant execute on function public.can_create_events() to authenticated;

revoke all on public.events, public.event_rsvps, public.event_organizers from anon;
alter table public.events           enable row level security;
alter table public.event_rsvps      enable row level security;
alter table public.event_organizers enable row level security;
grant select, insert, update, delete on public.events     to authenticated;
grant select, insert, delete         on public.event_rsvps to authenticated;
grant select                         on public.event_organizers to authenticated;
grant usage on sequence public.event_code_seq to authenticated;

-- Organizer allowlist: everyone can read it (to show who runs events);
-- only admins add/remove organizers (from Manage Users).
create policy event_org_select on public.event_organizers for select to authenticated using (true);
create policy event_org_admin_write on public.event_organizers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Create events: admins + designated organizers only; RSVP stays open to all.
create policy events_select on public.events for select to authenticated using (true);
create policy events_insert on public.events for insert to authenticated
  with check (created_by = auth.uid() and public.can_create_events());
create policy events_update on public.events for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());
create policy events_delete on public.events for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- RSVP: you add/remove only your own.
create policy rsvps_select on public.event_rsvps for select to authenticated using (true);
create policy rsvps_insert on public.event_rsvps for insert to authenticated
  with check (user_id = auth.uid());
create policy rsvps_delete on public.event_rsvps for delete to authenticated
  using (user_id = auth.uid());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ FEATURE 4 — RIDE SHARE                                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create sequence if not exists public.ride_code_seq start 302;

create table public.rides (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique default ('RD-' || nextval('public.ride_code_seq')),
  driver_id    uuid not null references public.profiles (id) on delete cascade,
  direction    text not null check (direction in ('To Campus','From Campus')),
  vehicle      text not null check (vehicle in ('Car','CNG','Bike')),
  origin       text not null,
  destination  text not null,
  date         date not null,
  time         text not null,                              -- 'HH:MM'
  seats_total  integer not null check (seats_total > 0),
  fare         integer not null check (fare >= 0),         -- ৳ per seat
  recurring    text[] not null default '{}',               -- e.g. {Sat,Sun,Mon}
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index rides_driver_idx on public.rides (driver_id);
create index rides_date_idx   on public.rides (date);
create trigger rides_set_updated_at before update on public.rides
  for each row execute function public.set_updated_at();

-- Seat requests (replaces the mock requesterIds array).
create table public.ride_requests (
  ride_id      uuid not null references public.rides (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (ride_id, requester_id)
);

revoke all on public.rides, public.ride_requests from anon;
alter table public.rides         enable row level security;
alter table public.ride_requests enable row level security;
grant select, insert, update, delete on public.rides         to authenticated;
grant select, insert, delete         on public.ride_requests to authenticated;
grant usage on sequence public.ride_code_seq to authenticated;

create policy rides_select on public.rides for select to authenticated using (true);
create policy rides_insert on public.rides for insert to authenticated
  with check (driver_id = auth.uid());
create policy rides_update on public.rides for update to authenticated
  using (driver_id = auth.uid() or public.is_admin())
  with check (driver_id = auth.uid() or public.is_admin());
create policy rides_delete on public.rides for delete to authenticated
  using (driver_id = auth.uid() or public.is_admin());

-- Seat request: request as yourself, but NOT on your own ride.
create policy ride_req_select on public.ride_requests for select to authenticated using (true);
create policy ride_req_insert on public.ride_requests for insert to authenticated
  with check (
    requester_id = auth.uid()
    and not exists (select 1 from public.rides r where r.id = ride_id and r.driver_id = auth.uid())
  );
create policy ride_req_delete on public.ride_requests for delete to authenticated
  using (requester_id = auth.uid());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ FEATURE 5 — BLOOD DONATION                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create sequence if not exists public.blood_req_code_seq start 22;

create table public.blood_requests (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique default ('BQ-' || nextval('public.blood_req_code_seq')),
  blood_group  text not null check (blood_group in ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
  units        integer not null check (units > 0),
  patient      text not null,
  hospital     text not null,
  area         text not null,
  urgency      text not null check (urgency in ('Urgent','Today','This week')),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index blood_requests_group_idx on public.blood_requests (blood_group);
create trigger blood_requests_set_updated_at before update on public.blood_requests
  for each row execute function public.set_updated_at();

-- Pledges (replaces the mock pledges array).
create table public.blood_pledges (
  request_id uuid not null references public.blood_requests (id) on delete cascade,
  donor_id   uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, donor_id)
);

-- Donor registry — one row per user (upsert by user_id). Contact (WhatsApp)
-- comes from profiles (no phone column here) — DECIDED: the mock donor.phone is
-- dropped in favour of profiles.whatsapp via getContact.
create table public.donors (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  blood_group  text not null check (blood_group in ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
  area         text not null,
  last_donated date,                                       -- null = never / unknown
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index donors_group_idx on public.donors (blood_group);
create trigger donors_set_updated_at before update on public.donors
  for each row execute function public.set_updated_at();

revoke all on public.blood_requests, public.blood_pledges, public.donors from anon;
alter table public.blood_requests enable row level security;
alter table public.blood_pledges  enable row level security;
alter table public.donors         enable row level security;
grant select, insert, update, delete on public.blood_requests to authenticated;
grant select, insert, delete         on public.blood_pledges  to authenticated;
grant select, insert, update, delete on public.donors         to authenticated;
grant usage on sequence public.blood_req_code_seq to authenticated;

create policy blood_req_select on public.blood_requests for select to authenticated using (true);
create policy blood_req_insert on public.blood_requests for insert to authenticated
  with check (requester_id = auth.uid());
create policy blood_req_update on public.blood_requests for update to authenticated
  using (requester_id = auth.uid() or public.is_admin())
  with check (requester_id = auth.uid() or public.is_admin());
create policy blood_req_delete on public.blood_requests for delete to authenticated
  using (requester_id = auth.uid() or public.is_admin());

-- Pledge: as yourself (idempotent via PK). DECIDED: pledging on your own
-- request is allowed (you might be coordinating donors yourself).
create policy blood_pledge_select on public.blood_pledges for select to authenticated using (true);
create policy blood_pledge_insert on public.blood_pledges for insert to authenticated
  with check (donor_id = auth.uid());
create policy blood_pledge_delete on public.blood_pledges for delete to authenticated
  using (donor_id = auth.uid());

-- Donor registry: browse all; manage only your own row.
create policy donors_select on public.donors for select to authenticated using (true);
create policy donors_insert on public.donors for insert to authenticated
  with check (user_id = auth.uid());
create policy donors_update on public.donors for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy donors_delete on public.donors for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ FEATURE 6 — MEDICAL CENTER                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Doctors — admin-managed reference data (replaces the in-screen DOCTORS).
create table public.doctors (
  id          text primary key,                            -- keeps 'd1'… or use a code
  name        text not null,
  specialty   text not null,
  days        text[] not null default '{}',                -- {Sat,Sun,Mon,Tue,Wed,Thu}
  start_time  text not null,                               -- 'HH:MM'
  end_time    text not null,                               -- 'HH:MM'
  room        text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger doctors_set_updated_at before update on public.doctors
  for each row execute function public.set_updated_at();

create sequence if not exists public.appointment_code_seq start 1003;

create table public.appointments (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique default ('APT-' || nextval('public.appointment_code_seq')),
  doctor_id    text not null references public.doctors (id) on delete cascade,
  student_id   uuid not null references public.profiles (id) on delete cascade,
  date         date not null,
  slot         text not null,                              -- 'HH:MM'
  token        text not null,                              -- queue token, server-set
  status       text not null default 'Booked'
                 check (status in ('Booked','Confirmed','Completed','Cancelled')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index appointments_student_idx on public.appointments (student_id);
create index appointments_doctor_idx  on public.appointments (doctor_id, date);
-- No double-booking: one live appointment per (doctor, date, slot).
create unique index appointments_slot_unique
  on public.appointments (doctor_id, date, slot) where status <> 'Cancelled';
create trigger appointments_set_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

revoke all on public.doctors, public.appointments from anon;
alter table public.doctors      enable row level security;
alter table public.appointments enable row level security;
grant select                         on public.doctors      to authenticated;
grant select, insert, update         on public.appointments to authenticated;
grant usage on sequence public.appointment_code_seq to authenticated;

-- Doctors: everyone reads; admins manage (writes via the dashboard/SQL).
create policy doctors_select on public.doctors for select to authenticated using (true);
create policy doctors_admin_write on public.doctors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Appointments: a student sees/books their own; admins see all.
-- DECIDED (for now): admin-only beyond the student's own rows. A doctor_user_id
-- link to let Staff doctors see/advance their queue can be added later.
create policy appts_select on public.appointments for select to authenticated
  using (student_id = auth.uid() or public.is_admin());
create policy appts_insert on public.appointments for insert to authenticated
  with check (student_id = auth.uid() and status = 'Booked');
create policy appts_update on public.appointments for update to authenticated
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());
-- Token is server-set (trigger): a per-doctor, per-day queue position, so it
-- can't be forged from the client.
create or replace function public.set_appointment_token()
returns trigger language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  select count(*) + 1 into n
  from public.appointments
  where doctor_id = new.doctor_id and date = new.date and status <> 'Cancelled';
  new.token := 'T-' || lpad(n::text, 2, '0');
  return new;
end; $$;
create trigger appointments_set_token before insert on public.appointments
  for each row execute function public.set_appointment_token();

-- The booking grid must disable slots others have taken — but RLS hides other
-- students' rows. This SECURITY DEFINER RPC returns ONLY the taken slot strings
-- for a doctor+date (no patient identity), mirroring the student_directory()
-- pattern. The screen calls this instead of reading the appointments table.
create or replace function public.booked_slots(p_doctor_id text, p_date date)
returns setof text
language sql stable security definer set search_path = public
as $$
  select slot from public.appointments
  where doctor_id = p_doctor_id and date = p_date and status <> 'Cancelled';
$$;
revoke execute on function public.booked_slots(text, date) from public, anon;
grant execute on function public.booked_slots(text, date) to authenticated;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ FEATURE 7 — BUS SCHEDULE                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Routes — admin-managed reference data (replaces in-screen BUS_ROUTES).
create table public.bus_routes (
  id              text primary key,                        -- 'BR-07' style code
  name            text not null,
  area            text not null,
  bus_no          text,
  helper_name     text,
  helper_phone    text,
  days            text[] not null default '{}',
  friday_note     text,
  stops           text[] not null default '{}',
  leg_mins        integer[] not null default '{}',         -- length = stops-1
  to_departures   text[] not null default '{}',            -- 'HH:MM' list
  from_departures text[] not null default '{}',
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger bus_routes_set_updated_at before update on public.bus_routes
  for each row execute function public.set_updated_at();

-- Per-user saved routes (replaces the localStorage favourites).
create table public.saved_bus_routes (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  route_id text not null references public.bus_routes (id) on delete cascade,
  primary key (user_id, route_id)
);

revoke all on public.bus_routes, public.saved_bus_routes from anon;
alter table public.bus_routes       enable row level security;
alter table public.saved_bus_routes enable row level security;
grant select                 on public.bus_routes       to authenticated;
grant select, insert, delete on public.saved_bus_routes to authenticated;

create policy bus_routes_select on public.bus_routes for select to authenticated using (true);
create policy bus_routes_admin_write on public.bus_routes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy saved_routes_select on public.saved_bus_routes for select to authenticated
  using (user_id = auth.uid());
create policy saved_routes_insert on public.saved_bus_routes for insert to authenticated
  with check (user_id = auth.uid());
create policy saved_routes_delete on public.saved_bus_routes for delete to authenticated
  using (user_id = auth.uid());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ FEATURE 8 — PRAYER TIMES                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- A tiny config table the admin edits (Azan + Jamaat per prayer). The "this
-- month" table and countdown are computed client-side from these base times.
create table public.prayer_times (
  key      text primary key check (key in ('fajr','dhuhr','asr','maghrib','isha','jummah')),
  en       text not null,
  ar       text not null,
  azan     text not null,                                  -- 'HH:MM'
  jamaat   text not null,                                  -- 'HH:MM'
  sort     integer not null,
  updated_at timestamptz not null default now()
);
create trigger prayer_times_set_updated_at before update on public.prayer_times
  for each row execute function public.set_updated_at();

revoke all on public.prayer_times from anon;
alter table public.prayer_times enable row level security;
grant select on public.prayer_times to authenticated;
create policy prayer_select on public.prayer_times for select to authenticated using (true);
create policy prayer_admin_write on public.prayer_times for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ STORAGE                                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Listing photos + event banners are images → reuse the existing public
-- "photos" bucket (store.uploadPhoto already routes there by folder).
-- Announcement attachments are PDFs → a new public "attachments" bucket.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

create policy "attachments: public read"
  on storage.objects for select using (bucket_id = 'attachments');
create policy "attachments: admin upload"          -- notices are admin-only
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.is_admin());
create policy "attachments: owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and owner = auth.uid());
create policy "attachments: owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and owner = auth.uid());

-- ============================================================================
-- End of 0016. The store wires each feature to these tables one at a time,
-- aggregating the join tables back into the arrays the screens already read
-- (attendees / pledges / requesterIds / readBy). Announcements is wired first.
-- ============================================================================
