import React, { useState, useEffect } from "react";
import {
  Check, X, ArrowLeft, CircleHelp, MapPin, ImageOff, Play, UserCheck,
  Ban, Lock, Eye, FileQuestion, Trash2, Pencil,
} from "lucide-react";
import { useApp } from "../data/store.jsx";
import { navigate } from "../lib/router.jsx";
import { Card, Button, Select, Modal, Avatar, EmptyState, StatusBadge, Loading, useToast } from "../components/ui.jsx";
import { AppShell } from "../components/AppShell.jsx";
import { CATEGORY_ICON, fmtDate } from "../lib/helpers.js";

function StatusTimeline({ report }) {
  if (!report.timeline?.length) return null;
  const flow = ["Open", "In Progress", "Resolved"];
  const reached = {};
  report.timeline.forEach((t) => { reached[t.status] = t.date; });
  const terminal = report.timeline.find((t) => t.status === "Rejected" || t.status === "Closed");

  let steps = flow.map((status) => ({ status, date: reached[status] || null, done: !!reached[status] }));
  if (terminal) {
    // Rejected/Closed ends the flow — show only the stages actually reached,
    // then the terminal step (don't show In Progress/Resolved as "upcoming").
    steps = steps.filter((s) => s.done);
    steps.push({ status: terminal.status, date: terminal.date, done: true, terminal: true });
  }

  const doneTone = (s) =>
    s === "Resolved" ? "bg-emerald-600" : s === "Rejected" || s === "Closed" ? "bg-red-600" : "bg-blue-600";

  return (
    <ol className="relative space-y-0">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const StepIcon = step.terminal && step.status !== "Resolved" ? X : Check;
        return (
          <li key={step.status + i} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && (
              <span className={`absolute left-[11px] top-6 h-full w-0.5 ${step.done ? "bg-slate-200" : "bg-slate-100"}`} />
            )}
            <span
              className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                step.done ? doneTone(step.status) + " text-white" : "border-2 border-slate-200 bg-white text-slate-300"
              }`}
            >
              {step.done ? <StepIcon size={13} strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-slate-300" />}
            </span>
            <div className="pt-0.5">
              <p className={`text-sm font-medium ${step.done ? "text-slate-900" : "text-slate-400"}`}>{step.status}</p>
              <p className="text-xs text-slate-400">{step.date ? fmtDate(step.date) : "Pending"}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function DetailField({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 text-sm text-slate-700">{children}</div>
    </div>
  );
}

// Role-aware: Student owner (read-only + edit/delete while Open) /
// Staff assigned (advance status) / Admin (assign + reject/close).
export default function ReportDetail({ id }) {
  const { currentUser, reports, setReportStatus, assignReport, deleteReport, userById, staffList, dataLoading } = useApp();
  const toast = useToast();
  const report = reports.find((r) => r.id === id);
  const [assignTo, setAssignTo] = useState("");
  const [confirm, setConfirm] = useState(null); // 'delete' | 'reject' | 'close'
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (report) setAssignTo(report.assignedStaffId || "");
  }, [report?.uuid, report?.assignedStaffId]);

  if (!report) {
    return (
      <AppShell activeKey="" title="Report">
        {dataLoading ? <Loading /> : <EmptyState icon={FileQuestion} title="Report not found" message="This report may have been deleted." action={<Button onClick={() => navigate("/")}>Go back</Button>} />}
      </AppShell>
    );
  }

  const role = currentUser.role;
  const isOwner = report.studentId === currentUser.id;
  const isAssigned = report.assignedStaffId === currentUser.id;
  const staff = report.assignedStaffId ? userById(report.assignedStaffId) : null;
  const reporter = userById(report.studentId);
  const activeKey = role === "Admin" ? "all-reports" : role === "Staff" ? "assigned" : "reports";
  const backPath = role === "Admin" ? "/admin/reports" : role === "Staff" ? "/staff/assigned" : "/reports";
  const CatIcon = CATEGORY_ICON[report.category] || CircleHelp;

  async function setStatus(status) {
    const res = await setReportStatus(id, status);
    if (res.ok) toast({ type: "success", title: `Marked ${status}`, message: `${id} updated.` });
    else toast({ type: "error", title: "Couldn't update status", message: res.error });
  }
  async function assign() {
    if (!assignTo) return;
    const staffName = staffList.find((s) => s.id === assignTo)?.name;
    const wasAssigned = !!report.assignedStaffId;
    const res = await assignReport(id, assignTo);
    if (res.ok) toast({ type: "success", title: wasAssigned ? "Report reassigned" : "Report assigned", message: `Assigned to ${staffName}.` });
    else toast({ type: "error", title: "Couldn't assign", message: res.error });
  }
  async function doConfirm() {
    if (busy) return;
    setBusy(true);
    try {
      if (confirm === "delete") {
        const res = await deleteReport(id);
        if (res.ok) { toast({ type: "success", title: "Report deleted" }); navigate(backPath); }
        else toast({ type: "error", title: "Couldn't delete", message: res.error });
      } else if (confirm === "reject") {
        await setStatus("Rejected");
      } else if (confirm === "close") {
        await setStatus("Closed");
      }
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const canEdit = isOwner && report.status === "Open";
  const ConfirmIcon = confirm === "delete" ? Trash2 : confirm === "reject" ? Ban : Lock;

  return (
    <AppShell activeKey={activeKey} title="Report Detail">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => navigate(backPath)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <CatIcon size={22} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{report.category}</h2>
                <StatusBadge status={report.status} />
              </div>
              <p className="mt-0.5 text-sm text-slate-400">
                <span className="font-mono">{report.id}</span> · reported {fmtDate(report.createdAt)}
              </p>
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={Pencil} onClick={() => navigate(`/reports/${id}/edit`)}>Edit</Button>
              <Button size="sm" variant="secondary" icon={Trash2} className="text-red-600" onClick={() => setConfirm("delete")}>Delete</Button>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: details */}
          <div className="space-y-6 lg:col-span-2">
            <Card className="space-y-5 p-6">
              <DetailField label="Description">
                <p className="leading-relaxed">{report.description}</p>
              </DetailField>
              <div className="grid gap-5 sm:grid-cols-2">
                <DetailField label="Location">
                  <span className="inline-flex items-center gap-1.5"><MapPin size={15} className="text-slate-400" />{report.building}{report.room ? `, ${report.room}` : ""}</span>
                </DetailField>
                <DetailField label="Reported by">
                  <span className="inline-flex items-center gap-2"><Avatar name={reporter?.name || "?"} size={22} />{reporter?.name || "Unknown"}</span>
                </DetailField>
              </div>
              <DetailField label="Photo">
                {report.photo ? (
                  <img src={report.photo} alt="report" className="mt-1 max-h-64 rounded-lg border border-slate-200 object-cover" />
                ) : (
                  <div className="mt-1 flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5"><ImageOff size={15} /> No photo attached</span>
                  </div>
                )}
              </DetailField>
            </Card>

            {/* Staff: advance status */}
            {role === "Staff" && isAssigned && report.status !== "Resolved" && report.status !== "Rejected" && report.status !== "Closed" && (
              <Card className="p-6">
                <h3 className="text-sm font-semibold text-slate-900">Update status</h3>
                <p className="mt-1 text-sm text-slate-500">Move this report forward as you work on it.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {report.status === "Open" && <Button icon={Play} onClick={() => setStatus("In Progress")}>Start work (In Progress)</Button>}
                  {report.status === "In Progress" && <Button icon={Check} onClick={() => setStatus("Resolved")}>Mark Resolved</Button>}
                </div>
              </Card>
            )}

            {/* Admin: assign + reject/close */}
            {role === "Admin" && (
              <Card className="p-6">
                <h3 className="text-sm font-semibold text-slate-900">Admin actions</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">{report.assignedStaffId ? "Reassign to staff" : "Assign to staff"}</label>
                    <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                      <Select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="sm:flex-1">
                        <option value="">Select a staff member</option>
                        {staffList.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.dept}</option>)}
                      </Select>
                      <Button icon={UserCheck} disabled={!assignTo || assignTo === report.assignedStaffId} onClick={assign}>
                        {report.assignedStaffId ? "Reassign" : "Assign"}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    {report.status !== "Rejected" && (
                      <Button variant="secondary" icon={Ban} className="text-red-600" onClick={() => setConfirm("reject")}>Reject</Button>
                    )}
                    {report.status !== "Closed" && (
                      <Button variant="secondary" icon={Lock} onClick={() => setConfirm("close")}>Close</Button>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Student owner: tracking note */}
            {role === "Student" && isOwner && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                <Eye size={16} className="text-slate-400" />
                You're tracking this report. {report.status === "Open" ? "You can edit or delete it while it's still Open." : "It can no longer be edited."}
              </div>
            )}
          </div>

          {/* Right: status timeline + assignment */}
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Status</h3>
              <StatusTimeline report={report} />
            </Card>
            <Card className="p-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Assigned staff</h3>
              {staff ? (
                <div className="flex items-center gap-3">
                  <Avatar name={staff.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{staff.name}</p>
                    <p className="truncate text-xs text-slate-500">{staff.dept || "Staff"}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Not yet assigned.</p>
              )}
            </Card>
          </div>
        </div>
      </div>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        icon={ConfirmIcon}
        tone={confirm === "close" ? "blue" : "red"}
        title={confirm === "delete" ? "Delete this report?" : confirm === "reject" ? "Reject this report?" : "Close this report?"}
        description={
          confirm === "delete"
            ? `${report.id} will be permanently removed. This can't be undone.`
            : confirm === "reject"
            ? `${report.id} will be marked as Rejected and the reporter will see this status.`
            : `${report.id} will be marked as Closed.`
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={busy}>Cancel</Button>
            <Button variant={confirm === "close" ? "primary" : "destructive"} onClick={doConfirm} disabled={busy}>
              {confirm === "delete" ? "Delete" : confirm === "reject" ? "Reject report" : "Close report"}
            </Button>
          </>
        }
      />
    </AppShell>
  );
}
