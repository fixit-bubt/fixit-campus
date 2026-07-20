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
    if (busy) return;
    setBusy(true);
    try {
      const url = await getStudyFileUrl(path);
      if (!url) { toast({ type: "error", title: "Couldn't open file", message: "Please try again." }); return; }
      await downloadFile(url, name);
    } catch {
      toast({ type: "error", title: "Download failed", message: "Please try again." });
    } finally {
      setBusy(false);
    }
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
        className="flex w-full items-center gap-3 rounded-md border border-dashed border-brd-2 bg-surface-2 px-4 py-3 text-left transition-colors hover:bg-surface-3"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface text-ink-3 shadow-sm">
          <Icon name="Paperclip" size={16} />
        </span>
        <span className="min-w-0 flex-1">
          {file
            ? <span className="block truncate text-base font-semibold text-ink-2">{file.name}</span>
            : <span className="block text-base text-ink-3">Choose a file</span>}
          <span className="block text-xs text-ink-3">PDF, DOC, PPT, ZIP · up to 10 MB</span>
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
        <p className="truncate text-base font-semibold text-ink">{ev.title}</p>
        <p className="truncate text-xs text-ink-3">
          {ev.context}{ev.context && " · "}{studyPersonName(ev.byId)}
        </p>
      </div>
      <span className="shrink-0 text-xs text-ink-3">{relativeDate(ev.createdAt)}</span>
    </div>
  );
}

// --- Course row -------------------------------------------------------------
function CourseRow({ course, sectionId, onDelete }) {
  const { studyFilesIn } = useApp();
  const count = studyFilesIn(course.id).length;
  return (
    <div className="group flex items-center transition-colors hover:bg-surface-2">
      <button
        onClick={() => navigate(`/study-hub/section/${sectionId}/course/${course.id}`)}
        className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left"
      >
        <AccentTile icon="BookOpen" tone={ACCENT} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink group-hover:text-teal-700 dark:group-hover:text-teal-300">
            {course.code} — {course.name}
          </p>
          <p className="mt-0.5 text-xs text-ink-3">{count} material{count === 1 ? "" : "s"}</p>
        </div>
        {!onDelete && <Icon name="ArrowRight" size={18} className="shrink-0 text-ink-3 group-hover:text-teal-500 dark:group-hover:text-teal-300" />}
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
    <div className="mb-6 flex flex-col gap-3 rounded-md border border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/15 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <AccentTile icon="ShieldCheck" tone={ACCENT} size={40} />
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink">You're the CR of Section {sectionNumber}</p>
          <p className="text-xs text-ink-2">
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
  const { currentUser, studyMembers, studySections, resolveMySection, studySectionStats, studyRecentActivity, studyCoursesIn, studyBooksInCourse, dataLoading, myPendingCreateRequest } = useApp();

  const mine = resolveMySection();

  if (!mine) {
    if (dataLoading && studySections.length === 0) {
      return <AppShell activeKey="study-hub" title="Study Hub"><Loading /></AppShell>;
    }
    const pendingCreate = myPendingCreateRequest();
    const myRow = studyMembers.find((m) => m.userId === currentUser?.id && m.status === "pending");
    if (myRow) return <StudyHubPending />;
    if (pendingCreate) return <StudyHubPending pendingCreate />;
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
          className="group flex items-center gap-4 rounded-md border border-brd bg-surface p-5 text-left shadow-sm transition-colors hover:border-teal-300 dark:hover:border-teal-500/40 hover:bg-teal-50/40 dark:hover:bg-teal-500/10"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-teal-100 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300"><Icon name="FolderOpen" size={22} /></span>
          <div className="flex-1">
            <p className="text-base font-semibold text-ink">Open my section</p>
            <p className="text-xs text-ink-3">Pinned notices and your subjects.</p>
          </div>
          <Icon name="ArrowRight" size={18} className="text-ink-3 group-hover:text-teal-500 dark:group-hover:text-teal-300" />
        </button>
        <button
          onClick={() => navigate(`/study-hub/intake/${section.intakeId}`)}
          className="group flex items-center gap-4 rounded-md border border-brd bg-surface p-5 text-left shadow-sm transition-colors hover:border-teal-300 dark:hover:border-teal-500/40 hover:bg-teal-50/40 dark:hover:bg-teal-500/10"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-surface-3 text-ink-2"><Icon name="Library" size={22} /></span>
          <div className="flex-1">
            <p className="text-base font-semibold text-ink">Study Materials</p>
            <p className="text-xs text-ink-3">Notes, questions & books from every section — and senior intakes.</p>
          </div>
          <Icon name="ArrowRight" size={18} className="text-ink-3 group-hover:text-teal-500 dark:group-hover:text-teal-300" />
        </button>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">Recent activity</h3>
          <button onClick={() => navigate(`/study-hub/section/${section.id}`)} className="text-base font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-300">Open section</button>
        </div>
        {activity.length === 0 ? (
          <EmptyState icon="FileText" title="Nothing yet" message="New materials and pins will show up here." />
        ) : (
          <Card className="divide-y divide-brd overflow-hidden">
            {activity.map((ev) => <ActivityRow key={ev.id} ev={ev} />)}
          </Card>
        )}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">Your courses</h3>
          <span className="text-xs text-ink-3">{courses.length} total</span>
        </div>
        {courses.length === 0 ? (
          <EmptyState icon="BookOpen" title="No courses yet" message="Courses your CR or editors add will appear here." />
        ) : (
          <Card className="divide-y divide-brd overflow-hidden">
            {shownCourses.map((c) => <CourseRow key={c.id} course={c} sectionId={section.id} />)}
            {courses.length > shownCourses.length && (
              <button
                onClick={() => navigate(`/study-hub/section/${section.id}`)}
                className="flex w-full items-center justify-center gap-1.5 p-3 text-base font-semibold text-teal-700 dark:text-teal-300 hover:bg-surface-2"
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
// First-run setup — join by code / find section / request new section
// ============================================================================
function StudyHubSetup() {
  const { departments, studyIntakesIn, studySectionsIn, requestJoinSection, joinByCode, requestCreateSection } = useApp();
  const toast = useToast();

  const [mode, setMode] = React.useState("join");       // "join" | "create"
  const [joinMode, setJoinMode] = React.useState("code"); // "code" | "find"

  // Join-by-code state
  const [code, setCode] = React.useState("");
  const [codeError, setCodeError] = React.useState("");
  const [codeSaving, setCodeSaving] = React.useState(false);

  // Find-section state
  const [deptId, setDeptId] = React.useState("");
  const [intakeId, setIntakeId] = React.useState("");
  const [sectionId, setSectionId] = React.useState("");
  const [findSaving, setFindSaving] = React.useState(false);

  // Create-section state
  const [crDeptId, setCrDeptId] = React.useState("");
  const [crIntakeId, setCrIntakeId] = React.useState("");
  const [crNumber, setCrNumber] = React.useState("");
  const [crError, setCrError] = React.useState("");
  const [crSaving, setCrSaving] = React.useState(false);

  // Derived — find
  const activeDeptId = deptId || departments[0]?.id || "";
  const intakes = activeDeptId ? studyIntakesIn(activeDeptId) : [];
  const activeIntakeId = intakeId && intakes.some((i) => i.id === intakeId) ? intakeId : (intakes[0]?.id || "");
  const sections = activeIntakeId ? studySectionsIn(activeIntakeId) : [];
  const activeSectionId = sectionId && sections.some((s) => s.id === sectionId) ? sectionId : (sections[0]?.id || "");

  // Derived — create
  const crActiveDeptId = crDeptId || departments[0]?.id || "";
  const crIntakes = crActiveDeptId ? studyIntakesIn(crActiveDeptId) : [];
  const crActiveIntakeId = crIntakeId && crIntakes.some((i) => i.id === crIntakeId) ? crIntakeId : (crIntakes[0]?.id || "");

  async function submitCode(e) {
    if (e) e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    // Legacy codes are 6 chars (0057); sections approved after 0061 get 8-char codes.
    if (trimmed.length < 6 || trimmed.length > 8) { setCodeError("Enter the 6–8 character code from your CR."); return; }
    if (codeSaving) return;
    setCodeSaving(true); setCodeError("");
    try {
      const r = await joinByCode(trimmed);
      if (!r.ok) { setCodeError(r.error || "Invalid code — check it and try again."); return; }
      toast({ type: "success", title: "Joined!", message: "You're now a member of the section." });
    } finally { setCodeSaving(false); }
  }

  async function submitFind(e) {
    if (e) e.preventDefault();
    if (!activeSectionId || findSaving) return;
    setFindSaving(true);
    try {
      const r = await requestJoinSection(activeSectionId);
      if (!r.ok) { toast({ type: "error", title: "Couldn't send request", message: r.error }); return; }
      toast({ type: "success", title: "Request sent", message: "Your CR will approve you shortly." });
    } finally { setFindSaving(false); }
  }

  async function submitCreate(e) {
    if (e) e.preventDefault();
    const num = parseInt(crNumber, 10);
    // The request row is keyed by intake NUMBER, not id (schema: intake_number int).
    const crIntakeNumber = crIntakes.find((i) => i.id === crActiveIntakeId)?.number;
    if (!crActiveIntakeId || !crIntakeNumber) { setCrError("Select an intake."); return; }
    if (!num || num < 1 || num > 99) { setCrError("Enter a valid section number (1–99)."); return; }
    if (crSaving) return;
    setCrSaving(true); setCrError("");
    try {
      const r = await requestCreateSection(crActiveDeptId, crIntakeNumber, num);
      if (!r.ok) { setCrError(r.error || "Couldn't send request."); return; }
      toast({ type: "success", title: "Request sent", message: "Admin will review and create your section." });
    } finally { setCrSaving(false); }
  }

  return (
    <AppShell activeKey="study-hub" title="Study Hub">
      <div className="mx-auto max-w-lg">
        <PageHeader title="Study Hub" />
        <Card className="p-6">
          <div className="mb-6 flex items-start gap-4">
            <AccentTile icon="BookMarked" tone={ACCENT} size={48} />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-ink">Get started</h3>
              <p className="mt-1 text-base text-ink-3">Join your class section to share notes, questions, and books — or request a new section if yours hasn't been created yet.</p>
            </div>
          </div>

          <SegmentToggle
            options={[{ value: "join", label: "Join a section", icon: "LogIn" }, { value: "create", label: "Request new section", icon: "Plus" }]}
            value={mode}
            onChange={(v) => { setMode(v); setCodeError(""); setCrError(""); }}
          />

          {mode === "join" && (
            <div className="mt-5 space-y-5">
              <SegmentToggle
                options={[{ value: "code", label: "I have a code", icon: "Hash" }, { value: "find", label: "Find my section", icon: "Search" }]}
                value={joinMode}
                onChange={(v) => { setJoinMode(v); setCodeError(""); }}
              />

              {joinMode === "code" && (
                <form onSubmit={submitCode} className="space-y-4">
                  <Field label="Join code" htmlFor="su-code" error={codeError} hint="6–8 character code from your CR.">
                    <Input
                      id="su-code" value={code} error={!!codeError} maxLength={8}
                      onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setCodeError(""); }}
                      placeholder="e.g. A3B7C2"
                      className="tracking-widest font-mono text-center text-2xl"
                    />
                  </Field>
                  <div className="flex justify-end">
                    <Button type="submit" icon="LogIn" disabled={codeSaving || code.length < 6}>
                      {codeSaving ? <Spinner size={16} /> : "Join now"}
                    </Button>
                  </div>
                </form>
              )}

              {joinMode === "find" && (
                <form onSubmit={submitFind} className="space-y-4">
                  <Field label="Department" htmlFor="su-dept">
                    <Select id="su-dept" value={activeDeptId} onChange={(e) => { setDeptId(e.target.value); setIntakeId(""); setSectionId(""); }}>
                      {departments.map((d) => <option key={d.id} value={d.id}>{shortDept(d.name)}</option>)}
                    </Select>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
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
                    <p className="text-xs text-ink-3">No sections here yet — switch to "Request new section" to create yours.</p>
                  )}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <button type="button" onClick={() => navigate("/study-hub/browse")} className="text-base font-semibold text-ink-3 hover:text-ink-2">Browse first</button>
                    <Button type="submit" icon="Send" disabled={findSaving || !activeSectionId}>
                      {findSaving ? <Spinner size={16} /> : "Request to join"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {mode === "create" && (
            <form onSubmit={submitCreate} className="mt-5 space-y-4">
              <p className="text-xs text-ink-3">Tell us your intake and the section number you want. Admin will review and set you as Class Representative.</p>
              <Field label="Department" htmlFor="cr-dept">
                <Select id="cr-dept" value={crActiveDeptId} onChange={(e) => { setCrDeptId(e.target.value); setCrIntakeId(""); }}>
                  {departments.map((d) => <option key={d.id} value={d.id}>{shortDept(d.name)}</option>)}
                </Select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Intake" htmlFor="cr-intake">
                  <Select id="cr-intake" value={crActiveIntakeId} onChange={(e) => setCrIntakeId(e.target.value)} disabled={!crIntakes.length}>
                    {crIntakes.length ? crIntakes.map((i) => <option key={i.id} value={i.id}>Intake {i.number}</option>) : <option value="">No intakes</option>}
                  </Select>
                </Field>
                <Field label="Section number" htmlFor="cr-num" error={crError}>
                  <Input id="cr-num" type="number" min={1} max={99} value={crNumber} error={!!crError}
                    onChange={(e) => { setCrNumber(e.target.value); setCrError(""); }} placeholder="e.g. 3" />
                </Field>
              </div>
              {crError && <p className="text-xs text-danger">{crError}</p>}
              <div className="flex justify-end pt-1">
                <Button type="submit" icon="Send" disabled={crSaving}>
                  {crSaving ? <Spinner size={16} /> : "Request to create"}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

// --- Pending: awaiting CR approval (join) or admin approval (section creation) ---
function StudyHubPending({ pendingCreate }) {
  const { currentUser, studyMembers, studySectionById } = useApp();
  if (pendingCreate) {
    return (
      <AppShell activeKey="study-hub" title="Study Hub">
        <div className="mx-auto max-w-lg">
          <PageHeader title="Study Hub" />
          <EmptyState
            icon="Clock"
            title="Section creation request pending"
            message="Admin is reviewing your request to create a new section. You'll become the Class Representative once it's approved."
            action={<Button variant="secondary" icon="LayoutGrid" onClick={() => navigate("/study-hub/browse")}>Browse departments</Button>}
          />
        </div>
      </AppShell>
    );
  }
  const row = studyMembers.find((m) => m.userId === currentUser?.id && m.status === "pending");
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
      className="group flex items-center gap-4 rounded-md border border-brd bg-surface p-5 text-left shadow-sm transition-colors hover:border-teal-300 dark:hover:border-teal-500/40 hover:bg-teal-50/40 dark:hover:bg-teal-500/10"
    >
      <AccentTile icon={BRANCH_ICON[dept.branch] || "GraduationCap"} tone={ACCENT} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-ink">{shortDept(dept.name)}</p>
        <p className="mt-0.5 truncate text-xs text-ink-3">{count} intake{count === 1 ? "" : "s"}</p>
      </div>
      <Icon name="ArrowRight" size={18} className="text-ink-3 group-hover:text-teal-500 dark:group-hover:text-teal-300" />
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
      <button onClick={() => navigate("/study-hub")} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
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
              <h3 className="mb-3 text-base font-semibold text-ink">{branch}</h3>
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
      className="group flex items-center gap-4 rounded-md border border-brd bg-surface p-5 text-left shadow-sm transition-colors hover:border-teal-300 dark:hover:border-teal-500/40 hover:bg-teal-50/40 dark:hover:bg-teal-500/10"
    >
      <AccentTile icon="Users" tone={ACCENT} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-ink">Intake {intake.number}</p>
        <p className="mt-0.5 truncate text-xs text-ink-3">{intake.years ? `${intake.years} · ` : ""}{sectionCount} section{sectionCount === 1 ? "" : "s"}</p>
      </div>
      <Icon name="ArrowRight" size={18} className="text-ink-3 group-hover:text-teal-500 dark:group-hover:text-teal-300" />
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
      <button onClick={() => navigate("/study-hub/browse")} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
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
    <div className={`flex flex-col rounded-md border bg-surface p-5 shadow-sm ${section.isMine ? "border-teal-300 dark:border-teal-500/40" : "border-brd"}`}>
      <div className="flex items-start gap-3">
        <AccentTile icon="Users" tone={ACCENT} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="truncate text-base font-semibold text-ink">Section {section.number}</p>
            {section.isMine && <span className="rounded-full bg-teal-50 dark:bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:text-teal-300">You</span>}
            {!section.isPublic && <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-semibold text-ink-3"><Icon name="Lock" size={9} /> Private</span>}
          </div>
          {subtitle && <p className="mt-0.5 truncate text-xs text-ink-3">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-brd pt-3">
        <span className="text-xs text-ink-3">{materials} material{materials === 1 ? "" : "s"}</span>
        {section.isMine
          ? <Button size="sm" iconRight="ArrowRight" onClick={open}>Open</Button>
          : <Button size="sm" variant="secondary" iconRight="ArrowRight" onClick={open}>Browse</Button>}
      </div>
    </div>
  );
}

function BookRow({ book, isManager, onDelete, saved, onToggleSave }) {
  const { studyPersonName, currentUser } = useApp();
  const canDelete = isManager || book.byId === currentUser?.id; // RLS: own add or CR
  return (
    <div className="flex items-center gap-3 p-4">
      <AccentTile icon={BOOK_KIND_ICON[book.kind] || "BookOpen"} tone={ACCENT} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-ink">{book.title}</p>
        <p className="truncate text-xs text-ink-3">{book.kind}{book.author ? ` · ${book.author}` : ""}{book.edition ? ` · ${book.edition}` : ""}</p>
        <p className="truncate text-xs text-ink-3">{studyPersonName(book.byId)} · {relativeDate(book.createdAt)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onToggleSave && <BookmarkIcon saved={saved} onClick={() => onToggleSave(book)} />}
        {canDelete && <DeleteIcon onClick={() => onDelete(book)} title="Remove book" />}
        {book.url
          ? <a href={book.url} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-brd bg-surface px-3 text-base font-semibold text-ink-2 shadow-sm hover:bg-surface-2"><Icon name="ExternalLink" size={15} /> Open link</a>
          : <DownloadButton path={book.path} name={book.title} />}
      </div>
    </div>
  );
}

function DeleteIcon({ onClick, title }) {
  return (
    <button onClick={onClick} title={title} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-3 hover:bg-danger-bg hover:text-danger">
      <Icon name="Trash2" size={16} />
    </button>
  );
}

// Bookmark toggle shown on every file/paper/book row (study_bookmarks).
function BookmarkIcon({ saved, onClick }) {
  return (
    <button onClick={onClick} title={saved ? "Remove bookmark" : "Bookmark"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-surface-2 ${saved ? "text-warn" : "text-ink-3 hover:text-ink-2"}`}>
      <Icon name="Bookmark" size={16} className={saved ? "fill-amber-400" : ""} />
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
    if (saving) return;
    const er = {};
    if (!form.title.trim()) er.title = "Enter a title.";
    if (!form.file && !form.url.trim()) er.url = "Attach a file or add a link.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const r = await addStudyBook(courseId, { title: form.title, kind: form.kind, author: form.author, courseCode, url: form.url, file: form.file });
      if (!r.ok) { toast({ type: "error", title: "Couldn't add book", message: r.error }); return; }
      toast({ type: "success", title: "Book added", message: form.title.trim() });
      reset(); onClose();
    } finally {
      setSaving(false);
    }
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

function BooksTab({ books, canAdd, isManager, onAdd, onDelete, saved, onToggleSave }) {
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
        <Card className="divide-y divide-brd overflow-hidden">
          {shown.map((b) => <BookRow key={b.id} book={b} isManager={isManager} onDelete={onDelete}
            saved={saved?.has(b.id)} onToggleSave={onToggleSave && (() => onToggleSave("book", b))} />)}
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
      <button onClick={() => navigate("/study-hub")} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
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

      <h3 className="mb-3 text-base font-semibold text-ink">Sections · Intake {intake.number}</h3>
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
    if (saving) return;
    if (!message.trim()) { setError("Enter a message."); return; }
    if (kind === "file" && !file) { setError("Choose a file."); return; }
    setSaving(true);
    try {
      const r = await addStudyPin(sectionId, { kind, message, file });
      if (!r.ok) { toast({ type: "error", title: "Couldn't pin", message: r.error }); return; }
      toast({ type: "success", title: "Pinned" });
      setMessage(""); setFile(null); setKind("text"); setError(""); onClose();
    } finally {
      setSaving(false);
    }
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
    if (saving) return;
    const er = {};
    if (!form.code.trim()) er.code = "Enter a course code.";
    if (!form.name.trim()) er.name = "Enter a course name.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const r = await addStudyCourse(sectionId, { code: form.code, name: form.name });
      if (!r.ok) { toast({ type: "error", title: "Couldn't add course", message: r.error }); return; }
      toast({ type: "success", title: "Course added", message: `${form.code.trim()} — ${form.name.trim()}` });
      setForm({ code: "", name: "" }); setErrors({}); onClose();
    } finally {
      setSaving(false);
    }
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
    if (saving) return;
    const er = {};
    if (!form.title.trim()) er.title = "Enter a title.";
    if (!form.file) er.file = "Choose a file.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const r = await uploadStudyQB(courseId, { exam: form.exam, title: form.title, file: form.file });
      if (!r.ok) { toast({ type: "error", title: "Upload failed", message: r.error }); return; }
      toast({ type: "success", title: "Uploaded", message: form.title.trim() });
      setForm({ exam: "CT 1", title: "", file: null }); setErrors({}); onClose();
    } finally {
      setSaving(false);
    }
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
        <p className="text-base font-semibold text-ink">{pin.message}</p>
        {pin.kind === "file" && pin.fileName && (
          <div className="mt-1.5"><DownloadButton path={pin.path} name={pin.fileName} /></div>
        )}
        <p className="mt-1 text-xs text-ink-3">{studyPersonName(pin.byId)} · {relativeDate(pin.createdAt)}</p>
      </div>
      {manager && (
        <button onClick={() => onUnpin(pin)} title="Unpin" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink-2"><Icon name="X" size={16} /></button>
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
        <Card className="divide-y divide-brd overflow-hidden">
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
        <Card className="divide-y divide-brd overflow-hidden">
          {courses.map((c) => <CourseRow key={c.id} course={c} sectionId={section.id} onDelete={manager ? onDeleteCourse : undefined} />)}
        </Card>
      )}
    </div>
  );
}

function QBPaperRow({ paper, isManager, onVerify, onDelete, saved, onToggleSave }) {
  const { studyPersonName, currentUser } = useApp();
  const canDelete = isManager || paper.byId === currentUser?.id; // RLS: own upload or CR
  return (
    <div className="flex items-center gap-3 p-4">
      <AccentTile icon={fileIcon(paper.kind)} tone={ACCENT} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-base font-semibold text-ink">{paper.title}</p>
          {paper.verified && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-semibold text-success"><Icon name="BadgeCheck" size={11} /> Verified</span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-3">{studyPersonName(paper.byId)} · {relativeDate(paper.createdAt)} · {fmtFileSize(paper.sizeMB)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onToggleSave && <BookmarkIcon saved={saved} onClick={() => onToggleSave(paper)} />}
        {isManager && (
          <button onClick={() => onVerify(paper)} title={paper.verified ? "Unverify" : "Mark verified"} className={`inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-surface-2 ${paper.verified ? "text-success" : "text-ink-3"}`}><Icon name="BadgeCheck" size={16} /></button>
        )}
        {canDelete && <DeleteIcon onClick={() => onDelete(paper)} title="Remove paper" />}
        <DownloadButton path={paper.path} name={paper.title} />
      </div>
    </div>
  );
}

function QuestionBankTab({ qb, canEdit, isManager, onUpload, onVerify, onDelete, saved, onToggleSave }) {
  const [exam, setExam] = React.useState("All");
  // Chip values come from the data (study_question_bank.exam), with the known
  // exams first so the order stays stable.
  const exams = ["All", ...QB_EXAMS.filter((x) => qb.some((q) => q.exam === x)),
    ...[...new Set(qb.map((q) => q.exam).filter(Boolean))].filter((x) => !QB_EXAMS.includes(x))];
  const counts = { All: qb.length };
  exams.slice(1).forEach((x) => { counts[x] = qb.filter((q) => q.exam === x).length; });
  const shown = exam === "All" ? qb : qb.filter((q) => q.exam === exam);
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs options={exams} value={exam} onChange={setExam} counts={counts} />
        {canEdit && <Button icon="Upload" onClick={onUpload}>Upload paper</Button>}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon="FileQuestion" title={exam === "All" ? "No papers" : `No ${exam} papers`} message={canEdit ? "Upload a past paper to start the bank." : "Nothing here yet."} />
      ) : (
        <Card className="divide-y divide-brd overflow-hidden">
          {shown.map((q) => <QBPaperRow key={q.id} paper={q} isManager={isManager} onVerify={onVerify} onDelete={onDelete}
            saved={saved?.has(q.id)} onToggleSave={onToggleSave && (() => onToggleSave("question", q))} />)}
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
  const [confirmBusy, setConfirmBusy] = React.useState(false);
  const [unpinBusy, setUnpinBusy] = React.useState(false);

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
  const myDeptId = mine?.section?.deptId;
  const myIntakeId = mine?.section?.intakeId;
  const sectionIntake = studyIntakes.find((i) => i.id === section.intakeId);
  const myRole = section.isMine ? (mine?.myRole || "member") : "viewer";
  const canView =
    section.isMine ||
    (section.isPublic && section.intakeId === myIntakeId) ||
    (section.isPublic && sectionIntake?.isPublic && myDeptId != null && section.deptId === myDeptId);
  const canAddCourse = section.isMine && canContribute(myRole);
  const manager = section.isMine && isCR(myRole);
  const back = () => navigate(section.isMine ? "/study-hub" : `/study-hub/intake/${section.intakeId}`);

  if (!canView) {
    const noMembership = !mine;
    const isPrivate = !section.isPublic;
    const message = noMembership
      ? "Join a section first to browse Study Hub materials."
      : isPrivate
      ? "This section is private — only its members can view the content."
      : "These materials belong to another department.";
    return (
      <AppShell activeKey="study-hub" title="Study Hub">
        <button onClick={() => navigate("/study-hub")} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
          <Icon name="ArrowLeft" size={16} /> Study Hub
        </button>
        <EmptyState
          icon="Lock"
          title={isPrivate ? "Private section" : "Not available"}
          message={message}
          action={noMembership ? <Button onClick={() => navigate("/study-hub")}>Go to Study Hub</Button> : null}
        />
      </AppShell>
    );
  }

  const pins = studyPinsIn(section.id);
  const courses = studyCoursesIn(section.id);

  async function unpin(pin) {
    if (unpinBusy) return;
    setUnpinBusy(true);
    try {
      const r = await deleteStudyPin(pin.id);
      if (!r.ok) { toast({ type: "error", title: "Couldn't unpin", message: r.error }); return; }
      toast({ type: "success", title: "Unpinned" });
    } catch {
      toast({ type: "error", title: "Couldn't unpin", message: "Please try again." });
    } finally {
      setUnpinBusy(false);
    }
  }
  async function doConfirm() {
    if (!confirm || confirmBusy) return;
    setConfirmBusy(true);
    try {
      const r = await deleteStudyCourse(confirm.item.id);
      if (!r.ok) { toast({ type: "error", title: "Couldn't remove", message: r.error }); return; }
      toast({ type: "success", title: "Subject removed", message: confirm.item.code });
      setConfirm(null);
    } catch {
      toast({ type: "error", title: "Couldn't remove", message: "Please try again." });
      setConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <AppShell activeKey="study-hub" title="Study Hub">
      <button onClick={back} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
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
        footer={<><Button variant="secondary" onClick={() => setConfirm(null)} disabled={confirmBusy}>Cancel</Button><Button variant="destructive" onClick={doConfirm} disabled={confirmBusy}>Remove</Button></>}
      />
    </AppShell>
  );
}

// Section header with a CR-name subtitle (needs studyPersonName).
function SectionHeader({ section, dept, intake, manager }) {
  const { studyPersonName } = useApp();
  const crName = section.crIds[0] ? studyPersonName(section.crIds[0]) : null;
  const editors = (section.editorIds || []).length;
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
    if (saving) return;
    const er = {};
    if (!form.title.trim()) er.title = "Enter a title.";
    if (!form.file) er.file = "Choose a file.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const r = await uploadStudyMaterial(courseId, { title: form.title, type: form.type, file: form.file });
      if (!r.ok) { toast({ type: "error", title: "Upload failed", message: r.error }); return; }
      toast({ type: "success", title: "Uploaded", message: form.title.trim() });
      setForm({ type: "Class Note", title: "", file: null }); setErrors({}); onClose();
    } finally {
      setSaving(false);
    }
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

function FileRow({ file, isManager, onDelete, saved, onToggleSave }) {
  const { studyPersonName, currentUser } = useApp();
  const canDelete = isManager || file.byId === currentUser?.id; // RLS: own upload or CR
  return (
    <div className="flex items-center gap-3 p-4">
      <AccentTile icon={fileIcon(file.kind)} tone={ACCENT} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-ink">{file.title}</p>
        <p className="mt-0.5 truncate text-xs text-ink-3">{file.type} · {studyPersonName(file.byId)} · {relativeDate(file.createdAt)} · {fmtFileSize(file.sizeMB)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onToggleSave && <BookmarkIcon saved={saved} onClick={() => onToggleSave(file)} />}
        {canDelete && <DeleteIcon onClick={() => onDelete(file)} title="Remove" />}
        <DownloadButton path={file.path} name={file.title} />
      </div>
    </div>
  );
}

// Notes (course materials) tab — file list with a type filter.
function NotesTab({ files, canUpload, manager, onUpload, onDelete, saved, onToggleSave }) {
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
        <Card className="divide-y divide-brd overflow-hidden">
          {shown.map((f) => <FileRow key={f.id} file={f} isManager={manager} onDelete={onDelete}
            saved={saved?.has(f.id)} onToggleSave={onToggleSave && (() => onToggleSave("material", f))} />)}
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
    studyCourseById, studySectionById, studyIntakes, studyFilesIn, studyQuestionsIn, studyBooksInCourse,
    resolveMySection, deleteStudyMaterial, deleteStudyQB, setQBVerified, deleteStudyBook, dataLoading,
    getStudyBookmarks, toggleStudyBookmark, listings = [],
  } = useApp();
  const toast = useToast();
  const [tab, setTab] = React.useState("Notes");
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [qbOpen, setQbOpen] = React.useState(false);
  const [bookOpen, setBookOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState(null); // { kind: 'note'|'qb'|'book', item }
  const [confirmBusy, setConfirmBusy] = React.useState(false);
  const [verifyBusy, setVerifyBusy] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState("new"); // new | name
  const [saved, setSaved] = React.useState(() => new Set());

  // Saved state for everything visible in this subject (study_bookmarks is
  // own-only under RLS, so the ids are all we need to send).
  const allItems = [...studyFilesIn(courseId), ...studyQuestionsIn(courseId), ...studyBooksInCourse(courseId)];
  const idsKey = allItems.map((x) => x.id).sort().join(",");
  React.useEffect(() => {
    let live = true;
    if (!idsKey) { setSaved(new Set()); return; }
    getStudyBookmarks(idsKey.split(",")).then((s) => { if (live) setSaved(s); });
    return () => { live = false; };
  }, [idsKey]);

  // Optimistic toggle; reverts if the write fails.
  async function toggleSave(itemType, item) {
    const wasSaved = saved.has(item.id);
    const flip = (set, on) => { const n = new Set(set); on ? n.add(item.id) : n.delete(item.id); return n; };
    setSaved((prev) => flip(prev, !wasSaved));
    const r = await toggleStudyBookmark(itemType, item.id, wasSaved);
    if (!r.ok) {
      setSaved((prev) => flip(prev, wasSaved));
      toast({ type: "error", title: "Couldn't update bookmark", message: r.error });
    }
  }

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
  const myDeptId = mine?.section?.deptId;
  const myIntakeId = mine?.section?.intakeId;
  const sectionIntake = studyIntakes.find((i) => i.id === section.intakeId);
  const myRole = section.isMine ? (mine?.myRole || "member") : "viewer";
  const canView =
    section.isMine ||
    (section.isPublic && section.intakeId === myIntakeId) ||
    (section.isPublic && sectionIntake?.isPublic && myDeptId != null && section.deptId === myDeptId);
  const canUpload = section.isMine && canContribute(myRole);
  const manager = section.isMine && isCR(myRole);

  if (!canView) {
    const noMembership = !mine;
    const isPrivate = !section.isPublic;
    const message = noMembership
      ? "Join a section first to browse Study Hub materials."
      : isPrivate
      ? "This section is private — only its members can view the content."
      : "These materials belong to another department.";
    return (
      <AppShell activeKey="study-hub" title="Study Hub">
        <EmptyState
          icon="Lock"
          title={isPrivate ? "Private section" : "Not available"}
          message={message}
          action={<Button onClick={() => navigate("/study-hub")}>Back to Study Hub</Button>}
        />
      </AppShell>
    );
  }

  // Search (title) + sort (newest / name) apply to every tab's list.
  const q = query.trim().toLowerCase();
  const bySort = (a, b) => sort === "name"
    ? a.title.localeCompare(b.title)
    : (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  const refine = (list) => list.filter((x) => !q || (x.title ?? "").toLowerCase().includes(q)).sort(bySort);
  const files = refine(studyFilesIn(course.id));
  const qb = refine(studyQuestionsIn(course.id));
  const books = refine(studyBooksInCourse(course.id));

  async function verifyQB(paper) {
    if (verifyBusy) return;
    setVerifyBusy(true);
    try {
      const r = await setQBVerified(paper.id, !paper.verified);
      if (!r.ok) { toast({ type: "error", title: "Couldn't update", message: r.error }); return; }
      toast({ type: "success", title: paper.verified ? "Marked unverified" : "Marked verified" });
    } catch {
      toast({ type: "error", title: "Couldn't update", message: "Please try again." });
    } finally {
      setVerifyBusy(false);
    }
  }
  async function doConfirm() {
    if (!confirm || confirmBusy) return;
    setConfirmBusy(true);
    try {
      const { kind, item } = confirm;
      const r = kind === "note" ? await deleteStudyMaterial(item.id)
              : kind === "qb"   ? await deleteStudyQB(item.id)
              :                   await deleteStudyBook(item.id);
      if (!r.ok) { toast({ type: "error", title: "Couldn't remove", message: r.error }); return; }
      toast({ type: "success", title: "Removed", message: item.title });
      setConfirm(null);
    } catch {
      toast({ type: "error", title: "Couldn't remove", message: "Please try again." });
      setConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  const confirmLabel = { note: "note", qb: "question paper", book: "book" }[confirm?.kind] || "item";

  // Marketplace cross-link: Available listings tagged with this course code
  // (0077). Codes compared ignoring case/spacing so "CSE101" matches "CSE 101".
  const normCode = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const courseListings = listings.filter(
    (l) => l.status === "Available" && l.courseCode && normCode(l.courseCode) === normCode(course.code)
  );

  return (
    <AppShell activeKey="study-hub" title="Study Hub">
      <button onClick={() => navigate(`/study-hub/section/${section.id}`)} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
        <Icon name="ArrowLeft" size={16} /> Section {section.number}
      </button>
      <PageHeader
        title={`${course.code} — ${course.name}`}
        subtitle={section.isMine ? null : `Section ${section.number} · read-only`}
      />

      {/* Used books/notes for this course on the marketplace */}
      {courseListings.length > 0 && (
        <Card className="mb-5 p-4">
          <p className="text-base font-bold text-ink">
            For sale on the marketplace <span className="font-semibold text-ink-3">· {courseListings.length}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {courseListings.slice(0, 6).map((l) => (
              <button
                key={l.id}
                onClick={() => navigate(`/marketplace/${l.id}`)}
                className="inline-flex items-center gap-2 rounded-md border border-brd bg-surface px-3 py-2 text-left hover:bg-surface-2"
              >
                <Icon name={l.category === "Books" ? "BookOpen" : "NotebookPen"} size={15} className="text-violet-600 dark:text-violet-300" />
                <span className="max-w-[180px] truncate text-base font-semibold text-ink">{l.title}</span>
                <span className="text-base font-bold text-violet-600 dark:text-violet-300">৳{l.price}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-5 flex flex-col gap-3">
        <FilterTabs options={["Notes", "Questions", "Books"]} value={tab} onChange={setTab}
          counts={{ Notes: files.length, Questions: qb.length, Books: books.length }} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Icon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search in this subject"
              placeholder="Search by title…"
              className="h-11 w-full rounded-md border border-brd bg-surface pl-9 pr-3 text-base text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <SegmentToggle
            options={[{ value: "new", label: "Newest", icon: "Clock" }, { value: "name", label: "Name", icon: "ArrowDownAZ" }]}
            value={sort} onChange={setSort} />
        </div>
      </div>

      {tab === "Notes" && (
        <NotesTab files={files} canUpload={canUpload} manager={manager}
          onUpload={() => setUploadOpen(true)} onDelete={(item) => setConfirm({ kind: "note", item })}
          saved={saved} onToggleSave={toggleSave} />
      )}
      {tab === "Questions" && (
        <QuestionBankTab qb={qb} canEdit={canUpload} isManager={manager}
          onUpload={() => setQbOpen(true)} onVerify={verifyQB} onDelete={(item) => setConfirm({ kind: "qb", item })}
          saved={saved} onToggleSave={toggleSave} />
      )}
      {tab === "Books" && (
        <BooksTab books={books} canAdd={canUpload} isManager={manager}
          onAdd={() => setBookOpen(true)} onDelete={(item) => setConfirm({ kind: "book", item })}
          saved={saved} onToggleSave={toggleSave} />
      )}

      <UploadFileModal open={uploadOpen} onClose={() => setUploadOpen(false)} courseId={course.id} courseCode={course.code} />
      <UploadQBModal open={qbOpen} onClose={() => setQbOpen(false)} courseId={course.id} />
      <AddBookModal open={bookOpen} onClose={() => setBookOpen(false)} courseId={course.id} courseCode={course.code} />
      <Modal
        open={!!confirm} onClose={() => setConfirm(null)} icon="Trash2" tone="red"
        title={`Remove this ${confirmLabel}?`}
        description={confirm ? `"${confirm.item.title}" will be removed for everyone in the section.` : ""}
        footer={<><Button variant="secondary" onClick={() => setConfirm(null)} disabled={confirmBusy}>Cancel</Button><Button variant="destructive" onClick={doConfirm} disabled={confirmBusy}>Remove</Button></>}
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
        <p className="truncate text-base font-semibold text-ink">{studyPersonName(member.userId)}</p>
        <p className="text-xs text-ink-3">{label}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}

function MembersTab({ section, members, onAct, actBusy }) {
  const pending = members.filter((m) => m.status === "pending");
  const approved = members.filter((m) => m.status === "approved");
  const crs = approved.filter((m) => m.role === "cr");
  const editors = approved.filter((m) => m.role === "editor");
  const plain = approved.filter((m) => m.role === "member");

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 text-base font-semibold text-ink">Join requests {pending.length > 0 && <span className="text-ink-3">· {pending.length}</span>}</h3>
        {pending.length === 0 ? (
          <EmptyState icon="Inbox" title="No pending requests" message="Students who ask to join your section show up here." />
        ) : (
          <Card className="divide-y divide-brd overflow-hidden">
            {pending.map((m) => (
              <MemberRow key={m.id} member={m} label="Wants to join"
                actions={<><Button size="sm" variant="secondary" onClick={() => onAct("deny", m)} disabled={actBusy}>Deny</Button><Button size="sm" icon="Check" onClick={() => onAct("approve", m)} disabled={actBusy}>Approve</Button></>} />
            ))}
          </Card>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-base font-semibold text-ink">Roster <span className="text-ink-3">· {approved.length}</span></h3>
        <Card className="divide-y divide-brd overflow-hidden">
          {crs.map((m) => (
            <MemberRow key={m.id} member={m} label="Class representative"
              actions={<span className="rounded-full bg-teal-50 dark:bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:text-teal-300">CR</span>} />
          ))}
          {editors.map((m) => (
            <MemberRow key={m.id} member={m} label="Editor"
              actions={<><Button size="sm" variant="secondary" onClick={() => onAct("demote", m)} disabled={actBusy}>Make member</Button><Button size="sm" variant="secondary" icon="UserMinus" onClick={() => onAct("remove", m)} disabled={actBusy}>Remove</Button></>} />
          ))}
          {plain.map((m) => (
            <MemberRow key={m.id} member={m} label="Member"
              actions={<><Button size="sm" variant="secondary" icon="UserPlus" onClick={() => onAct("promote", m)} disabled={actBusy}>Make editor</Button><Button size="sm" variant="secondary" icon="UserMinus" onClick={() => onAct("remove", m)} disabled={actBusy}>Remove</Button></>} />
          ))}
          {approved.length === 0 && <div className="p-4 text-base text-ink-3">No approved members yet.</div>}
        </Card>
      </section>
    </div>
  );
}

// ============================================================================
// Settings tab — join code, section privacy, intake vote
// ============================================================================
function SettingsTab({ section, intake, onTogglePublic, toggleBusy }) {
  const { intakeVoteFor, intakeBallotsFor, myBallotFor, initiateIntakeVote, castIntakeVote } = useApp();
  const toast = useToast();
  const [copied, setCopied] = React.useState(false);
  const [voteLoading, setVoteLoading] = React.useState(false);

  const vote = intakeVoteFor(intake.id);
  const ballots = vote ? intakeBallotsFor(vote.id) : [];
  const myBallot = vote ? myBallotFor(vote.id) : null;

  async function copyCode() {
    if (!section.joinCode) return;
    try {
      await navigator.clipboard.writeText(section.joinCode);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { toast({ type: "error", title: "Copy failed", message: "Copy the code manually." }); }
  }

  async function startVote(targetPublic) {
    setVoteLoading(true);
    try {
      const r = await initiateIntakeVote(intake.id, targetPublic);
      if (!r.ok) { toast({ type: "error", title: "Couldn't start vote", message: r.error }); return; }
      toast({ type: "success", title: "Vote started", message: "All CRs in this intake can now cast their ballot." });
    } finally { setVoteLoading(false); }
  }

  async function castVote(inFavor) {
    setVoteLoading(true);
    try {
      const r = await castIntakeVote(vote.id, inFavor);
      if (!r.ok) { toast({ type: "error", title: "Vote failed", message: r.error }); return; }
      toast({ type: "success", title: "Vote recorded" });
    } finally { setVoteLoading(false); }
  }

  const inFavorCount = ballots.filter((b) => b.inFavor).length;
  const againstCount = ballots.filter((b) => !b.inFavor).length;
  const closesAt = vote ? new Date(vote.closesAt).toLocaleDateString("en-BD", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className="space-y-8">
      {/* Join code */}
      <section>
        <h3 className="mb-3 text-base font-semibold text-ink">Join code</h3>
        <Card className="p-4">
          {section.joinCode ? (
            <div className="flex items-center gap-3">
              <span className="flex-1 rounded-md bg-surface-3 px-4 py-2.5 font-mono text-3xl font-bold tracking-[0.25em] text-ink text-center">{section.joinCode}</span>
              <Button variant="secondary" icon={copied ? "Check" : "Copy"} onClick={copyCode}>{copied ? "Copied!" : "Copy"}</Button>
            </div>
          ) : (
            <p className="text-base text-ink-3">No join code assigned yet — contact admin.</p>
          )}
          <p className="mt-2 text-xs text-ink-3">Share this with students so they can join your section instantly.</p>
        </Card>
      </section>

      {/* Section visibility */}
      <section>
        <h3 className="mb-3 text-base font-semibold text-ink">Section visibility</h3>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-semibold text-ink">{section.isPublic ? "Public" : "Private"}</p>
              <p className="mt-0.5 text-xs text-ink-3">
                {section.isPublic
                  ? "Same-intake students (or whole dept if intake is public) can browse your section's materials."
                  : "Only approved members can see this section's content."}
              </p>
            </div>
            <Button size="sm" variant="secondary" icon={section.isPublic ? "Lock" : "Unlock"} onClick={() => onTogglePublic(!section.isPublic)} disabled={toggleBusy}>
              {section.isPublic ? "Make private" : "Make public"}
            </Button>
          </div>
        </Card>
      </section>

      {/* Intake visibility vote */}
      <section>
        <h3 className="mb-3 text-base font-semibold text-ink">Intake visibility</h3>
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${intake.isPublic ? "bg-success-bg text-success" : "bg-surface-3 text-ink-2"}`}>
              <Icon name={intake.isPublic ? "Globe" : "Lock"} size={10} />
              {intake.isPublic ? "Public intake" : "Private intake"}
            </span>
          </div>
          <p className="text-xs text-ink-3">
            {intake.isPublic
              ? "Students from other intakes in your department can see your sections (when they're public)."
              : "Only same-intake students can see public sections here."}
          </p>

          {vote ? (
            <>
              <p className="text-base font-semibold text-ink">Active vote: make intake {vote.targetPublic ? "public" : "private"}</p>
              <div className="flex gap-4 text-base">
                <span className="text-success font-semibold">{inFavorCount} in favour</span>
                <span className="text-danger font-semibold">{againstCount} against</span>
              </div>
              <p className="text-xs text-ink-3">Closes {closesAt}</p>
              {vote.status !== "open" ? (
                <p className="text-xs text-ink-3">Vote closed · result: <strong>{vote.result ?? "—"}</strong></p>
              ) : myBallot ? (
                <p className="text-xs text-ink-3">Your vote: <strong>{myBallot.inFavor ? "In favour" : "Against"}</strong></p>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" icon="ThumbsDown" onClick={() => castVote(false)} disabled={voteLoading}>Against</Button>
                  <Button size="sm" icon="ThumbsUp" onClick={() => castVote(true)} disabled={voteLoading}>In favour</Button>
                </div>
              )}
            </>
          ) : (
            <div>
              {intake.isPublic
                ? <Button size="sm" variant="secondary" icon="Lock" onClick={() => startVote(false)} disabled={voteLoading}>Vote to make private</Button>
                : <Button size="sm" icon="Globe" onClick={() => startVote(true)} disabled={voteLoading}>Vote to make public</Button>}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

export function StudyHubManage({ sectionId }) {
  const {
    departments, studyIntakes, studySectionById, studyMembers, resolveMySection,
    approveMember, removeMember, setMemberRole, toggleSectionPublic, checkExpiredVotes, dataLoading,
  } = useApp();
  const toast = useToast();
  const [tab, setTab] = React.useState("Members");
  const [actBusy, setActBusy] = React.useState(false);
  const [toggleBusy, setToggleBusy] = React.useState(false);

  const section = studySectionById(sectionId);
  const intake = section && studyIntakes.find((i) => i.id === section.intakeId);
  const dept = intake && departments.find((d) => d.id === intake.deptId);

  React.useEffect(() => { if (intake?.id) checkExpiredVotes(intake.id); }, [intake?.id]); // auto-close expired intake votes on load

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
  const pendingCount = members.filter((m) => m.status === "pending").length;

  async function onAct(kind, m) {
    if (actBusy) return;
    setActBusy(true);
    try {
      let r;
      if (kind === "approve") r = await approveMember(m.id);
      else if (kind === "deny" || kind === "remove") r = await removeMember(m.id);
      else if (kind === "promote") r = await setMemberRole(m.id, "editor");
      else if (kind === "demote") r = await setMemberRole(m.id, "member");
      if (!r || !r.ok) { toast({ type: "error", title: "Couldn't update", message: r?.error }); return; }
      const titles = { approve: "Member approved", deny: "Request denied", remove: "Member removed", promote: "Promoted to editor", demote: "Set to member" };
      toast({ type: "success", title: titles[kind] });
    } catch {
      toast({ type: "error", title: "Couldn't update", message: "Please try again." });
    } finally {
      setActBusy(false);
    }
  }

  async function handleTogglePublic(isPublic) {
    if (toggleBusy) return;
    setToggleBusy(true);
    try {
      const r = await toggleSectionPublic(section.id, isPublic);
      if (!r.ok) { toast({ type: "error", title: "Couldn't update", message: r.error }); return; }
      toast({ type: "success", title: isPublic ? "Section is now public" : "Section is now private" });
    } catch {
      toast({ type: "error", title: "Couldn't update visibility", message: "Please try again." });
    } finally {
      setToggleBusy(false);
    }
  }

  return (
    <AppShell activeKey="study-hub" title="Study Hub">
      <button onClick={() => navigate(`/study-hub/section/${section.id}`)} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
        <Icon name="ArrowLeft" size={16} /> Section {section.number}
      </button>
      <PageHeader title={`Manage Section ${section.number}`} subtitle={`${deptCode(dept.name)} · Intake ${intake.number}`} />
      <div className="mb-5">
        <FilterTabs
          options={["Members", "Settings"]}
          value={tab} onChange={setTab}
          counts={{ Members: pendingCount > 0 ? pendingCount : undefined }}
        />
      </div>
      {tab === "Members" && <MembersTab section={section} members={members} onAct={onAct} actBusy={actBusy} />}
      {tab === "Settings" && <SettingsTab section={section} intake={intake} onTogglePublic={handleTogglePublic} toggleBusy={toggleBusy} />}
    </AppShell>
  );
}
