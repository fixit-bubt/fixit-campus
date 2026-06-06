# Study Hub redesign — spec

**Status:** design locked (2026-06-06). Migration `0051` drafted; store + UI to follow.
**Goal:** turn Study Hub from private per-section silos into an **open, department-wide study library** so students can study every section's questions — and juniors can study senior batches' notes/papers/books.

---

## 1. The model

```
HOME  (unchanged — only one tile renamed)
│
├── "Open my section"   →  YOUR section
│        [ Pinned ]  [ Courses ]                 ← Question Bank tab removed
│        click a course → SUBJECT VIEW ↓
│
└── "Study Materials"  (renamed from "Books — Intake 51")
         [ Intake 51 ▾ ]   ← switch between intakes in YOUR department
         Section 1 / Section 2 / Section 3 …
         click a section → its subjects (read-only browse)
         click a subject → SUBJECT VIEW ↓

SUBJECT VIEW   (one course; same screen everywhere)
   [ Notes ]  [ Questions ]  [ Books ]    [+ Upload]
   each file tagged with its uploader's section
```

## 2. Who can do what

| Action | Allowed for |
|--------|-------------|
| **View** notes / questions / books of any section | Any **approved member** of **the same department** (across all its intakes) |
| **Add a subject** (course) | **CR / Editor** of that section (keeps the subject list curated) |
| **Upload** a note / question / book into a subject | Any **approved member** of **that subject's section** |
| **Delete** a note / question / book | Its **uploader**, or the section **CR** |
| Mark a question **verified** | Section **CR** |
| **Pin** a notice (private to the section) | Section **CR** |
| Approve members / assign editor | Section **CR** (CR itself assigned by **Admin**) |
| See content | **Admin: NEVER** (unchanged invariant) |

**Pins are private to the section** — only that section's members see them. Everything else is open department-wide for *reading*; *writing* is always your own section only.

## 3. Database (migration `0051`)

- `study_question_bank` += `course_id` (was section-scoped) → questions live inside a subject.
- `study_books` += `course_id` (was intake-scoped) → books live inside a subject.
  - Legacy `section_id` / `intake_id` columns kept and still populated by the app for integrity; RLS gates via the course.
- `study_can_view(sec)` **rewritten** → department-open (approved member of any section sharing `sec`'s department). All content SELECT policies inherit this.
- `study_can_read_object` updated → questions/books gated via course; **pins via `study_is_member` (private)**.
- `study_pins_select` → `study_is_member` (private to section).
- Materials/Questions/Books **INSERT** → `study_is_member` (any approved member of the section), gated through the course.
- Course (subject) INSERT stays `study_can_edit` (CR/Editor).
- Cross-section **access-request / grant** flow is **retired** (department is open now): tables/policies/triggers left in place but unused; client UI removed.

## 4. Store (`store.jsx`)

- Mappers: `toStudyQB` += `courseId`; `toStudyBook` += `courseId`.
- Selectors:
  - `studyQuestionsIn(courseId)` (replaces section-scoped `studyQuestionBankIn` for the subject view).
  - `studyBooksInCourse(courseId)` (replaces intake-scoped `studyBooksIn` for the subject view).
  - `studyVisibleIntakes()` → intakes in my department (for the Study Materials switcher).
  - my department id from `resolveMySection().section.deptId`.
- Actions:
  - `uploadStudyQB(courseId, {...})` → sets `course_id` + `section_id` (= the course's section).
  - `addStudyBook(courseId, {...})` → sets `course_id` + `intake_id` (= the course's section's intake).
- Removed/dead: `requestSectionAccess`, `decideSectionAccess`, `revokeSectionGrant`, `requestJoinSection` stays (joining a section is still how you become a member).

## 5. UI (`StudyHub.jsx`, `ManageStudyHub.jsx`, `App.jsx`)

- **Home:** rename the `Books — Intake 51` tile → **Study Materials** (→ the browse); update "Open my section" subtitle to drop "question bank".
- **Section view** (`/study-hub/section/:id`): tabs reduced to **Pinned + Courses**; Question Bank tab removed. For a section that is **not mine** (browse), show only the subjects (courses) list, read-only (no Pinned — pins are private).
- **Subject view** (`/study-hub/section/:id/course/:cid`): becomes **Notes / Questions / Books** tabs + Upload. Notes = materials, Questions = this course's question bank, Books = this course's books. Upload allowed for approved members of the section; read-only when browsing another section.
- **Study Materials browse** (repurposes `/study-hub/intake/:intakeId`): an **intake switcher** (my department's intakes) + the sections list; the old "Books" tab here is removed (books are per-course now).
- **Remove cross-section UI:** `RequestAccessModal`, `AccessRequestsTab`, "Request access" buttons, locked/private/"Browse other sections" states; `StudyHubManage` keeps only the **Members** tab.

## 6. Build order

1. **Migration 0051** — user applies (adversarially RLS-reviewed first). ← *this step*
2. **Store** — mappers, selectors, actions.
3. **UI** — subject view 3 tabs → section view (drop QB) → Study Materials browse + switcher → home tile rename → strip cross-section UI.
4. **Review** (adversarial) + **build** green.
5. Manual E2E, then commit (push only on explicit request).

## 7. Open decisions (defaults chosen — correct me)

- **Upload = any approved member** (not just CR/Editor). Chosen because the whole point is students sharing.
- **Adding a subject = CR/Editor only** (keeps the per-section subject list clean).
- **Books are now per-course** (no separate intake-wide book library).
- **Cross-section request/grant flow removed** (pointless once the department is open).
