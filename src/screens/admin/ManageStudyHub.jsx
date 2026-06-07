import React, { useState } from "react";
import { useApp } from "../../data/store.jsx";
import {
  Card, Button, Modal, Field, Input, Select, Textarea, EmptyState, Loading, useToast, Avatar,
} from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { FilterTabs } from "../../components/FilterTabs.jsx";
import { Icon } from "../../components/Icon.jsx";
import { relativeDate } from "../../lib/helpers.js";

// ============================================================================
// Admin — Study Hub catalogue & CRs
// Admins set up the reference catalogue (intakes → sections) and assign a
// section's class representative (CR). Admins do NOT see section content (RLS).
// ============================================================================

const shortDept = (name = "") => name.replace(/^Department of\s+/i, "");

function AddIntakeModal({ open, onClose, onAdd, deptName }) {
  const toast = useToast();
  const [number, setNumber] = useState("");
  const [years, setYears] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  async function submit(e) {
    if (e) e.preventDefault();
    const n = parseInt(number, 10);
    if (!Number.isInteger(n) || n <= 0) { setErrors({ number: "Enter a valid intake number." }); return; }
    setSaving(true);
    try {
      const r = await onAdd(n, years.trim() || null);
      if (!r.ok) { toast({ type: "error", title: "Couldn't add intake", message: r.error }); return; }
      toast({ type: "success", title: "Intake added", message: `Intake ${n}` });
      setNumber(""); setYears(""); setErrors({}); onClose();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      open={open} onClose={onClose} icon="Plus" tone="blue"
      title="Add an intake"
      description={deptName ? `New intake for ${shortDept(deptName)}.` : ""}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon="Plus" onClick={() => submit()} disabled={saving}>Add intake</Button></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Intake number" htmlFor="ai-num" required error={errors.number} hint="e.g. 51">
          <Input id="ai-num" type="number" min="1" value={number} error={!!errors.number} onChange={(e) => setNumber(e.target.value)} />
        </Field>
        <Field label="Years" htmlFor="ai-years" hint="Optional — e.g. 2023–2024">
          <Input id="ai-years" value={years} onChange={(e) => setYears(e.target.value)} />
        </Field>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

function AddSectionModal({ open, onClose, onAdd, intakeNumber }) {
  const toast = useToast();
  const [number, setNumber] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  async function submit(e) {
    if (e) e.preventDefault();
    const n = parseInt(number, 10);
    if (!Number.isInteger(n) || n <= 0) { setErrors({ number: "Enter a valid section number." }); return; }
    setSaving(true);
    try {
      const r = await onAdd(n);
      if (!r.ok) { toast({ type: "error", title: "Couldn't add section", message: r.error }); return; }
      toast({ type: "success", title: "Section added", message: `Section ${n}` });
      setNumber(""); setErrors({}); onClose();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      open={open} onClose={onClose} icon="Plus" tone="blue"
      title="Add a section"
      description={intakeNumber ? `New section in Intake ${intakeNumber}.` : ""}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon="Plus" onClick={() => submit()} disabled={saving}>Add section</Button></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Section number" htmlFor="as-num" required error={errors.number} hint="e.g. 3">
          <Input id="as-num" type="number" min="1" value={number} error={!!errors.number} onChange={(e) => setNumber(e.target.value)} />
        </Field>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

function AssignCRModal({ section, students, onClose, onAssign }) {
  const toast = useToast();
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);
  const value = pick || (students[0] ? students[0].id : "");
  async function submit() {
    if (!value) return;
    setSaving(true);
    try {
      const r = await onAssign(section.id, value);
      if (!r.ok) { toast({ type: "error", title: "Couldn't assign CR", message: r.error }); return; }
      toast({ type: "success", title: "CR assigned", message: students.find((s) => s.id === value)?.name });
      setPick(""); onClose();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      open={!!section} onClose={onClose} icon="UserPlus" tone="blue"
      title={section ? `Assign CR — Section ${section.number}` : ""}
      description="The CR runs this section: approves members and promotes editors."
      footer={students.length
        ? <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon="UserPlus" onClick={submit} disabled={saving}>Assign CR</Button></>
        : <Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      {students.length ? (
        <Field label="Student" htmlFor="cr-student">
          <Select id="cr-student" value={value} onChange={(e) => setPick(e.target.value)}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}{s.email ? ` · ${s.email}` : ""}</option>)}
          </Select>
        </Field>
      ) : (
        <p className="text-sm text-slate-500">No students found to assign.</p>
      )}
    </Modal>
  );
}

function RejectModal({ req, onClose, onReject }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  React.useEffect(() => { if (!req) setNote(""); }, [req]);
  async function submit() {
    if (saving || !req) return;
    setSaving(true);
    try {
      const r = await onReject(req.id, note);
      if (!r.ok) { toast({ type: "error", title: "Couldn't reject", message: r.error }); return; }
      toast({ type: "success", title: "Request rejected" });
      setNote(""); onClose();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      open={!!req} onClose={onClose} icon="X" tone="red"
      title="Reject section request"
      description={req ? `Section ${req.sectionNumber} — ${req.intakeLabel}` : ""}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="destructive" onClick={submit} disabled={saving}>Reject</Button></>}
    >
      <Field label="Note for student" hint="Optional — explain why.">
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. This section already exists." />
      </Field>
    </Modal>
  );
}

function PendingRequestsTab({ requests, onApprove, onReject, personName }) {
  if (requests.length === 0) {
    return <EmptyState icon="Inbox" title="No pending requests" message="Student requests to create a new section will appear here." />;
  }
  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <Card key={req.id} className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={personName(req.requestedBy)} size={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{personName(req.requestedBy)}</p>
                <p className="truncate text-xs text-slate-500">
                  {req.intakeLabel} · Section {req.sectionNumber}
                </p>
                <p className="text-xs text-slate-400">{relativeDate(req.createdAt)}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="secondary" icon="X" onClick={() => onReject(req)}>Reject</Button>
              <Button size="sm" icon="Check" onClick={() => onApprove(req)}>Approve</Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function SectionAdminCard({ section, crMembers, onAssign, onRemoveCR }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Section {section.number}</p>
        <Button size="sm" variant="secondary" icon="UserPlus" onClick={onAssign}>
          {crMembers.length ? "Add CR" : "Assign CR"}
        </Button>
      </div>
      {crMembers.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500">No CR assigned</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {crMembers.map((cr) => (
            <span key={cr.id} className="inline-flex items-center gap-1 rounded-full bg-teal-50 py-0.5 pl-2 pr-1 text-xs font-medium text-teal-700">
              {cr.name}
              <button
                onClick={() => onRemoveCR(cr)}
                title="Remove CR role"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-teal-500 hover:bg-red-100 hover:text-red-600"
              >
                <Icon name="X" size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function ManageStudyHub() {
  const {
    departments, studyIntakesIn, studySectionsIn, studyMembers, users, studyPersonName,
    addStudyIntake, addStudySection, assignSectionCR, setMemberRole,
    studySectionRequestsAll, approveSectionRequest, rejectSectionRequest, dataLoading,
  } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState("Catalogue");
  const [deptId, setDeptId] = useState("");
  const [intakeId, setIntakeId] = useState("");
  const [showAddIntake, setShowAddIntake] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [assignSection, setAssignSection] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [rejectReq, setRejectReq] = useState(null);

  const activeDeptId = deptId || departments[0]?.id || "";
  const activeDept = departments.find((d) => d.id === activeDeptId);
  const intakes = activeDeptId ? studyIntakesIn(activeDeptId) : [];
  const activeIntakeId = intakeId && intakes.some((i) => i.id === intakeId) ? intakeId : (intakes[0]?.id || "");
  const activeIntake = intakes.find((i) => i.id === activeIntakeId);
  const sections = activeIntakeId ? studySectionsIn(activeIntakeId) : [];
  const students = users.filter((u) => u.role === "Student");
  const pendingRequests = studySectionRequestsAll();

  const crMembersFor = (sectionId) =>
    studyMembers
      .filter((m) => m.sectionId === sectionId && m.role === "cr" && m.status === "approved")
      .map((m) => ({ id: m.id, name: studyPersonName(m.userId) }));

  async function doApprove(req) {
    const r = await approveSectionRequest(req.id);
    if (!r.ok) { toast({ type: "error", title: "Approval failed", message: r.error }); return; }
    toast({
      type: "success",
      title: "Section created",
      message: `Section ${req.sectionNumber} ready. Join code: ${r.joinCode}`,
    });
  }

  async function doRejectReq(reqId, note) {
    return await rejectSectionRequest(reqId, note);
  }

  async function doRemoveCR() {
    const cr = confirmRemove;
    if (!cr) return;
    const r = await setMemberRole(cr.id, "member");
    if (!r.ok) { toast({ type: "error", title: "Couldn't remove CR", message: r.error }); setConfirmRemove(null); return; }
    toast({ type: "success", title: "CR role removed", message: cr.name });
    setConfirmRemove(null);
  }

  if (dataLoading && departments.length === 0) {
    return (
      <AppShell activeKey="studyhub-admin" title="Study Hub">
        <PageHeader title="Study Hub" subtitle="Manage intakes, sections, and class representatives." />
        <Loading />
      </AppShell>
    );
  }

  return (
    <AppShell activeKey="studyhub-admin" title="Study Hub">
      <PageHeader title="Study Hub" subtitle="Manage intakes, sections, CRs, and student section requests." />

      <div className="mb-6">
        <FilterTabs
          options={["Catalogue", "Pending Requests"]}
          value={tab} onChange={setTab}
          counts={{ "Pending Requests": pendingRequests.length > 0 ? pendingRequests.length : undefined }}
        />
      </div>

      {tab === "Pending Requests" && (
        <PendingRequestsTab
          requests={pendingRequests}
          onApprove={doApprove}
          onReject={setRejectReq}
          personName={studyPersonName}
        />
      )}

      {tab === "Catalogue" && (
        <>
          <Card className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label="Department" className="sm:flex-1">
                <Select value={activeDeptId} onChange={(e) => { setDeptId(e.target.value); setIntakeId(""); }}>
                  {departments.map((d) => <option key={d.id} value={d.id}>{shortDept(d.name)}</option>)}
                </Select>
              </Field>
              <Field label="Intake" className="sm:flex-1">
                <Select value={activeIntakeId} onChange={(e) => setIntakeId(e.target.value)} disabled={!intakes.length}>
                  {intakes.length
                    ? intakes.map((i) => <option key={i.id} value={i.id}>Intake {i.number}{i.years ? ` · ${i.years}` : ""}</option>)
                    : <option value="">No intakes yet</option>}
                </Select>
              </Field>
              <Button variant="secondary" icon="Plus" onClick={() => setShowAddIntake(true)} disabled={!activeDeptId}>Add intake</Button>
            </div>
          </Card>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Sections{activeIntake ? ` · Intake ${activeIntake.number}` : ""}
              </h3>
              <Button icon="Plus" onClick={() => setShowAddSection(true)} disabled={!activeIntakeId}>Add section</Button>
            </div>

            {!activeIntakeId ? (
              <EmptyState icon="Users" title="No intake selected" message="Add an intake for this department to start creating sections." />
            ) : sections.length === 0 ? (
              <EmptyState icon="Users" title="No sections yet" message="Add the first section for this intake." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {sections.map((s) => (
                  <SectionAdminCard
                    key={s.id} section={s}
                    crMembers={crMembersFor(s.id)}
                    onAssign={() => setAssignSection(s)}
                    onRemoveCR={setConfirmRemove}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <AddIntakeModal
        open={showAddIntake} onClose={() => setShowAddIntake(false)} deptName={activeDept?.name}
        onAdd={(number, years) => addStudyIntake(activeDeptId, number, years)}
      />
      <AddSectionModal
        open={showAddSection} onClose={() => setShowAddSection(false)} intakeNumber={activeIntake?.number}
        onAdd={(number) => addStudySection(activeIntakeId, number)}
      />
      <AssignCRModal
        section={assignSection} students={students}
        onClose={() => setAssignSection(null)} onAssign={assignSectionCR}
      />
      <RejectModal req={rejectReq} onClose={() => setRejectReq(null)} onReject={doRejectReq} />
      <Modal
        open={!!confirmRemove} onClose={() => setConfirmRemove(null)} icon="UserMinus" tone="red"
        title="Remove CR role?"
        description={confirmRemove ? `${confirmRemove.name} will stay a member, but the section will have no CR until you assign one.` : ""}
        footer={<><Button variant="secondary" onClick={() => setConfirmRemove(null)}>Cancel</Button><Button variant="destructive" onClick={doRemoveCR}>Remove CR</Button></>}
      />
    </AppShell>
  );
}
