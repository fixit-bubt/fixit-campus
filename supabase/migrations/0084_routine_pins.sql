-- ============================================================================
-- FixIt — Migration 0084: Routine pins (save a routine for quick access)
-- ----------------------------------------------------------------------------
-- Lets a signed-in user pin a class/exam routine so it sorts to the top of
-- the Routines list instead of getting buried among every department's
-- postings. Mirrors job_bookmarks / faculty_bookmarks: a thin join table,
-- every row private to its owner.
-- ============================================================================

create table public.routine_pins (
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  routine_id uuid        not null references public.routines (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, routine_id)
);

create index routine_pins_user_idx on public.routine_pins (user_id);

-- RLS — a pin is visible/writable only by its owner.
revoke all on public.routine_pins from anon;
alter table public.routine_pins enable row level security;
grant select, insert, delete on public.routine_pins to authenticated;

create policy routine_pins_select on public.routine_pins
  for select to authenticated using (user_id = auth.uid());

create policy routine_pins_insert on public.routine_pins
  for insert to authenticated with check (user_id = auth.uid());

create policy routine_pins_delete on public.routine_pins
  for delete to authenticated using (user_id = auth.uid());

-- ============================================================================
-- End of migration 0084
-- ============================================================================
