import React, { useState, useMemo } from "react";
import {
  FileText, FlaskConical, FolderKanban, ListOrdered, Briefcase,
  Sparkles, Search, Plus, Trash2, Check, X, Printer, ArrowLeft,
} from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { Card, Button, Field, Input, Select, Modal, Avatar, useToast } from "../../components/ui.jsx";
import {
  DOC_TYPES, TEMPLATES, TEMPLATE_LABELS, DOC_TYPE_LABELS, DESIGNATIONS,
  hasStyles, buildHtml, fmtDate,
} from "./templates.js";

const DOC_ICON = {
  assignment: FileText, lab_report: FlaskConical, project_report: FolderKanban,
  index_page: ListOrdered, internship_report: Briefcase,
};
const TEMPLATE_DESC = {
  default: "Crest logo · boxed label",
  classic: "Header banner · sharp border",
  premium: "Serif · underlined label",
  minimal: "Serif · crest · ruled label",
  modern: "Serif · rounded box",
};
const today = () => new Date().toISOString().slice(0, 10);

export default function CoverPage() {
  const { currentUser, faculty = [], departments = [] } = useApp();
  const toast = useToast();

  const [docType, setDocType] = useState("assignment");
  const [template, setTemplate] = useState("default");

  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [assignmentNo, setAssignmentNo] = useState("");
  const [experimentDate, setExperimentDate] = useState(today());
  const [experimentName, setExperimentName] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [company, setCompany] = useState("");
  const [duration, setDuration] = useState("");
  const [indexRows, setIndexRows] = useState("15");

  const [studentName, setStudentName] = useState(currentUser?.name || "");
  const [studentId, setStudentId] = useState(currentUser?.studentId || "");
  const [intake, setIntake] = useState(currentUser?.intake || "");
  const [section, setSection] = useState(currentUser?.section || "");
  const [program, setProgram] = useState(currentUser?.program || currentUser?.dept || "");
  const [department, setDepartment] = useState(currentUser?.dept || "");

  const [teacherName, setTeacherName] = useState("");
  const [teacherDesig, setTeacherDesig] = useState("");
  const [teacherDept, setTeacherDept] = useState("");
  const [members, setMembers] = useState([{ name: currentUser?.name || "", id: currentUser?.studentId || "" }]);
  const [dateOfSubmission, setDateOfSubmission] = useState(today());

  const [facultyModal, setFacultyModal] = useState(false);
  const [facultySearch, setFacultySearch] = useState("");

  const needCourse = docType === "assignment" || docType === "lab_report" || docType === "index_page";
  const needTitle = docType === "project_report" || docType === "internship_report";
  const needFaculty = docType !== "index_page";
  const canGenerate = !!(
    studentName.trim() && studentId.trim() &&
    (!needCourse || (courseTitle.trim() && courseCode.trim())) &&
    (!needTitle || reportTitle.trim())
  );

  const deptName = (id) => departments.find((d) => d.id === id)?.name || "";
  const filteredFaculty = facultySearch
    ? faculty.filter((f) =>
        f.name.toLowerCase().includes(facultySearch.toLowerCase()) ||
        deptName(f.departmentId).toLowerCase().includes(facultySearch.toLowerCase()))
    : faculty;

  function selectTeacher(f) {
    setTeacherName(f.name);
    setTeacherDesig(f.designation || "");
    const dn = deptName(f.departmentId).replace(/^Department of\s*/i, "");
    if (dn) { setTeacherDept(dn); if (!department) setDepartment(dn); }
    setFacultyModal(false);
    setFacultySearch("");
  }
  const updateMember = (i, patch) => setMembers((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const addMember = () => setMembers((prev) => [...prev, { name: "", id: "" }]);
  const removeMember = (i) => setMembers((prev) => prev.filter((_, idx) => idx !== i));

  // Assemble the data the template engine expects.
  const data = useMemo(() => {
    const dept = teacherDept.trim() || department.trim() || program.trim() || "N/A";
    const cleanMembers = members.filter((m) => m.name.trim() || m.id.trim());
    return {
      template, docType, docTypeLabel: DOC_TYPE_LABELS[docType],
      courseCode: courseCode.trim(), courseTitle: courseTitle.trim(),
      assignmentNo: assignmentNo.trim(),
      experimentDate: fmtDate(experimentDate), experimentName: experimentName.trim(),
      reportTitle: reportTitle.trim(),
      studentName: studentName.trim(), studentId: studentId.trim(),
      intake: intake.trim(), section: section.trim(),
      program: program.trim() || department.trim() || "N/A",
      dept,
      teacherName: teacherName.trim() || "N/A", teacherDesig: teacherDesig.trim(),
      members: cleanMembers.length ? cleanMembers : [{ name: studentName.trim(), id: studentId.trim() }],
      company: company.trim(), duration: duration.trim(),
      indexRows: parseInt(indexRows, 10) || 15,
      date: fmtDate(dateOfSubmission),
    };
  }, [template, docType, courseCode, courseTitle, assignmentNo, experimentDate, experimentName,
      reportTitle, studentName, studentId, intake, section, program, department,
      teacherName, teacherDesig, teacherDept, members, company, duration, indexRows, dateOfSubmission]);

  const html = useMemo(() => buildHtml(data), [data]);

  function generate() {
    if (!canGenerate) return;
    const w = window.open("", "_blank");
    if (!w) {
      toast({ type: "error", title: "Popup blocked", message: "Allow popups to print the cover page." });
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    // Give the embedded logo a moment to decode before the print dialog.
    setTimeout(() => { try { w.print(); } catch { /* user can print manually */ } }, 400);
  }

  return (
    <AppShell activeKey="cover-page" title="Cover Page Generator">
      <button onClick={() => navigate("/dashboard")} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
        <ArrowLeft size={16} /> Dashboard
      </button>
      <PageHeader title="Cover Page Generator" subtitle="BUBT assignment, lab, project, index & internship cover pages — print or save as PDF." />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,440px)]">
        {/* ---- Form ---- */}
        <div className="space-y-6">
          {/* Doc type */}
          <Card className="p-5">
            <SecLabel>Document type</SecLabel>
            <div className="flex flex-wrap gap-2">
              {DOC_TYPES.map((dt) => {
                const DtIcon = DOC_ICON[dt];
                const a = docType === dt;
                return (
                  <button
                    key={dt}
                    onClick={() => setDocType(dt)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-base font-semibold transition-colors ${
                      a ? "border-teal-600 bg-teal-600 text-white" : "border-brd bg-surface text-ink-2 hover:bg-surface-2"
                    }`}
                  >
                    <DtIcon size={15} /> {DOC_TYPE_LABELS[dt]}
                  </button>
                );
              })}
            </div>

            {/* Template style (assignment & lab only) */}
            {hasStyles(docType) && (
              <>
                <SecLabel className="mt-5">Template style</SecLabel>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TEMPLATES.map((tmpl) => {
                    const a = template === tmpl;
                    return (
                      <button
                        key={tmpl}
                        onClick={() => setTemplate(tmpl)}
                        className={`relative rounded-md border p-3 text-left transition-colors ${
                          a ? "border-teal-600 bg-teal-50 dark:bg-teal-500/15" : "border-brd bg-surface hover:bg-surface-2"
                        }`}
                      >
                        {a && (
                          <span className="absolute right-2 top-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-white">
                            <Check size={11} />
                          </span>
                        )}
                        <p className={`text-base font-semibold ${a ? "text-teal-700 dark:text-teal-300" : "text-ink"}`}>{TEMPLATE_LABELS[tmpl].replace(" Style", "")}</p>
                        <p className="mt-0.5 text-xs text-ink-3">{TEMPLATE_DESC[tmpl]}</p>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          {/* Course / title / details */}
          <Card className="space-y-4 p-5">
            {needCourse && (
              <>
                <SecLabel>Course details</SecLabel>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Course code" htmlFor="cp-cc"><Input id="cp-cc" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder="e.g. CSE 101" /></Field>
                  <Field label="Course title" htmlFor="cp-ct"><Input id="cp-ct" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="e.g. Structured Programming" /></Field>
                </div>
              </>
            )}

            {needTitle && (
              <>
                <SecLabel>{docType === "project_report" ? "Project details" : "Internship details"}</SecLabel>
                <Field label={docType === "project_report" ? "Project title" : "Internship topic"} htmlFor="cp-rt">
                  <Input id="cp-rt" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} placeholder="Title" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Course code (optional)" htmlFor="cp-cc2"><Input id="cp-cc2" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} /></Field>
                  <Field label="Course title (optional)" htmlFor="cp-ct2"><Input id="cp-ct2" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} /></Field>
                </div>
                {docType === "internship_report" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Company / organization (optional)" htmlFor="cp-co"><Input id="cp-co" value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
                    <Field label="Duration (optional)" htmlFor="cp-du"><Input id="cp-du" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 3 months" /></Field>
                  </div>
                )}
              </>
            )}

            {docType === "index_page" && (
              <Field label="Number of rows" htmlFor="cp-ir" hint="1–40">
                <Input id="cp-ir" type="number" value={indexRows} onChange={(e) => setIndexRows(e.target.value)} />
              </Field>
            )}

            {docType === "assignment" && (
              <>
                <SecLabel>Assignment details</SecLabel>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Assignment no" htmlFor="cp-an"><Input id="cp-an" value={assignmentNo} onChange={(e) => setAssignmentNo(e.target.value)} /></Field>
                  <Field label="Topic (optional)" htmlFor="cp-tp"><Input id="cp-tp" value={experimentName} onChange={(e) => setExperimentName(e.target.value)} /></Field>
                </div>
              </>
            )}
            {docType === "lab_report" && (
              <>
                <SecLabel>Lab report details</SecLabel>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Experiment date" htmlFor="cp-ed"><Input id="cp-ed" type="date" value={experimentDate} onChange={(e) => setExperimentDate(e.target.value)} /></Field>
                  <Field label="Experiment no" htmlFor="cp-en"><Input id="cp-en" value={assignmentNo} onChange={(e) => setAssignmentNo(e.target.value)} /></Field>
                </div>
                <Field label="Experiment name" htmlFor="cp-em"><Input id="cp-em" value={experimentName} onChange={(e) => setExperimentName(e.target.value)} /></Field>
              </>
            )}
          </Card>

          {/* Student info */}
          <Card className="space-y-4 p-5">
            <SecLabel>Student information</SecLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Student name" htmlFor="cp-sn" required><Input id="cp-sn" value={studentName} onChange={(e) => setStudentName(e.target.value)} /></Field>
              <Field label="Student ID" htmlFor="cp-si" required><Input id="cp-si" value={studentId} onChange={(e) => setStudentId(e.target.value)} /></Field>
              <Field label="Intake" htmlFor="cp-in"><Input id="cp-in" value={intake} onChange={(e) => setIntake(e.target.value)} /></Field>
              <Field label="Section" htmlFor="cp-se"><Input id="cp-se" value={section} onChange={(e) => setSection(e.target.value)} /></Field>
            </div>
            {docType !== "index_page" && (
              <Field label="Program" htmlFor="cp-pr">
                <Select id="cp-pr" value={program} onChange={(e) => setProgram(e.target.value)}>
                  <option value="">Select program…</option>
                  {program && !departments.some((d) => d.name === program) && <option value={program}>{program}</option>}
                  {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </Select>
              </Field>
            )}
          </Card>

          {/* Group members (project only) */}
          {docType === "project_report" && (
            <Card className="space-y-3 p-5">
              <SecLabel>Group members</SecLabel>
              {members.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={m.name} onChange={(e) => updateMember(i, { name: e.target.value })} placeholder={`Member ${i + 1} name`} className="flex-[1.4]" />
                  <Input value={m.id} onChange={(e) => updateMember(i, { id: e.target.value })} placeholder="ID" className="flex-1" />
                  {members.length > 1 && (
                    <button onClick={() => removeMember(i)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-brd text-ink-3 hover:bg-surface-2 hover:text-danger">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <Button variant="secondary" icon={Plus} onClick={addMember}>Add member</Button>
            </Card>
          )}

          {/* Faculty */}
          {needFaculty && (
            <Card className="space-y-4 p-5">
              <SecLabel>{docType === "internship_report" ? "Supervisor details" : "Faculty details"}</SecLabel>
              <Field label="Teacher name" htmlFor="cp-tn">
                <div className="flex gap-2">
                  <Input id="cp-tn" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="Teacher name" />
                  <Button variant="secondary" icon={Sparkles} onClick={() => setFacultyModal(true)} className="shrink-0">Autofill</Button>
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Department" htmlFor="cp-td"><Input id="cp-td" value={teacherDept} onChange={(e) => setTeacherDept(e.target.value)} /></Field>
                <Field label="Designation" htmlFor="cp-tg">
                  <Select id="cp-tg" value={teacherDesig} onChange={(e) => setTeacherDesig(e.target.value)}>
                    <option value="">Select…</option>
                    {teacherDesig && !DESIGNATIONS.includes(teacherDesig) && <option value={teacherDesig}>{teacherDesig}</option>}
                    {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </Field>
              </div>
            </Card>
          )}

          {/* Date + generate */}
          <Card className="space-y-4 p-5">
            <Field label="Date of submission" htmlFor="cp-ds">
              <Input id="cp-ds" type="date" value={dateOfSubmission} onChange={(e) => setDateOfSubmission(e.target.value)} />
            </Field>
            <Button icon={Printer} full disabled={!canGenerate} onClick={generate}>
              Generate &amp; print
            </Button>
            {!canGenerate && <p className="text-center text-xs text-ink-3">Fill in name, ID{needCourse ? ", course code & title" : ""}{needTitle ? " & title" : ""} to generate.</p>}
          </Card>
        </div>

        {/* ---- Live preview ---- */}
        <div className="hidden lg:block">
          <div className="sticky top-20">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Live preview</p>
            <div className="overflow-hidden rounded-md border border-brd bg-surface-3 shadow-sm" style={{ aspectRatio: "210 / 297" }}>
              <iframe title="Cover page preview" srcDoc={html} className="h-full w-full" style={{ border: 0, transformOrigin: "top left" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Faculty picker */}
      <Modal open={facultyModal} onClose={() => { setFacultyModal(false); setFacultySearch(""); }} title="Select teacher" size="md">
        <div className="mb-3 flex items-center gap-2 rounded-md border border-brd bg-surface-2 px-3">
          <Search size={15} className="text-ink-3" />
          <input
            autoFocus
            value={facultySearch}
            onChange={(e) => setFacultySearch(e.target.value)}
            placeholder="Search name or department…"
            className="h-10 flex-1 bg-transparent text-base text-ink placeholder:text-ink-3 focus:outline-none"
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filteredFaculty.length === 0 ? (
            <p className="py-8 text-center text-base text-ink-3">No teachers found</p>
          ) : (
            filteredFaculty.map((f) => (
              <button
                key={f.id}
                onClick={() => selectTeacher(f)}
                className="flex w-full items-center gap-3 border-b border-brd py-2.5 text-left last:border-0 hover:bg-surface-2"
              >
                <Avatar name={f.name} src={f.photo} size={34} />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-ink">{f.name}</p>
                  <p className="truncate text-xs text-ink-3">
                    {deptName(f.departmentId).replace(/^Department of\s*/i, "")}{f.designation ? ` · ${f.designation}` : ""}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </Modal>
    </AppShell>
  );
}

function SecLabel({ children, className = "" }) {
  return <p className={`text-base font-semibold text-ink ${className}`}>{children}</p>;
}
