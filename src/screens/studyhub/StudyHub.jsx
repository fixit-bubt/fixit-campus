import React from "react";
import { Icon } from "../../components/Icon.jsx";
import {
  Button, Card, StatCard, Field, Input, Textarea, Select, Modal, EmptyState, Avatar, Spinner, Loading, useToast,
} from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { FilterTabs } from "../../components/FilterTabs.jsx";
import { AccentTile, SegmentToggle } from "../../components/featureKit.jsx";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { relativeDate, downloadFile } from "../../lib/helpers.js";

// ============================================================================
// FEATURE — Study Hub  (signature accent: teal)  — LIVE on Supabase (0046, 0051)
// An OPEN, department-wide study library. Each subject (course) holds Notes,
// Questions, and Books. VIEW is open to any approved student in the department
// (across all intakes, so juniors can study seniors' materials); UPLOAD is
// limited to approved members of your own section; pinned notices stay private
// to a section. Admins assign CRs but never see content. All data via useApp().
// ============================================================================

const ACCENT = "teal";
const isCR = (role) => role === "cr";
const canContribute = (role) => role === "cr" || role === "editor";

const BOOK_KIND_ICON = { Textbook: "BookMarked", Reference: "BookOpen", Syllabus: "ScrollText" };
const BOOK_FILTERS = ["All", "Textbook", "Reference", "Syllabus"];
const BOOK_KINDS = ["Textbook", "Reference", "Syllabus"];
const QB_EXAMS = ["CT 1", "CT 2", "Midterm", "Final"];
const MATERIAL_TYPES = ["Class Note", "Lecture Slide", "Assignment", "Reference", "Lab Manual"];
const FILE_ICON = { pdf: "FileText", doc: "FileType", docx: "FileType", ppt: "Presentation", pptx: "Presentation", img: "Image", zip: "FileArchive", link: "Link" };
const fileIcon = (kind) => FILE_ICON[kind] || "File";
const fmtFileSize = (mb) => (mb == null ? "" : mb < 1 ? `${Math.round(mb * 1024)} KB` : `${mb.toFixed(1)} MB`);

const shortDept = (name = "") => name.replace(/^Department of\s+/i, "");
const deptCode = (name = "") => {
  const s = shortDept(name);
  const words = s.split(/\s+/).filter((w) => /[A-Za-z]/.test(w) && !/^(&|and|of|the|in|for)$/i.test(w));
  return words.length >= 2 ? words.map((w) => w[0].toUpperCase()).join("") : s;
};

// One glyph per faculty/branch (tone stays teal; only the icon varies).
const BRANCH_ICON = {
  "Engineering & Applied Sciences": "Cpu",
  "Business": "Briefcase",
  "Social Sciences": "Globe",
  "Science / Social Sciences": "Sigma",
  "Arts & Humanities": "BookOpenText",
  "Law": "Scale",
};
const BRANCH_ORDER = [
  "Engineering & Applied Sciences",
  "Business",
  "Science / Social Sciences",
  "Social Sciences",
  "Arts & Humanities",
  "Law",
];

// --- Shared: download a private file via a signed URL -----------------------
function DownloadButton({ path, name }) {
  const { getStudyFileUrl } = useApp();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  async function go() {
    setBusy(true);
    const url = await getStudyFileUrl(path);
    setBusy(false);
    if (!url) { toast({ type: "error", title: "Couldn't open file", message: "Please try again." }); return; }
    await downloadFile(url, name);
  }
  return (
    <Button size="sm" variant="secondary" icon="Download" onClick={go} disabled={busy}>
      {busy ? <Spinner size={14} /> : "Download"}
    </Button>
  );
}

// --- Shared: any-file picker (captures the actual File) ---------------------
function DocField({ file, onChange }) {
  const inputRef = React.useRef(null);
  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current && inputRef.current.click()}
        className="flex w-full items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm">
          <Icon name="Paperclip" size={16} />
        </span>
        <span className="min-w-0 flex-1">
          {file
            ? <span className="block truncate text-sm font-medium text-slate-700">{file.name}</span>
            : <span className="block text-sm text-slate-500">Choose a file</span>}
          <span className="block text-xs text-slate-400">PDF, DOC, PPT, ZIP · up to 10 MB</span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) onChange(f); }}
      />
    </div>
  );
}

// --- Recent-activity row ----------------------------------------------------
function ActivityRow({ ev }) {
  const { studyPersonName } = useApp();
  return (
    <div className="flex items-center gap-3 p-4">
      <AccentTile icon={ev.kind === "pin" ? "Pin" : "FileText"} tone={ACCENT} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{ev.title}</p>
        <p className="truncate text-xs text-slate-500">
          {ev.context}{ev.context && " · "}{studyPersonName(ev.byId)}
        </p>
      </div>
      <span className="shrink-0 text-xs text-slate-400">{relativeDate(ev.createdAt)}</span>
    </div>
  );
}

// --- Course row -------------------------------------------------------------
function CourseRow({ course, sectionId, onDelete }) {
  const { studyFilesIn } = useApp();
  const count = studyFilesIn(course.id).length;
  return (
    <div className="group flex items-center transition-colors hover:bg-slate-50">
      <button
        onClick={() => navigate(`/study-hub/section/${sectionId}/course/${course.id}`)}
        className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left"
      >
        <AccentTile icon="BookOpen" tone={ACCENT} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-teal-700">
            {course.code} — {course.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{count} material{count === 1 ? "" : "s"}</p>
        </div>
        {!onDelete && <Icon name="ArrowRight" size={18} className="shrink-0 text-slate-300 group-hover:text-teal-500" />}
      </button>
      {onDelete && <div className="pr-3"><DeleteIcon onClick={() => onDelete(course)} title="Remove course" /></div>}
    </div>
  );
}

// --- CR quick-actions banner ------------------------------------------------
function CRBanner({ section, sectionNumber }) {
  const { studyMembers } = useApp();
  const pending = studyMembers.filter((m) => m.sectionId === section.id && m.status === "pending").length;
  const editors = (section.editorIds || []).length;
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-teal-200 bg-teal-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <AccentTile icon="ShieldCheck" tone={ACCENT} size={40} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">You're the CR of Section {sectionNumber}</p>
          <p className="text-xs text-slate-600">
            {pending} join request{pending === 1 ? "" : "s"} pending · {editors} editor{editors === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <Button className="shrink-0" icon="Settings" onClick={() => navigate(`/study-hub/section/${section.id}/manage`)}>
        Manage section
      </Button>
    </div>
  );
}

// ============================================================================
// Landing — your section overview / pending / first-run setup
// ============================================================================
export function StudyHub() {
  const { currentUser, studyMembers, studySections, resolveMySection, studySectionStats, studyRecentActivity, studyCoursesIn, studyBooksInCourse, dataLoading } = useApp();

  const mine = resolveMySection();

  if (!mine) {
    if (dataLoading && studySections.length === 0) {
      return <AppShell activeKey="study-hub" title="Study Hub"><Loading /></AppShell>;
    }
    const myRow = studyMembers.find((m) => m.userId === currentUser.id);
    if (myRow && myRow.status === "pending") return <StudyHubPending />;
    return <StudyHubSetup />;
  }

  const { section, deptCode: code, intakeNumber, sectionNumber, myRole } = mine;
  const stats = studySectionStats(section);
  const activity = studyRecentActivity(section, 5);
  const courses = studyCoursesIn(section.id);
  const books = courses.flatMap((c) => studyBooksInCourse(c.id)); // section-scoped, like the other home stats
  const shownCourses = courses.slice(0, 4);

  return (
    <AppShell activeKey="study-hub" title="Study Hub">
      <PageHeader
        title="Study Hub"
        subtitle={`${code} · Intake ${intakeNumber} · Section ${sectionNumber}`}
        action={
          <Button variant="secondary" icon="LayoutGrid" onClick={() => navigate("/study-hub/browse")}>Browse all</Button>
        }
      />

      {isCR(myRole) && <CRBanner section={section} sectionNumber={sectionNumber} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Courses" value={stats.courses} icon="BookOpen" tone={ACCENT} />
        <StatCard label="Materials" value={stats.files} icon="FileText" tone="slate" />
        <StatCard label="Question papers" value={stats.questions} icon="FileQuestion" tone="slate" />
        <StatCard label="Books" value={books.length} icon="Library" tone="slate" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => navigate(`/study-hub/section/${section.id}`)}
          className="group flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50/40"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-100 text-teal-700"><Icon name="FolderOpen" size={22} /></span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Open my section</p>
            <p className="text-xs text-slate-500">Pinned notices and your subjects.</p>
          </div>
          <Icon name="ArrowRight" size={18} className="text-slate-300 group-hover:text-teal-500" />
        </button>
        <button
          onClick={() => navigate(`/study-hub/intake/${section.intakeId}`)}
          className="group flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50/40"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon name="Library" size={22} /></span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Study Materials</p>
            <p className="text-xs text-slate-500">Notes, questions & books from every section — and senior intakes.</p>
          </div>
          <Icon name="ArrowRight" size={18} className="text-slate-300 group-hover:text-teal-500" />
        </button>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Recent activity</h3>
          <button onClick={() => navigate(`/study-hub/section/${section.id}`)} className="text-sm font-medium text-teal-700 hover:text-teal-800">Open section</button>
        </div>
        {activity.length === 0 ? (
          <EmptyState icon="FileText" title="Nothing yet" message="New materials and pins will show up here." />
        ) : (
          <Card className="divide-y divide-slate-200 overflow-hidden">
            {activity.map((ev) => <ActivityRow key={ev.id} ev={ev} />)}
          </Card>
        )}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Your courses</h3>
          <span className="text-xs text-slate-400">{courses.length} total</span>
        </div>
        {courses.length === 0 ? (
          <EmptyState icon="BookOpen" title="No courses yet" message="Courses your CR or editors add will appear here." />
        ) : (
          <Card className="divide-y divide-slate-200 overflow-hidden">
            {shownCourses.map((c) => <CourseRow key={c.id} course={c} sectionId={section.id} />)}
            {courses.length > shownCourses.length && (
              <button
                onClick={() => navigate(`/study-hub/section/${section.id}`)}
                className="flex w-full items-center justify-center gap-1.5 p-3 text-sm font-medium text-teal-700 hover:bg-slate-50"
              >
                View all {courses.length} courses <Icon name="ArrowRight" size={15} />
              </button>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
}

// ============================================================================
// First-run setup — request to join a section
// ============================================================================
function StudyHubSetup() {
  const { departments, studyIntakesIn, studySectionsIn, requestJoinSection } = useApp();
  const toast = useToast();
  const [deptId, setDeptId] = React.useState("");
  const [intakeId, setIntakeId] = React.useState("");
  const [sectionId, setSectionId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const activeDeptId = deptId || departments[0]?.id || "";
  const intakes = activeDeptId ? studyIntakesIn(activeDeptId) : [];
  const activeIntakeId = intakeId && intakes.some((i) => i.id === intakeId) ? intakeId : (intakes[0]?.id || "");
  const sections = activeIntakeId ? studySectionsIn(activeIntakeId) : [];
  const activeSectionId = sectionId && sections.some((s) => s.id === sectionId) ? sectionId : (sections[0]?.id || "");

  async function submit(e) {
    if (e) e.preventDefault();
    if (!activeSectionId) return;
    setSaving(true);
    const r = await requestJoinSection(activeSectionId);
    setSaving(false);
    if (!r.ok) { toast({ type: "error", title: "Couldn't send request", message: r.error }); return; }
    toast({ type: "success", title: "Request sent", message: "Your CR will approve you shortly." });
  }

  return (
    <AppShell activeKey="study-hub" title="Study Hub">
      <div className="mx-auto max-w-lg">
        <PageHeader title="Study Hub" />
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <AccentTile icon="BookMarked" tone={ACCENT} size={48} />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">Join your section</h3>
              <p className="mt-1 text-sm text-slate-500">Pick your section to request access. Your CR approves the request, then you can share and study notes, questions, and books.</p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-5">
            <Field label="Department" htmlFor="su-dept">
              <Select id="su-dept" value={activeDeptId} onChange={(e) => { setDeptId(e.target.value); setIntakeId(""); setSectionId(""); }}>
                {departments.map((d) => <option key={d.id} value={d.id}>{shortDept(d.name)}</option>)}
              </Select>
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Intake" htmlFor="su-intake">
                <Select id="su-intake" value={activeIntakeId} onChange={(e) => { setIntakeId(e.target.value); setSectionId(""); }} disabled={!intakes.length}>
                  {intakes.length ? intakes.map((i) => <option key={i.id} value={i.id}>Intake {i.number}</option>) : <option value="">No intakes</option>}
                </Select>
              </Field>
              <Field label="Section" htmlFor="su-section">
                <Select id="su-section" value={activeSectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!sections.length}>
                  {sections.length ? sections.map((s) => <option key={s.id} value={s.id}>Section {s.number}</option>) : <option value="">No sections</option>}
                </Select>
              </Field>
            </div>
            {!sections.length && (
              <p className="text-xs text-slate-400">No sections here yet — check back once your department sets them up.</p>
            )}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button type="button" onClick={() => navigate("/study-hub/browse")} className="text-sm font-medium text-slate-500 hover:text-slate-700">Browse first</button>
              <Button type="submit" icon="Send" disabled={saving || !activeSectionId}>
                {saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Request to join"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}

// --- Pending: requested, awaiting CR approval -------------------------------
function StudyHubPending() {
  const { currentUser, studyMembers, studySectionById } = useApp();
  const row = studyMembers.find((m) => m.userId === currentUser.id && m.status === "pending");
  const section = row && studySectionById(row.sectionId);
  return (
    <AppShell activeKey="study-hub" title="Study Hub">
      <div className="mx-auto max-w-lg">
        <PageHeader title="Study Hub" />
        <EmptyState
          icon="Clock"
          title="Request pending"
          message={section ? `You've asked to join Section ${section.number}. Your CR will approve it soon — you'll get access then.` : "Your request to join is awaiting CR approval."}
          action={<Button variant="secondary" icon="LayoutGrid" onClick={() => navigate("/study-hub/browse")}>Browse departments</Button>}
        />
      </div>
    </AppShell>
  );
}

// ============================================================================
// Browse — department picker
// ============================================================================
function DepartmentCard({ dept, count }) {
  return (
    <button
      onClick={() => navigate(`/study-hub/dept/${dept.id}`)}
      className="group flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50/40"
    >
      <AccentTile icon={BRANCH_ICON[dept.branch] || "GraduationCap"} tone={ACCENT} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{shortDept(dept.name)}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">{count} intake{count === 1 ? "" : "s"}</p>
      </div>
      <Icon name="ArrowRight" size={18} className="text-slate-300 group-hover:text-teal-500" />
    </button>
  );
}

export function StudyHubBrowse() {
  const { departments, studyIntakesIn, dataLoading } = useApp();
  const byBranch = {};
  departments.forEach((d) => { (byBranch[d.branch] ||= []).push(d); });
  const order = [...BRANCH_ORDER, ...Object.keys(byBranch).filter((b) => !BRANCH_ORDER.includes(b))];
  const branches = order.filter((b) => byBranch[b]).map((b) => ({ branch: b, depts: byBranch[b] }));

  return (
    <AppShell activeKey="study-hub" title="Study Hub">
      <button onClick={() => navigate("/study-hub")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <Icon name="ArrowLeft" size={16} /> Study Hub
      </button>
      <PageHeader title="Browse departments" subtitle="Pick a department to open its intakes and sections." />
      {dataLoading && departments.length === 0 ? (
        <Loading />
      ) : branches.length === 0 ? (
        <EmptyState icon="GraduationCap" title="No departments yet" message="Departments will appear here once they're set up." />
      ) : (
        <div className="space-y-8">
          {branches.map(({ branch, depts }) => (
            <section key={branch}>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{branch}</h3>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {depts.map((d) => <DepartmentCard key={d.id} dept={d} count={studyIntakesIn(d.id).length} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}

// ============================================================================
// Intake list — one department's intakes
// ============================================================================
function IntakeCard({ intake, sectionCount }) {
  return (
    <button
      onClick={() => navigate(`/study-hub/intake/${intake.id}`)}
      className="group flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50/40"
    >
      <AccentTile icon="Users" tone={ACCENT} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">Intake {intake.number}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">{intake.years ? `${intake.years} · ` : ""}{sectionCount} section{sectionCount === 1 ? "" : "s"}</p>
      </div>
      <Icon name="ArrowRight" size={18} className="text-slate-300 group-hover:text-teal-500" />
    </button>
  );
}

export function StudyHubDept({ deptId }) {
  const { departments, studyIntakesIn, studySectionsIn, dataLoading } = useApp();
  const dept = departments.find((d) => d.id === deptId);

  if (!dept) {
    return (
      <AppShell activeKey="study-hub" title="Study Hub">
        {dataLoading ? <Loading /> : (
          <EmptyState icon="GraduationCap" title="Department not found" message="This department may have changed."
            action={<Button onClick={() => navigate("/study-hub/browse")}>Browse departments</Button>} />
        )}
      </AppShell>
    );
  }

  const intakes = studyIntakesIn(dept.id);

  return (
    <AppShell activeKey="study-hub" title="Study Hub">
      <button onClick={() => navigate("/study-hub/browse")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <Icon name="ArrowLeft" size={16} /> Browse departments
      </button>
      <PageHeader title={shortDept(dept.name)} subtitle="Pick an intake to open its sections and books." />
      {intakes.length === 0 ? (
        <EmptyState icon="Users" title="No intakes yet" message="This department's intakes haven't been set up on Study Hub yet." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {intakes.map((i) => <IntakeCard key={i.id} intake={i} sectionCount={studySectionsIn(i.id).length} />)}
        </div>
      )}
    </AppShell>
  );
}

// ============================================================================
// Sections + Books — one intake (tabbed)
// ============================================================================
// Open browse: every section in the department is viewable. Your own section's
// roster is RLS-visible (so we can show the CR's name); others show only the
// roster-independent hasCR signal. Content (material count) loads for the whole
// department, so the count is always meaningful.
function SectionCard({ section }) {
  const { studyPersonName, studySectionFileCount } = useApp();
  const crName = section.crIds[0] ? studyPersonName(section.crIds[0]) : null;
  const materials = studySectionFileCount(section);
  const subtitle = crName ? `CR: ${crName}` : section.hasCR ? null : "No CR yet";
  const open = () => navigate(`/study-hub/section/${section.id}`);
  return (
    <div className={`flex flex-col rounded-lg border bg-white p-5 shadow-sm ${section.isMine ? "border-teal-300" : "border-slate-200"}`}>
      <div className="flex items-start gap-3">
        <AccentTile icon="Users" tone={ACCENT} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">Section {section.number}</p>
            {section.isMine && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700">You</span>}
          </div>
          {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-400">{materials} material{materials === 1 ? "" : "s"}</span>
        {section.isMine
          ? <Button size="sm" iconRight="ArrowRight" onClick={open}>Open</Button>
          : <Button size="sm" variant="secondary" iconRight="ArrowRight" onClick={open}>Browse</Button>}
      </div>
    </div>
  );
}

function BookRow({ book, isManager, onDelete }) {
  const { studyPersonName, currentUser } = useApp();
  const canDelete = isManager || book.byId === currentUser?.id; // RLS: own add or CR
  return (
    <div className="flex items-center gap-3 p-4">
      <AccentTile icon={BOOK_KIND_ICON[book.kind] || "BookOpen"} tone={ACCENT} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{book.title}</p>
        <p className="truncate text-xs text-slate-500">{book.kind}{book.author ? ` · ${book.author}` : ""}{book.edition ? ` · ${book.edition}` : ""}</p>
        <p className="truncate text-xs text-slate-400">{studyPersonName(book.byId)} · {relativeDate(book.createdAt)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {canDelete && <DeleteIcon onClick={() => onDelete(book)} title="Remove book" />}
        {book.url
          ? <a href={book.url} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"><Icon name="ExternalLink" size={15} /> Open link</a>
          : <DownloadButton path={book.path} name={book.title} />}
      </div>
    </div>
  );
}

function DeleteIcon({ onClick, title }) {
  return (
    <button onClick={onClick} title={title} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
      <Icon name="Trash2" size={16} />
    </button>
  );
}

function AddBookModal({ open, onClose, courseId, courseCode }) {
  const { addStudyBook } = useApp();
  const toast = useToast();
  const [form, setForm] = React.useState({ title: "", kind: "Textbook", author: "", url: "", file: null });
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  function reset() { setForm({ title: "", kind: "Textbook", author: "", url: "", file: null }); setErrors({}); }
  React.useEffect(() => { if (!open) reset(); }, [open]);
  async function submit(e) {
    if (e) e.preventDefault();
    const er = {};
    if (!form.title.trim()) er.title = "Enter a title.";
    if (!form.file && !form.url.trim()) er.url = "Attach a file or add a link.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    const r = await addStudyBook(courseId, { title: form.title, kind: form.kind, author: form.author, courseCode, url: form.url, file: form.file });
    setSaving(false);
    if (!r.ok) { toast({ type: "error", title: "Couldn't add book", message: r.error }); return; }
    toast({ type: "success", title: "Book added", message: form.title.trim() });
    reset(); onClose();
  }
  return (
    <Modal
      open={open} onClose={onClose} icon="BookPlus" tone="blue" title="Add a book"
      description={courseCode ? `Added to ${courseCode}.` : ""}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon="Plus" onClick={() => submit()} disabled={saving}>Add book</Button></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title" htmlFor="ab-title" required error={errors.title}>
          <Input id="ab-title" value={form.title} error={!!errors.title} onChange={set("title")} placeholder="e.g. Introduction to Algorithms" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="ab-kind">
            <Select id="ab-kind" value={form.kind} onChange={set("kind")}>{BOOK_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</Select>
          </Field>
          <Field label="Author" htmlFor="ab-author" hint="Optional"><Input id="ab-author" value={form.author} onChange={set("author")} placeholder="e.g. Cormen et al." /></Field>
        </div>
        <Field label="File" hint="Optional — attach a PDF, or leave empty to add a link below.">
          <DocField file={form.file} onChange={(f) => setForm((x) => ({ ...x, file: f }))} />
        </Field>
        <Field label="Link" htmlFor="ab-url" error={errors.url} hint="External URL if there's no file.">
          <Input id="ab-url" value={form.url} error={!!errors.url} onChange={set("url")} placeholder="https://…" />
        </Field>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

function BooksTab({ books, canAdd, isManager, onAdd, onDelete }) {
  const [filter, setFilter] = React.useState("All");
  if (books.length === 0) {
    return <EmptyState icon="Library" title="No books yet" message={canAdd ? "Add textbooks, references, or the syllabus for this subject." : "No books have been shared for this subject yet."} action={canAdd ? <Button icon="Plus" onClick={onAdd}>Add book</Button> : null} />;
  }
  const counts = { All: books.length };
  BOOK_FILTERS.slice(1).forEach((k) => { counts[k] = books.filter((b) => b.kind === k).length; });
  const shown = filter === "All" ? books : books.filter((b) => b.kind === filter);
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs options={BOOK_FILTERS} value={filter} onChange={setFilter} counts={counts} />
        {canAdd && <Button icon="Plus" onClick={onAdd}>Add book</Button>}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon="Library" title="Nothing here" message="No books in this category yet." />
      ) : (
        <Card className="divide-y divide-slate-200 overflow-hidden">
          {shown.map((b) => <BookRow key={b.id} book={b} isManager={isManager} onDelete={onDelete} />)}
        </Card>
      )}
    </div>
  );
}

// Study Materials — browse a department's intakes → sections → subjects.
export function StudyHubIntake({ intakeId }) {
  const { studyIntakes, departments, studySectionsIn, studyIntakesIn, dataLoading } = useApp();

  const intake = studyIntakes.find((i) => i.id === intakeId);
  const dept = intake && departments.find((d) => d.id === intake.deptId);

  if (!intake || !dept) {
    return (
      <AppShell activeKey="study-hub" title="Study Hub">
        {dataLoading ? <Loading /> : (
          <EmptyState icon="Users" title="Intake not found" message="This intake may have changed."
            action={<Button onClick={() => navigate("/study-hub")}>Back to Study Hub</Button>} />
        )}
      </AppShell>
    );
  }

  const sections = studySectionsIn(intake.id);
  const intakes = studyIntakesIn(dept.id); // same-department intakes → the switcher
  const switchIntake = (e) => { const id = e.target.value; if (id && id !== intake.id) navigate(`/study-hub/intake/${id}`); };

  return (
    <AppShell activeKey="study-hub" title="Study Hub">
      <button onClick={() => navigate("/study-hub")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <Icon name="ArrowLeft" size={16} /> Study Hub
      </button>
      <PageHeader title="Study Materials" subtitle={`${shortDept(dept.name)} — notes, questions & books shared across the intake`} />

      <Card className="mb-6 p-4">
        <Field label="Intake" hint="Switch to a senior or junior intake to study their materials.">
          <Select value={intake.id} onChange={switchIntake}>
            {intakes.map((i) => <option key={i.id} value={i.id}>Intake {i.number}{i.years ? ` · ${i.years}` : ""}</option>)}
          </Select>
        </Field>
      </Card>

      <h3 className="mb-3 text-sm font-semibold text-slate-900">Sections · Intake {intake.number}</h3>
      {sections.length === 0 ? (
        <EmptyState icon="Users" title="No sections yet" message="This intake has no sections on Study Hub yet." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((s) => <SectionCard key={s.id} section={s} />)}
        </div>
      )}
    </AppShell>
  );
}

// ============================================================================
// Section home — pinned notices / subjects (courses)
// ============================================================================
function PinModal({ open, onClose, sectionId }) {
  const { addStudyPin } = useApp();
  const toast = useToast();
  const [kind, setKind] = React.useState("text");
  const [message, setMessage] = React.useState("");
  const [file, setFile] = React.useState(null);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { if (!open) { setMessage(""); setFile(null); setKind("text"); setError(""); } }, [open]);
  async function submit() {
    if (!message.trim()) { setError("Enter a message."); return; }
    if (kind === "file" && !file) { setError("Choose a file."); return; }
    setSaving(true);
    const r = await addStudyPin(sectionId, { kind, message, file });
    setSaving(false);
    if (!r.ok) { toast({ type: "error", title: "Couldn't pin", message: r.error }); return; }
    toast({ type: "success", title: "Pinned" });
    setMessage(""); setFile(null); setKind("text"); setError(""); onClose();
  }
  return (
    <Modal
      open={open} onClose={onClose} icon="Pin" tone="blue" title="Pin to your section"
      description="Pinned items show at the top for everyone in your section."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon="Pin" onClick={submit} disabled={saving}>Pin</Button></>}
    >
      <div className="space-y-4">
        <SegmentToggle options={[{ value: "text", label: "Text note", icon: "Type" }, { value: "file", label: "File", icon: "Paperclip" }]} value={kind} onChange={(v) => { setKind(v); setError(""); }} />
        <Field label="Message" error={error}>
          <Textarea rows={3} value={message} onChange={(e) => { setMessage(e.target.value); setError(""); }} placeholder="e.g. Final exam covers chapters 1–8." />
        </Field>
        {kind === "file" && (
          <Field label="File"><DocField file={file} onChange={(f) => { setFile(f); setError(""); }} /></Field>
        )}
      </div>
    </Modal>
  );
}

function AddCourseModal({ open, onClose, sectionId }) {
  const { addStudyCourse } = useApp();
  const toast = useToast();
  const [form, setForm] = React.useState({ code: "", name: "" });
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { if (!open) { setForm({ code: "", name: "" }); setErrors({}); } }, [open]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function submit(e) {
    if (e) e.preventDefault();
    const er = {};
    if (!form.code.trim()) er.code = "Enter a course code.";
    if (!form.name.trim()) er.name = "Enter a course name.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    const r = await addStudyCourse(sectionId, { code: form.code, name: form.name });
    setSaving(false);
    if (!r.ok) { toast({ type: "error", title: "Couldn't add course", message: r.error }); return; }
    toast({ type: "success", title: "Course added", message: `${form.code.trim()} — ${form.name.trim()}` });
    setForm({ code: "", name: "" }); setErrors({}); onClose();
  }
  return (
    <Modal
      open={open} onClose={onClose} icon="BookPlus" tone="blue" title="Add a course"
      description="Add a course so classmates can upload its materials."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon="Plus" onClick={() => submit()} disabled={saving}>Add course</Button></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Course code" htmlFor="ac-code" required error={errors.code}><Input id="ac-code" value={form.code} error={!!errors.code} onChange={set("code")} placeholder="e.g. CSE 318" /></Field>
        <Field label="Course name" htmlFor="ac-name" required error={errors.name}><Input id="ac-name" value={form.name} error={!!errors.name} onChange={set("name")} placeholder="e.g. System Analysis & Design" /></Field>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

function UploadQBModal({ open, onClose, courseId }) {
  const { uploadStudyQB } = useApp();
  const toast = useToast();
  const [form, setForm] = React.useState({ exam: "CT 1", title: "", file: null });
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { if (!open) { setForm({ exam: "CT 1", title: "", file: null }); setErrors({}); } }, [open]);
  async function submit(e) {
    if (e) e.preventDefault();
    const er = {};
    if (!form.title.trim()) er.title = "Enter a title.";
    if (!form.file) er.file = "Choose a file.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    const r = await uploadStudyQB(courseId, { exam: form.exam, title: form.title, file: form.file });
    setSaving(false);
    if (!r.ok) { toast({ type: "error", title: "Upload failed", message: r.error }); return; }
    toast({ type: "success", title: "Uploaded", message: form.title.trim() });
    setForm({ exam: "CT 1", title: "", file: null }); setErrors({}); onClose();
  }
  return (
    <Modal
      open={open} onClose={onClose} icon="Upload" tone="blue" title="Upload a question paper"
      description="Add a past CT, midterm, or final to the question bank."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon="Upload" onClick={() => submit()} disabled={saving}>Upload</Button></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Exam" htmlFor="qb-exam"><Select id="qb-exam" value={form.exam} onChange={(e) => setForm((f) => ({ ...f, exam: e.target.value }))}>{QB_EXAMS.map((x) => <option key={x} value={x}>{x}</option>)}</Select></Field>
        <Field label="Title" htmlFor="qb-title" required error={errors.title}><Input id="qb-title" value={form.title} error={!!errors.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. CSE 318 — CT1 2024" /></Field>
        <Field label="File" required error={errors.file}><DocField file={form.file} onChange={(f) => setForm((x) => ({ ...x, file: f }))} /></Field>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

function PinRow({ pin, manager, onUnpin }) {
  const { studyPersonName } = useApp();
  return (
    <div className="flex items-start gap-3 p-4">
      <AccentTile icon={pin.kind === "file" ? "Paperclip" : "Pin"} tone={ACCENT} size={36} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{pin.message}</p>
        {pin.kind === "file" && pin.fileName && (
          <div className="mt-1.5"><DownloadButton path={pin.path} name={pin.fileName} /></div>
        )}
        <p className="mt-1 text-xs text-slate-400">{studyPersonName(pin.byId)} · {relativeDate(pin.createdAt)}</p>
      </div>
      {manager && (
        <button onClick={() => onUnpin(pin)} title="Unpin" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="X" size={16} /></button>
      )}
    </div>
  );
}

function PinnedTab({ pins, manager, onPin, onUnpin }) {
  // Pins are CR-only (RLS): gate on manager, not canEdit.
  return (
    <div>
      {manager && <div className="mb-4 flex justify-end"><Button icon="Pin" onClick={onPin}>Add a pin</Button></div>}
      {pins.length === 0 ? (
        <EmptyState icon="Pin" title="Nothing pinned" message={manager ? "Pin a note or file to surface it for your section." : "Your CR hasn't pinned anything yet."} />
      ) : (
        <Card className="divide-y divide-slate-200 overflow-hidden">
          {pins.map((p) => <PinRow key={p.id} pin={p} manager={manager} onUnpin={onUnpin} />)}
        </Card>
      )}
    </div>
  );
}

function CoursesTab({ section, courses, canEdit, manager, onAddCourse, onDeleteCourse }) {
  return (
    <div>
      {canEdit && <div className="mb-4 flex justify-end"><Button icon="Plus" onClick={onAddCourse}>Add course</Button></div>}
      {courses.length === 0 ? (
        <EmptyState icon="BookOpen" title="No courses yet" message={canEdit ? "Add a course so classmates can upload its materials." : "No courses have been added yet."} />
      ) : (
        <Card className="divide-y divide-slate-200 overflow-hidden">
          {courses.map((c) => <CourseRow key={c.id} course={c} sectionId={section.id} onDelete={manager ? onDeleteCourse : undefined} />)}
        </Card>
      )}
    </div>
  );
}

function QBPaperRow({ paper, isManager, onVerify, onDelete }) {
  const { studyPersonName, currentUser } = useApp();
  const canDelete = isManager || paper.byId === currentUser?.id; // RLS: own upload or CR
  return (
    <div className="flex items-center gap-3 p-4">
      <AccentTile icon="FileText" tone={ACCENT} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{paper.title}</p>
          {paper.verified && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700"><Icon name="BadgeCheck" size={11} /> Verified</span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-400">{studyPersonName(paper.byId)} · {relativeDate(paper.createdAt)} · {fmtFileSize(paper.sizeMB)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {isManager && (
          <button onClick={() => onVerify(paper)} title={paper.verified ? "Unverify" : "Mark verified"} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100 ${paper.verified ? "text-emerald-600" : "text-slate-400"}`}><Icon name="BadgeCheck" size={16} /></button>
        )}
        {canDelete && <DeleteIcon onClick={() => onDelete(paper)} title="Remove paper" />}
        <DownloadButton path={paper.path} name={paper.title} />
      </div>
    </div>
  );
}

function QuestionBankTab({ qb, canEdit, isManager, onUpload, onVerify, onDelete }) {
  const [exam, setExam] = React.useState("CT 1");
  const counts = {};
  QB_EXAMS.forEach((x) => { counts[x] = qb.filter((q) => q.exam === x).length; });
  const shown = qb.filter((q) => q.exam === exam);
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs options={QB_EXAMS} value={exam} onChange={setExam} counts={counts} />
        {canEdit && <Button icon="Upload" onClick={onUpload}>Upload paper</Button>}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon="FileQuestion" title={`No ${exam} papers`} message={canEdit ? "Upload a past paper to start the bank." : "Nothing here yet."} />
      ) : (
        <Card className="divide-y divide-slate-200 overflow-hidden">
          {shown.map((q) => <QBPaperRow key={q.id} paper={q} isManager={isManager} onVerify={onVerify} onDelete={onDelete} />)}
        </Card>
      )}
    </div>
  );
}

export function StudyHubSection({ sectionId }) {
  const {
    departments, studyIntakes, studySectionById, resolveMySection, studyPinsIn, studyCoursesIn,
    deleteStudyPin, deleteStudyCourse, dataLoading,
  } = useApp();
  const toast = useToast();
  const [tab, setTab] = React.useState("Courses");
  const [pinOpen, setPinOpen] = React.useState(false);
  const [courseOpen, setCourseOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState(null); // { item } — subject (course) delete

  const section = studySectionById(sectionId);
  const intake = section && studyIntakes.find((i) => i.id === section.intakeId);
  const dept = intake && departments.find((d) => d.id === intake.deptId);

  if (!section || !intake || !dept) {
    return (
      <AppShell activeKey="study-hub" title="Study Hub">
        {dataLoading ? <Loading /> : (
          <EmptyState icon="Users" title="Section not found" message="This section may have changed."
            action={<Button onClick={() => navigate("/study-hub")}>Back to Study Hub</Button>} />
        )}
      </AppShell>
    );
  }

  const mine = resolveMySection();
  const myDeptId = mine?.section.deptId;
  const myRole = section.isMine ? (mine?.myRole || "member") : "viewer";
  const canView = section.isMine || section.deptId === myDeptId; // department-open
  const canAddCourse = section.isMine && canContribute(myRole);  // CR/Editor curate the subject list
  const manager = section.isMine && isCR(myRole);
  const back = () => navigate(section.isMine ? "/study-hub" : `/study-hub/intake/${section.intakeId}`);

  if (!canView) {
    return (
      <AppShell activeKey="study-hub" title="Study Hub">
        <button onClick={() => navigate("/study-hub")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <Icon name="ArrowLeft" size={16} /> Study Hub
        </button>
        <EmptyState icon="Lock" title="Not available" message="These materials belong to another department." />
      </AppShell>
    );
  }

  const pins = studyPinsIn(section.id);
  const courses = studyCoursesIn(section.id);

  async function unpin(pin) {
    const r = await deleteStudyPin(pin.id);
    if (!r.ok) { toast({ type: "error", title: "Couldn't unpin", message: r.error }); return; }
    toast({ type: "success", title: "Unpinned" });
  }
  async function doConfirm() {
    if (!confirm) return;
    const r = await deleteStudyCourse(confirm.item.id);
    if (!r.ok) { toast({ type: "error", title: "Couldn't remove", message: r.error }); setConfirm(null); return; }
    toast({ type: "success", title: "Subject removed", message: confirm.item.code });
    setConfirm(null);
  }

  return (
    <AppShell activeKey="study-hub" title="Study Hub">
      <button onClick={back} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <Icon name="ArrowLeft" size={16} /> {section.isMine ? "Study Hub" : `Intake ${intake.number}`}
      </button>
      <SectionHeader section={section} dept={dept} intake={intake} manager={manager} />

      {section.isMine ? (
        <>
          <div className="mb-5">
            <FilterTabs options={["Pinned", "Courses"]} value={tab} onChange={setTab} counts={{ Pinned: pins.length, Courses: courses.length }} />
          </div>
          {tab === "Pinned" && <PinnedTab pins={pins} manager={manager} onPin={() => setPinOpen(true)} onUnpin={unpin} />}
          {tab === "Courses" && <CoursesTab section={section} courses={courses} canEdit={canAddCourse} manager={manager} onAddCourse={() => setCourseOpen(true)} onDeleteCourse={(item) => setConfirm({ item })} />}
        </>
      ) : (
        <CoursesTab section={section} courses={courses} canEdit={false} manager={false} onAddCourse={() => {}} onDeleteCourse={() => {}} />
      )}

      <PinModal open={pinOpen} onClose={() => setPinOpen(false)} sectionId={section.id} />
      <AddCourseModal open={courseOpen} onClose={() => setCourseOpen(false)} sectionId={section.id} />
      <Modal
        open={!!confirm} onClose={() => setConfirm(null)} icon="Trash2" tone="red"
        title="Remove this subject?"
        description={confirm ? `"${confirm.item.code} — ${confirm.item.name}" and all its notes, questions, and books will be removed for the section.` : ""}
        footer={<><Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={doConfirm}>Remove</Button></>}
      />
    </AppShell>
  );
}

// Section header with a CR-name subtitle (needs studyPersonName).
function SectionHeader({ section, dept, intake, manager }) {
  const { studyPersonName } = useApp();
  const crName = section.crIds[0] ? studyPersonName(section.crIds[0]) : null;
  const editors = section.editorIds.length;
  const subtitle = [
    crName ? `${crName} (CR)` : section.hasCR ? null : "No CR yet",
    editors > 0 ? `${editors} editor${editors === 1 ? "" : "s"}` : null,
    !section.isMine ? "Read-only" : null,
  ].filter(Boolean).join(" · ");
  return (
    <PageHeader
      title={`${deptCode(dept.name)} · Intake ${intake.number} · Section ${section.number}`}
      subtitle={subtitle}
      action={manager ? <Button icon="Settings" onClick={() => navigate(`/study-hub/section/${section.id}/manage`)}>Manage section</Button> : null}
    />
  );
}

// ============================================================================
// Course files — one course's materials
// ============================================================================
function UploadFileModal({ open, onClose, courseId, courseCode }) {
  const { uploadStudyMaterial } = useApp();
  const toast = useToast();
  const [form, setForm] = React.useState({ type: "Class Note", title: "", file: null });
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { if (!open) { setForm({ type: "Class Note", title: "", file: null }); setErrors({}); } }, [open]);
  async function submit(e) {
    if (e) e.preventDefault();
    const er = {};
    if (!form.title.trim()) er.title = "Enter a title.";
    if (!form.file) er.file = "Choose a file.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    const r = await uploadStudyMaterial(courseId, { title: form.title, type: form.type, file: form.file });
    setSaving(false);
    if (!r.ok) { toast({ type: "error", title: "Upload failed", message: r.error }); return; }
    toast({ type: "success", title: "Uploaded", message: form.title.trim() });
    setForm({ type: "Class Note", title: "", file: null }); setErrors({}); onClose();
  }
  return (
    <Modal
      open={open} onClose={onClose} icon="Upload" tone="blue" title="Upload material"
      description={courseCode ? `Add a material to ${courseCode}.` : ""}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon="Upload" onClick={() => submit()} disabled={saving}>Upload</Button></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Type" htmlFor="uf-type"><Select id="uf-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>{MATERIAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
        <Field label="Title" htmlFor="uf-title" required error={errors.title}><Input id="uf-title" value={form.title} error={!!errors.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Chapter 3 — DFD Notes" /></Field>
        <Field label="File" required error={errors.file}><DocField file={form.file} onChange={(f) => setForm((x) => ({ ...x, file: f }))} /></Field>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

function FileRow({ file, isManager, onDelete }) {
  const { studyPersonName, currentUser } = useApp();
  const canDelete = isManager || file.byId === currentUser?.id; // RLS: own upload or CR
  return (
    <div className="flex items-center gap-3 p-4">
      <AccentTile icon={fileIcon(file.kind)} tone={ACCENT} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{file.title}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">{file.type} · {studyPersonName(file.byId)} · {relativeDate(file.createdAt)} · {fmtFileSize(file.sizeMB)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {canDelete && <DeleteIcon onClick={() => onDelete(file)} title="Remove" />}
        <DownloadButton path={file.path} name={file.title} />
      </div>
    </div>
  );
}

// Notes (course materials) tab — file list with a type filter.
function NotesTab({ files, canUpload, manager, onUpload, onDelete }) {
  const [filter, setFilter] = React.useState("All");
  const types = ["All", ...MATERIAL_TYPES.filter((t) => files.some((f) => f.type === t))];
  const counts = { All: files.length };
  MATERIAL_TYPES.forEach((t) => { counts[t] = files.filter((f) => f.type === t).length; });
  const shown = filter === "All" ? files : files.filter((f) => f.type === filter);
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {files.length > 1 ? <FilterTabs options={types} value={filter} onChange={setFilter} counts={counts} /> : <span />}
        {canUpload && <Button icon="Upload" onClick={onUpload}>Upload</Button>}
      </div>
      {files.length === 0 ? (
        <EmptyState icon="FileText" title="No notes yet" message={canUpload ? "Upload notes, slides, or assignments for this subject." : "Nothing has been uploaded yet."}
          action={canUpload ? <Button icon="Upload" onClick={onUpload}>Upload</Button> : null} />
      ) : shown.length === 0 ? (
        <EmptyState icon="FileText" title="Nothing here" message="No notes of this type yet." />
      ) : (
        <Card className="divide-y divide-slate-200 overflow-hidden">
          {shown.map((f) => <FileRow key={f.id} file={f} isManager={manager} onDelete={onDelete} />)}
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Subject view — one course: Notes / Questions / Books
// ============================================================================
export function StudyHubCourse({ sectionId, courseId }) {
  const {
    studyCourseById, studySectionById, studyFilesIn, studyQuestionsIn, studyBooksInCourse,
    resolveMySection, deleteStudyMaterial, deleteStudyQB, setQBVerified, deleteStudyBook, dataLoading,
  } = useApp();
  const toast = useToast();
  const [tab, setTab] = React.useState("Notes");
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [qbOpen, setQbOpen] = React.useState(false);
  const [bookOpen, setBookOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState(null); // { kind: 'note'|'qb'|'book', item }

  const course = studyCourseById(courseId);
  const section = course && studySectionById(course.sectionId);

  if (!course || !section) {
    return (
      <AppShell activeKey="study-hub" title="Study Hub">
        {dataLoading ? <Loading /> : (
          <EmptyState icon="BookOpen" title="Subject not found" message="This subject may have been removed."
            action={<Button onClick={() => navigate(sectionId ? `/study-hub/section/${sectionId}` : "/study-hub")}>Back</Button>} />
        )}
      </AppShell>
    );
  }

  const mine = resolveMySection();
  const myDeptId = mine?.section.deptId;
  const myRole = section.isMine ? (mine?.myRole || "member") : "viewer";
  const canView = section.isMine || section.deptId === myDeptId; // department-open
  const canUpload = section.isMine;                              // approved member of THIS section
  const manager = section.isMine && isCR(myRole);

  if (!canView) {
    return (
      <AppShell activeKey="study-hub" title="Study Hub">
        <EmptyState icon="Lock" title="Not available" message="These materials belong to another department."
          action={<Button onClick={() => navigate("/study-hub")}>Back to Study Hub</Button>} />
      </AppShell>
    );
  }

  const files = studyFilesIn(course.id);
  const qb = studyQuestionsIn(course.id);
  const books = studyBooksInCourse(course.id);

  async function verifyQB(paper) {
    const r = await setQBVerified(paper.id, !paper.verified);
    if (!r.ok) { toast({ type: "error", title: "Couldn't update", message: r.error }); return; }
    toast({ type: "success", title: paper.verified ? "Marked unverified" : "Marked verified" });
  }
  async function doConfirm() {
    if (!confirm) return;
    const { kind, item } = confirm;
    const r = kind === "note" ? await deleteStudyMaterial(item.id)
            : kind === "qb"   ? await deleteStudyQB(item.id)
            :                   await deleteStudyBook(item.id);
    if (!r.ok) { toast({ type: "error", title: "Couldn't remove", message: r.error }); setConfirm(null); return; }
    toast({ type: "success", title: "Removed", message: item.title });
    setConfirm(null);
  }

  const confirmLabel = { note: "note", qb: "question paper", book: "book" }[confirm?.kind] || "item";

  return (
    <AppShell activeKey="study-hub" title="Study Hub">
      <button onClick={() => navigate(`/study-hub/section/${section.id}`)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <Icon name="ArrowLeft" size={16} /> Section {section.number}
      </button>
      <PageHeader
        title={`${course.code} — ${course.name}`}
        subtitle={section.isMine ? null : `Section ${section.number} · read-only`}
      />

      <div className="mb-5">
        <FilterTabs options={["Notes", "Questions", "Books"]} value={tab} onChange={setTab}
          counts={{ Notes: files.length, Questions: qb.length, Books: books.length }} />
      </div>

      {tab === "Notes" && (
        <NotesTab files={files} canUpload={canUpload} manager={manager}
          onUpload={() => setUploadOpen(true)} onDelete={(item) => setConfirm({ kind: "note", item })} />
      )}
      {tab === "Questions" && (
        <QuestionBankTab qb={qb} canEdit={canUpload} isManager={manager}
          onUpload={() => setQbOpen(true)} onVerify={verifyQB} onDelete={(item) => setConfirm({ kind: "qb", item })} />
      )}
      {tab === "Books" && (
        <BooksTab books={books} canAdd={canUpload} isManager={manager}
          onAdd={() => setBookOpen(true)} onDelete={(item) => setConfirm({ kind: "book", item })} />
      )}

      <UploadFileModal open={uploadOpen} onClose={() => setUploadOpen(false)} courseId={course.id} courseCode={course.code} />
      <UploadQBModal open={qbOpen} onClose={() => setQbOpen(false)} courseId={course.id} />
      <AddBookModal open={bookOpen} onClose={() => setBookOpen(false)} courseId={course.id} courseCode={course.code} />
      <Modal
        open={!!confirm} onClose={() => setConfirm(null)} icon="Trash2" tone="red"
        title={`Remove this ${confirmLabel}?`}
        description={confirm ? `"${confirm.item.title}" will be removed for everyone in the section.` : ""}
        footer={<><Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={doConfirm}>Remove</Button></>}
      />
    </AppShell>
  );
}

// ============================================================================
// Manage section — CR only (members)
// ============================================================================
function MemberRow({ member, label, actions }) {
  const { studyPersonName } = useApp();
  return (
    <div className="flex items-center gap-3 p-4">
      <Avatar name={studyPersonName(member.userId)} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{studyPersonName(member.userId)}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}

function MembersTab({ section, members, onAct }) {
  const pending = members.filter((m) => m.status === "pending");
  const approved = members.filter((m) => m.status === "approved");
  const crs = approved.filter((m) => m.role === "cr");
  const editors = approved.filter((m) => m.role === "editor");
  const plain = approved.filter((m) => m.role === "member");

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Join requests {pending.length > 0 && <span className="text-slate-400">· {pending.length}</span>}</h3>
        {pending.length === 0 ? (
          <EmptyState icon="Inbox" title="No pending requests" message="Students who ask to join your section show up here." />
        ) : (
          <Card className="divide-y divide-slate-200 overflow-hidden">
            {pending.map((m) => (
              <MemberRow key={m.id} member={m} label="Wants to join"
                actions={<><Button size="sm" variant="secondary" onClick={() => onAct("deny", m)}>Deny</Button><Button size="sm" icon="Check" onClick={() => onAct("approve", m)}>Approve</Button></>} />
            ))}
          </Card>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Roster <span className="text-slate-400">· {approved.length}</span></h3>
        <Card className="divide-y divide-slate-200 overflow-hidden">
          {crs.map((m) => (
            <MemberRow key={m.id} member={m} label="Class representative"
              actions={<span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700">CR</span>} />
          ))}
          {editors.map((m) => (
            <MemberRow key={m.id} member={m} label="Editor"
              actions={<><Button size="sm" variant="secondary" onClick={() => onAct("demote", m)}>Make member</Button><Button size="sm" variant="secondary" icon="UserMinus" onClick={() => onAct("remove", m)}>Remove</Button></>} />
          ))}
          {plain.map((m) => (
            <MemberRow key={m.id} member={m} label="Member"
              actions={<><Button size="sm" variant="secondary" icon="UserPlus" onClick={() => onAct("promote", m)}>Make editor</Button><Button size="sm" variant="secondary" icon="UserMinus" onClick={() => onAct("remove", m)}>Remove</Button></>} />
          ))}
          {approved.length === 0 && <div className="p-4 text-sm text-slate-500">No approved members yet.</div>}
        </Card>
      </section>
    </div>
  );
}

export function StudyHubManage({ sectionId }) {
  const {
    departments, studyIntakes, studySectionById, studyMembers, resolveMySection,
    approveMember, removeMember, setMemberRole, dataLoading,
  } = useApp();
  const toast = useToast();

  const section = studySectionById(sectionId);
  const intake = section && studyIntakes.find((i) => i.id === section.intakeId);
  const dept = intake && departments.find((d) => d.id === intake.deptId);

  if (!section || !intake || !dept) {
    return (
      <AppShell activeKey="study-hub" title="Study Hub">
        {dataLoading ? <Loading /> : (
          <EmptyState icon="Users" title="Section not found" message="This section may have changed."
            action={<Button onClick={() => navigate("/study-hub")}>Back to Study Hub</Button>} />
        )}
      </AppShell>
    );
  }

  const mine = resolveMySection();
  const isManager = section.isMine && !!(mine && isCR(mine.myRole));

  if (!isManager) {
    return (
      <AppShell activeKey="study-hub" title="Study Hub">
        <EmptyState icon="Lock" title="You don't manage this section" message="Only a section's CR can manage its members."
          action={<Button onClick={() => navigate(`/study-hub/section/${section.id}`)}>Back to section</Button>} />
      </AppShell>
    );
  }

  const members = studyMembers.filter((m) => m.sectionId === section.id);

  async function onAct(kind, m) {
    let r;
    if (kind === "approve") r = await approveMember(m.id);
    else if (kind === "deny" || kind === "remove") r = await removeMember(m.id);
    else if (kind === "promote") r = await setMemberRole(m.id, "editor");
    else if (kind === "demote") r = await setMemberRole(m.id, "member");
    if (r && !r.ok) { toast({ type: "error", title: "Couldn't update", message: r.error }); return; }
    const titles = { approve: "Member approved", deny: "Request denied", remove: "Member removed", promote: "Promoted to editor", demote: "Set to member" };
    toast({ type: "success", title: titles[kind] });
  }

  return (
    <AppShell activeKey="study-hub" title="Study Hub">
      <button onClick={() => navigate(`/study-hub/section/${section.id}`)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <Icon name="ArrowLeft" size={16} /> Section {section.number}
      </button>
      <PageHeader title={`Manage Section ${section.number}`} subtitle={`${deptCode(dept.name)} · Intake ${intake.number}`} />
      <MembersTab section={section} members={members} onAct={onAct} />
    </AppShell>
  );
}
