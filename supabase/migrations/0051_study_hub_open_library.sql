-- ============================================================================
-- FixIt — Migration 0051: Study Hub redesign → open department-wide library
-- ----------------------------------------------------------------------------
-- Reshapes Study Hub from private, per-section silos into an OPEN study library:
--
--   • VIEW  — any APPROVED student in a DEPARTMENT can read every section's
--             notes / questions / books across ALL of that department's intakes.
--             (So Intake 52 CSE can study Intake 51 CSE's materials.)
--   • UPLOAD— stays restricted to APPROVED members of one's OWN section.
--   • PINS  — stay PRIVATE to a section (the CR's noticeboard for their class).
--   • ADMIN — still CANNOT read content (no is_admin() bypass on content).
--
-- Structural change: Questions and Books move INSIDE a subject (course):
--   • study_question_bank gains course_id  (was section-scoped)
--   • study_books         gains course_id  (was intake-scoped)
--   Both legacy scope columns (section_id / intake_id) are kept and still
--   populated by the app for integrity; RLS now gates them through the course.
--
-- The old cross-section access-request / grant flow is RETIRED — everything in
-- a department is open now, so a grant means nothing. Its tables, policies, and
-- triggers are left in place (forward-only, harmless) but are no longer used by
-- study_can_view; the client UI for it is removed separately.
--
-- Policy edits use `drop policy if exists … / create policy …` (mirrors 0047).
--
-- SECURITY HARDENING (from an adversarial RLS review of this migration):
--   §6 closes the admin-content firewall — with department-open view, an admin
--      could self-insert ONE approved membership and read a whole department's
--      content; now nobody may self-approve their own membership.
--   §7 binds every content row's storage_path to the writer's own folder —
--      study_can_read_object matches objects by path alone, so an unconstrained
--      path let a member plant a row pointing at another user's object and pull a
--      signed URL (leaking private pin files / other departments' files). This
--      was a pre-existing weakness in 0046, widened by department-open view.
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Questions & Books become per-course                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
alter table public.study_question_bank
  add column if not exists course_id uuid references public.study_courses (id) on delete cascade;
create index if not exists study_qb_course_idx on public.study_question_bank (course_id);

alter table public.study_books
  add column if not exists course_id uuid references public.study_courses (id) on delete cascade;
create index if not exists study_books_course_idx on public.study_books (course_id);
-- (course_id is nullable: any pre-existing section/intake-scoped rows simply stop
--  surfacing — there is effectively no production data yet. The app always sets
--  course_id AND the legacy scope column on every new insert.)

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. VIEW becomes department-open (same function name → all SELECT policies  ║
-- ║    that use study_can_view inherit the new scope automatically)           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Can the current user VIEW section `sec`? Yes iff they are an APPROVED member
-- of SOME section whose intake shares a DEPARTMENT with `sec`. (Cross-section
-- grants are no longer consulted — the whole department is open.)
create or replace function public.study_can_view(sec uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.study_sections ts
    join public.study_intakes  ti on ti.id = ts.intake_id
    where ts.id = sec
      and exists (
        select 1
        from public.study_section_members m
        join public.study_sections vs on vs.id = m.section_id
        join public.study_intakes  vi on vi.id = vs.intake_id
        where m.user_id = auth.uid()
          and m.status  = 'approved'
          and vi.department_id = ti.department_id
      )
  );
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Storage object read — questions/books gated via the course; pins stay   ║
-- ║    PRIVATE to the section (study_is_member, not study_can_view)            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create or replace function public.study_can_read_object(obj text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.study_materials mt
            join public.study_courses c on c.id = mt.course_id
            where mt.storage_path = obj and public.study_can_view(c.section_id))
    or exists (select 1 from public.study_question_bank q
               join public.study_courses c on c.id = q.course_id
               where q.storage_path = obj and public.study_can_view(c.section_id))
    or exists (select 1 from public.study_books b
               join public.study_courses c on c.id = b.course_id
               where b.storage_path = obj and public.study_can_view(c.section_id))
    or exists (select 1 from public.study_pins p
               where p.storage_path = obj and public.study_is_member(p.section_id));
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Pins stay PRIVATE to the section                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
drop policy if exists study_pins_select on public.study_pins;
create policy study_pins_select on public.study_pins
  for select to authenticated using (public.study_is_member(section_id));
-- (insert/delete stay CR-only — unchanged.)

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. UPLOAD opens to any APPROVED member of the OWN section                  ║
-- ║    (was CR/Editor only). Materials/Questions/Books inserts now use         ║
-- ║    study_is_member. Adding a SUBJECT (course) stays CR/Editor (curated).   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Materials (Notes) ───────────────────────────────────────────────────────
drop policy if exists study_materials_insert on public.study_materials;
create policy study_materials_insert on public.study_materials
  for insert to authenticated
  with check (exists (select 1 from public.study_courses c
                      where c.id = course_id and public.study_is_member(c.section_id)));
-- (select = study_can_view via course → department-open; delete = own-or-CR; both unchanged.)

-- ── Questions (now per-course) ──────────────────────────────────────────────
drop policy if exists study_qb_select on public.study_question_bank;
create policy study_qb_select on public.study_question_bank
  for select to authenticated
  using (exists (select 1 from public.study_courses c
                 where c.id = course_id and public.study_can_view(c.section_id)));

drop policy if exists study_qb_insert on public.study_question_bank;
create policy study_qb_insert on public.study_question_bank
  for insert to authenticated
  with check (exists (select 1 from public.study_courses c
                      where c.id = course_id and public.study_is_member(c.section_id)));

-- Only the owning section's CR toggles 'verified'.
drop policy if exists study_qb_update on public.study_question_bank;
create policy study_qb_update on public.study_question_bank
  for update to authenticated
  using (exists (select 1 from public.study_courses c
                 where c.id = course_id and public.study_is_cr(c.section_id)))
  with check (exists (select 1 from public.study_courses c
                      where c.id = course_id and public.study_is_cr(c.section_id)));

drop policy if exists study_qb_delete on public.study_question_bank;
create policy study_qb_delete on public.study_question_bank
  for delete to authenticated
  using (uploaded_by = auth.uid()
         or exists (select 1 from public.study_courses c
                    where c.id = course_id and public.study_is_cr(c.section_id)));

-- ── Books (now per-course) ──────────────────────────────────────────────────
drop policy if exists study_books_select on public.study_books;
create policy study_books_select on public.study_books
  for select to authenticated
  using (exists (select 1 from public.study_courses c
                 where c.id = course_id and public.study_can_view(c.section_id)));

drop policy if exists study_books_insert on public.study_books;
create policy study_books_insert on public.study_books
  for insert to authenticated
  with check (exists (select 1 from public.study_courses c
                      where c.id = course_id and public.study_is_member(c.section_id)));

drop policy if exists study_books_delete on public.study_books;
create policy study_books_delete on public.study_books
  for delete to authenticated
  using (added_by = auth.uid()
         or exists (select 1 from public.study_courses c
                    where c.id = course_id and public.study_is_cr(c.section_id)));

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. Close the admin-content firewall — nobody may self-approve membership   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Department-open view means a single approved membership row reads a whole
-- department's content. The is_admin() insert disjunct (0046) let an admin
-- self-insert such a row. Block self-approval at the trigger AND let admins
-- insert ONLY other users' rows (e.g. assigning a CR), never their own.
create or replace function public.study_members_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (new.section_id <> old.section_id or new.user_id <> old.user_id) then
    raise exception 'Cannot move a membership to another section or user';
  end if;
  if new.role = 'cr' and not public.is_admin() then
    raise exception 'Only an admin can assign the CR role';
  end if;
  -- NEW: nobody (admin included) may create or elevate their OWN row to approved.
  -- Self-join must go through the request → CR-approval flow; this keeps admins
  -- (who manage CRs but never need section membership) out of content reads.
  if new.user_id = auth.uid()
     and new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    raise exception 'You cannot approve your own membership';
  end if;
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    new.decided_by := auth.uid();
    new.decided_at := now();
  end if;
  return new;
end;
$$;
-- (The study_members_guard trigger from 0046 already points at this function.)

drop policy if exists study_members_insert on public.study_section_members;
create policy study_members_insert on public.study_section_members
  for insert to authenticated
  with check (
    (user_id = auth.uid() and role = 'member' and status = 'pending')
    or (public.is_admin() and user_id <> auth.uid())
  );

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. Bind every content row's storage_path to the writer's OWN folder        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- study_can_read_object matches objects by storage_path alone, so an
-- unconstrained path let a member plant a row pointing at another user's object
-- and obtain a signed URL. Mirror the bucket upload policy: the path's first
-- folder must equal auth.uid(). (url-only books / text-only pins have a null
-- storage_path and are skipped.)
create or replace function public.study_guard_storage_path()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.storage_path is not null
     and split_part(new.storage_path, '/', 1) <> auth.uid()::text then
    raise exception 'storage_path must live under your own folder';
  end if;
  return new;
end;
$$;
revoke execute on function public.study_guard_storage_path() from public, anon, authenticated;

create trigger study_materials_path_guard
  before insert or update on public.study_materials
  for each row execute function public.study_guard_storage_path();
create trigger study_qb_path_guard
  before insert or update on public.study_question_bank
  for each row execute function public.study_guard_storage_path();
create trigger study_books_path_guard
  before insert or update on public.study_books
  for each row execute function public.study_guard_storage_path();
create trigger study_pins_path_guard
  before insert or update on public.study_pins
  for each row execute function public.study_guard_storage_path();

-- ============================================================================
-- Unchanged by design:
--   • study_courses_select  → study_can_view(section_id)  (now department-open)
--   • study_courses_insert  → study_can_edit  (CR/Editor curate the subject list)
--   • study_courses_delete  → CR or creator
--   • study_materials_select/delete, study_members_*, study_intakes/sections_*
--   • the storage upload/owner-update/owner-delete policies (own ${uid}/ folder)
--   • study_member_of_intake / study_editor_of_intake helpers are now unused
--     (books gate via course) but left in place; harmless.
-- ============================================================================
