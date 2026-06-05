-- ============================================================================
-- FixIt — Migration 0046: Study Hub  (DRAFT — review before applying)
-- ----------------------------------------------------------------------------
-- Per-section study workspace: notes, question bank, books, pins, and a
-- CR-mediated cross-section access flow.
--
-- Hierarchy:  departments (existing, 0031) → study_intakes → study_sections
--             study_sections → study_courses → study_materials
--             study_sections → study_question_bank / study_pins
--             study_intakes  → study_books (shared across the intake's sections)
--
-- Membership & roles (single table, study_section_members):
--   • A student REQUESTS to join a section  → role 'member', status 'pending'.
--   • The section's CR APPROVES             → status 'approved' (can now read).
--   • An ADMIN assigns a CR                 → role 'cr' (admin-only; see guard).
--   • A CR promotes an approved member      → role 'editor'.
--   Read access to a section = approved member of it, OR approved member of a
--   section that holds a grant to it (cross-section access).
--
-- DELIBERATE: ADMIN CANNOT READ SECTION CONTENT. Per the product owner, admins
-- only assign CRs (manage study_section_members) and the reference catalogue
-- (intakes/sections). The content tables' SELECT policies intentionally OMIT the
-- usual is_admin() bypass — admins are not superusers over student notes.
--
-- Conventions mirror 0031/0016: uuid PKs, set_updated_at(), revoke anon →
-- enable RLS → grant authenticated → policies. RLS membership checks go through
-- SECURITY DEFINER helpers so policies never recurse into RLS-protected tables.
-- File access uses a PRIVATE 'study-materials' bucket (authenticated read via
-- short-lived signed URLs; the app stores the object path).
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Tables                                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table public.study_intakes (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  number        int  not null,
  years         text,
  created_at    timestamptz not null default now(),
  unique (department_id, number)
);
create index study_intakes_dept_idx on public.study_intakes (department_id);

create table public.study_sections (
  id         uuid primary key default gen_random_uuid(),
  intake_id  uuid not null references public.study_intakes (id) on delete cascade,
  number     int  not null,
  created_at timestamptz not null default now(),
  unique (intake_id, number)
);
create index study_sections_intake_idx on public.study_sections (intake_id);

-- Membership + role + approval status in one row per (section, user).
create table public.study_section_members (
  id         uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.study_sections (id) on delete cascade,
  user_id    uuid not null references public.profiles (id)       on delete cascade,
  role       text not null default 'member' check (role   in ('member', 'editor', 'cr')),
  status     text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  unique (section_id, user_id)
);
create index study_members_section_idx on public.study_section_members (section_id);
create index study_members_user_idx    on public.study_section_members (user_id);

create table public.study_courses (
  id         uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.study_sections (id) on delete cascade,
  code       text not null,
  name       text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index study_courses_section_idx on public.study_courses (section_id);
create trigger study_courses_set_updated_at before update on public.study_courses
  for each row execute function public.set_updated_at();

create table public.study_materials (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.study_courses (id) on delete cascade,
  title       text not null,
  type        text not null check (type in ('Class Note', 'Lecture Slide', 'Assignment', 'Reference', 'Lab Manual')),
  storage_path text not null,           -- object path in the 'study-materials' bucket
  file_kind   text,                     -- pdf | docx | ppt | …  (display only)
  size_bytes  bigint,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index study_materials_course_idx on public.study_materials (course_id);

create table public.study_question_bank (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references public.study_sections (id) on delete cascade,
  exam        text not null check (exam in ('CT 1', 'CT 2', 'Midterm', 'Final')),
  title       text not null,
  storage_path text not null,
  file_kind   text,
  size_bytes  bigint,
  verified    boolean not null default false,   -- CR-confirmed authenticity
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index study_qb_section_idx on public.study_question_bank (section_id);

create table public.study_books (
  id          uuid primary key default gen_random_uuid(),
  intake_id   uuid not null references public.study_intakes (id) on delete cascade,
  title       text not null,
  author      text,
  edition     text,
  kind        text not null check (kind in ('Textbook', 'Reference', 'Syllabus')),
  course_code text,
  storage_path text,                    -- a file…
  url         text,                     -- …or an external link
  added_by    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (storage_path is not null or url is not null)
);
create index study_books_intake_idx on public.study_books (intake_id);

create table public.study_pins (
  id         uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.study_sections (id) on delete cascade,
  kind       text not null check (kind in ('text', 'file')),
  message    text not null,
  storage_path text,
  file_name  text,
  pinned_by  uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index study_pins_section_idx on public.study_pins (section_id);

create table public.study_access_requests (
  id              uuid primary key default gen_random_uuid(),
  from_section_id uuid not null references public.study_sections (id) on delete cascade,
  to_section_id   uuid not null references public.study_sections (id) on delete cascade,
  requested_by    uuid references public.profiles (id) on delete set null,
  message         text,
  status          text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at      timestamptz not null default now(),
  decided_by      uuid references public.profiles (id) on delete set null,
  decided_at      timestamptz,
  check (from_section_id <> to_section_id)
);
-- At most one OPEN request per (from, to) pair.
create unique index study_access_req_pending_unique
  on public.study_access_requests (from_section_id, to_section_id)
  where status = 'pending';

create table public.study_section_grants (
  id              uuid primary key default gen_random_uuid(),
  from_section_id uuid not null references public.study_sections (id) on delete cascade,
  to_section_id   uuid not null references public.study_sections (id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (from_section_id, to_section_id),
  check (from_section_id <> to_section_id)
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ RLS helper functions (SECURITY DEFINER → never recurse into RLS)          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Approved member of a section?
create or replace function public.study_is_member(sec uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.study_section_members m
    where m.section_id = sec and m.user_id = auth.uid() and m.status = 'approved'
  );
$$;

-- Approved member who can contribute (CR or Editor)?
create or replace function public.study_can_edit(sec uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.study_section_members m
    where m.section_id = sec and m.user_id = auth.uid()
      and m.status = 'approved' and m.role in ('cr', 'editor')
  );
$$;

-- CR of a section?
create or replace function public.study_is_cr(sec uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.study_section_members m
    where m.section_id = sec and m.user_id = auth.uid()
      and m.status = 'approved' and m.role = 'cr'
  );
$$;

-- Can VIEW a section's content: approved member, or approved member of a
-- section that has been granted access to it.
create or replace function public.study_can_view(sec uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.study_is_member(sec) or exists (
    select 1
    from public.study_section_grants g
    join public.study_section_members m on m.section_id = g.from_section_id
    where g.to_section_id = sec and m.user_id = auth.uid() and m.status = 'approved'
  );
$$;

-- Approved member of ANY section in an intake (books are intake-wide).
create or replace function public.study_member_of_intake(ina uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.study_section_members m
    join public.study_sections s on s.id = m.section_id
    where s.intake_id = ina and m.user_id = auth.uid() and m.status = 'approved'
  );
$$;

-- Contributor (CR/Editor) of ANY section in an intake (who may add books).
create or replace function public.study_editor_of_intake(ina uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.study_section_members m
    join public.study_sections s on s.id = m.section_id
    where s.intake_id = ina and m.user_id = auth.uid()
      and m.status = 'approved' and m.role in ('cr', 'editor')
  );
$$;

-- Can the current user read a given storage object? Joins the object path back
-- to the content tables and reuses the section-view helpers (which omit
-- is_admin(), so admins are excluded from file reads too). SECURITY DEFINER →
-- bypasses the content tables' own RLS and checks membership directly.
create or replace function public.study_can_read_object(obj text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.study_materials mt
            join public.study_courses c on c.id = mt.course_id
            where mt.storage_path = obj and public.study_can_view(c.section_id))
    or exists (select 1 from public.study_question_bank q
               where q.storage_path = obj and public.study_can_view(q.section_id))
    or exists (select 1 from public.study_pins p
               where p.storage_path = obj and public.study_can_view(p.section_id))
    or exists (select 1 from public.study_books b
               where b.storage_path = obj and public.study_member_of_intake(b.intake_id));
$$;

revoke execute on function
  public.study_is_member(uuid), public.study_can_edit(uuid), public.study_is_cr(uuid),
  public.study_can_view(uuid), public.study_member_of_intake(uuid), public.study_editor_of_intake(uuid),
  public.study_can_read_object(text)
  from public, anon;
grant execute on function
  public.study_is_member(uuid), public.study_can_edit(uuid), public.study_is_cr(uuid),
  public.study_can_view(uuid), public.study_member_of_intake(uuid), public.study_editor_of_intake(uuid),
  public.study_can_read_object(text)
  to authenticated;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Integrity triggers                                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Only an admin may grant the CR role; stamp approval metadata.
create or replace function public.study_members_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Identity columns can't be re-targeted once the row exists.
  if tg_op = 'UPDATE' and (new.section_id <> old.section_id or new.user_id <> old.user_id) then
    raise exception 'Cannot move a membership to another section or user';
  end if;
  if new.role = 'cr' and not public.is_admin() then
    raise exception 'Only an admin can assign the CR role';
  end if;
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    new.decided_by := auth.uid();
    new.decided_at := now();
  end if;
  return new;
end;
$$;
create trigger study_members_guard
  before insert or update on public.study_section_members
  for each row execute function public.study_members_guard();

-- Stamp the decision, and on approval materialise the cross-section grant.
create or replace function public.study_access_decide()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'denied') then
    new.decided_by := auth.uid();
    new.decided_at := now();
  end if;
  return new;
end;
$$;
create trigger study_access_decide
  before update on public.study_access_requests
  for each row execute function public.study_access_decide();

create or replace function public.study_access_grant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.study_section_grants (from_section_id, to_section_id)
    values (new.from_section_id, new.to_section_id)
    on conflict (from_section_id, to_section_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger study_access_grant
  after update on public.study_access_requests
  for each row execute function public.study_access_grant();

revoke execute on function
  public.study_members_guard(), public.study_access_decide(), public.study_access_grant()
  from public, anon, authenticated;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ RLS                                                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
revoke all on
  public.study_intakes, public.study_sections, public.study_section_members,
  public.study_courses, public.study_materials, public.study_question_bank,
  public.study_books, public.study_pins, public.study_access_requests,
  public.study_section_grants
  from anon;

alter table public.study_intakes          enable row level security;
alter table public.study_sections         enable row level security;
alter table public.study_section_members  enable row level security;
alter table public.study_courses          enable row level security;
alter table public.study_materials        enable row level security;
alter table public.study_question_bank    enable row level security;
alter table public.study_books            enable row level security;
alter table public.study_pins             enable row level security;
alter table public.study_access_requests  enable row level security;
alter table public.study_section_grants   enable row level security;

grant select, insert, update, delete on
  public.study_intakes, public.study_sections, public.study_section_members,
  public.study_courses, public.study_materials, public.study_question_bank,
  public.study_books, public.study_pins, public.study_access_requests,
  public.study_section_grants
  to authenticated;

-- ── Reference catalogue: any authenticated user reads; ADMIN manages ────────
create policy study_intakes_select on public.study_intakes
  for select to authenticated using (true);
create policy study_intakes_admin on public.study_intakes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy study_sections_select on public.study_sections
  for select to authenticated using (true);
create policy study_sections_admin on public.study_sections
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── Membership: see your own row + rosters you can view; admin manages CRs ──
-- See your own membership row, your OWN section's roster, or (admin) any roster.
-- Uses study_is_member (not study_can_view) so a cross-section grant shares
-- content but NOT the other section's member list.
create policy study_members_select on public.study_section_members
  for select to authenticated
  using (user_id = auth.uid() or public.study_is_member(section_id) or public.is_admin());

-- Self-request to join (member/pending only); admins may insert any (e.g. a CR).
create policy study_members_insert on public.study_section_members
  for insert to authenticated
  with check (
    (user_id = auth.uid() and role = 'member' and status = 'pending')
    or public.is_admin()
  );

-- CR of the section approves/edits members; admin may too. (Trigger blocks a
-- non-admin from setting role = 'cr'.)
create policy study_members_update on public.study_section_members
  for update to authenticated
  using (public.study_is_cr(section_id) or public.is_admin())
  with check (public.study_is_cr(section_id) or public.is_admin());

-- Leave (own row), or CR/admin removes a member.
create policy study_members_delete on public.study_section_members
  for delete to authenticated
  using (user_id = auth.uid() or public.study_is_cr(section_id) or public.is_admin());

-- ── Courses (content — NO admin read bypass) ────────────────────────────────
create policy study_courses_select on public.study_courses
  for select to authenticated using (public.study_can_view(section_id));
create policy study_courses_insert on public.study_courses
  for insert to authenticated with check (public.study_can_edit(section_id));
create policy study_courses_update on public.study_courses
  for update to authenticated
  using (public.study_can_edit(section_id)) with check (public.study_can_edit(section_id));
create policy study_courses_delete on public.study_courses
  for delete to authenticated
  using (public.study_is_cr(section_id) or created_by = auth.uid());

-- ── Materials (gated through the owning course's section) ────────────────────
create policy study_materials_select on public.study_materials
  for select to authenticated
  using (exists (select 1 from public.study_courses c
                 where c.id = course_id and public.study_can_view(c.section_id)));
create policy study_materials_insert on public.study_materials
  for insert to authenticated
  with check (exists (select 1 from public.study_courses c
                      where c.id = course_id and public.study_can_edit(c.section_id)));
-- (Materials are intentionally immutable — no UPDATE policy. To change one,
--  delete and re-upload; matches the Course-files UI which has no edit action.)
create policy study_materials_delete on public.study_materials
  for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.study_courses c
               where c.id = course_id and public.study_is_cr(c.section_id))
  );

-- ── Question bank ───────────────────────────────────────────────────────────
create policy study_qb_select on public.study_question_bank
  for select to authenticated using (public.study_can_view(section_id));
create policy study_qb_insert on public.study_question_bank
  for insert to authenticated with check (public.study_can_edit(section_id));
-- Only a CR toggles 'verified'.
create policy study_qb_update on public.study_question_bank
  for update to authenticated
  using (public.study_is_cr(section_id)) with check (public.study_is_cr(section_id));
create policy study_qb_delete on public.study_question_bank
  for delete to authenticated
  using (uploaded_by = auth.uid() or public.study_is_cr(section_id));

-- ── Books (intake-wide) ─────────────────────────────────────────────────────
create policy study_books_select on public.study_books
  for select to authenticated using (public.study_member_of_intake(intake_id));
create policy study_books_insert on public.study_books
  for insert to authenticated with check (public.study_editor_of_intake(intake_id));
create policy study_books_delete on public.study_books
  for delete to authenticated
  using (added_by = auth.uid() or public.study_editor_of_intake(intake_id));

-- ── Pins (CR only writes) ───────────────────────────────────────────────────
create policy study_pins_select on public.study_pins
  for select to authenticated using (public.study_can_view(section_id));
create policy study_pins_insert on public.study_pins
  for insert to authenticated with check (public.study_is_cr(section_id));
create policy study_pins_delete on public.study_pins
  for delete to authenticated using (public.study_is_cr(section_id));

-- ── Access requests (CR of from creates; CR of to decides; both sides read) ──
create policy study_access_req_select on public.study_access_requests
  for select to authenticated
  using (public.study_is_cr(from_section_id) or public.study_is_cr(to_section_id) or requested_by = auth.uid());
create policy study_access_req_insert on public.study_access_requests
  for insert to authenticated
  with check (public.study_is_cr(from_section_id) and requested_by = auth.uid() and status = 'pending');
create policy study_access_req_update on public.study_access_requests
  for update to authenticated
  using (public.study_is_cr(to_section_id)) with check (public.study_is_cr(to_section_id));

-- ── Grants (created by the approval trigger; CR of `to` may read / revoke) ───
create policy study_grants_select on public.study_section_grants
  for select to authenticated
  using (public.study_is_member(from_section_id) or public.study_is_member(to_section_id));
create policy study_grants_delete on public.study_section_grants
  for delete to authenticated using (public.study_is_cr(to_section_id));
-- (No INSERT policy: grants are written only by study_access_grant(), a
--  SECURITY DEFINER trigger that bypasses RLS.)

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Storage — private 'study-materials' bucket (authenticated read)           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- NOTE (client-wiring follow-up): storage_path is plain text with no FK to
-- storage.objects. Orphans are read-safe (study_can_read_object returns false
-- for any object no content row points at — readable by no one) but are not
-- auto-reclaimed. The client must: upload under `${uid}/…` THEN insert the row
-- (roll back the upload if the insert fails), and delete the storage object when
-- it deletes/replaces a content row. A periodic sweep can reclaim stragglers.
insert into storage.buckets (id, name, public)
values ('study-materials', 'study-materials', false)
on conflict (id) do nothing;

-- Read is scoped to people who can view the owning section/intake (NOT all
-- authenticated users, and NOT admins) — mirrors the private 'proofs' bucket.
create policy "study-materials: member read"
  on storage.objects for select to authenticated
  using (bucket_id = 'study-materials' and public.study_can_read_object(name));

-- Upload only into your own folder (objects must be named `${auth.uid()}/…`),
-- mirroring the HARDENED proofs policy (0015) — stops a user writing into or
-- overwriting another user's namespace. Read stays gated by study_can_read_object.
create policy "study-materials: authenticated upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'study-materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "study-materials: owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'study-materials' and owner = auth.uid());

create policy "study-materials: owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'study-materials' and owner = auth.uid());
