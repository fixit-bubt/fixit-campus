-- ============================================================================
-- FixIt — Migration 0052: Study Hub uploads are CR/Editor-only
-- ----------------------------------------------------------------------------
-- Product decision: a regular (approved) member should NOT be able to upload.
-- Only the CR and the students the CR designates as Editors may contribute
-- notes / questions / books. Members keep VIEW + download (department-open).
--
-- This reverts the INSERT gate for the three content tables from study_is_member
-- (any approved member, set in 0051 §5) back to study_can_edit (CR/Editor) —
-- the same helper that already guards study_courses_insert. Everything else from
-- 0051 (department-open VIEW, per-course questions/books, pins-private,
-- §6 self-approval guard, §7 storage_path guard) is unchanged.
--   • View   = study_can_view (department-open) — unchanged
--   • Upload = study_can_edit (CR/Editor)        — tightened here
--   • Delete = own-upload-or-CR                   — unchanged
--   • Verify question / pin = CR                  — unchanged
-- ============================================================================

-- ── Materials (Notes) ───────────────────────────────────────────────────────
drop policy if exists study_materials_insert on public.study_materials;
create policy study_materials_insert on public.study_materials
  for insert to authenticated
  with check (exists (select 1 from public.study_courses c
                      where c.id = course_id and public.study_can_edit(c.section_id)));

-- ── Questions ───────────────────────────────────────────────────────────────
drop policy if exists study_qb_insert on public.study_question_bank;
create policy study_qb_insert on public.study_question_bank
  for insert to authenticated
  with check (exists (select 1 from public.study_courses c
                      where c.id = course_id and public.study_can_edit(c.section_id)));

-- ── Books ───────────────────────────────────────────────────────────────────
drop policy if exists study_books_insert on public.study_books;
create policy study_books_insert on public.study_books
  for insert to authenticated
  with check (exists (select 1 from public.study_courses c
                      where c.id = course_id and public.study_can_edit(c.section_id)));
