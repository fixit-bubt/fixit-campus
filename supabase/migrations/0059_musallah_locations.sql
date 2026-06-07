-- ============================================================================
-- FixIt — Migration 0059: musallah locations (admin-editable)
-- ----------------------------------------------------------------------------
-- Prayer.jsx previously hardcoded two musallah locations. This table lets
-- admins update names and floor descriptions without a code deployment.
-- Existing values seeded; further changes via Admin > Prayer Times.
-- ============================================================================
create table public.musallah_locations (
  id         smallint generated always as identity primary key,
  name       text not null,
  floor_desc text not null default '',
  sort       smallint not null default 0
);

alter table public.musallah_locations enable row level security;
revoke all on public.musallah_locations from anon;
grant select, insert, update, delete on public.musallah_locations to authenticated;

create policy musallah_select on public.musallah_locations
  for select to authenticated using (true);

create policy musallah_admin_write on public.musallah_locations
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Seed the two existing hardcoded locations.
insert into public.musallah_locations (name, floor_desc, sort) values
  ('Central Musallah',  '4th floor, Main Academic Building', 1),
  ('Women''s Musallah', '2nd floor, Annex Building',         2);
