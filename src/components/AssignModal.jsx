import React, { useState, useEffect } from "react";
import { UserCheck, Info } from "lucide-react";
import { Modal, Field, Select, Button } from "./ui.jsx";
import { useApp } from "../data/store.jsx";
import { useToast } from "./ui.jsx";

// Quick-assign / reassign modal used by the admin dashboard and All Reports.
export function AssignModal({ report, onClose }) {
  const { staffList = [], assignReport } = useApp();
  const toast = useToast();
  const [staffId, setStaffId] = useState(report ? report.assignedStaffId || "" : "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setStaffId(report ? report.assignedStaffId || "" : "");
  }, [report]);
  if (!report) return null;

  async function doAssign() {
    if (busy) return;
    const name = staffList.find((s) => s.id === staffId)?.name || "the selected staff";
    const was = !!report.assignedStaffId;
    setBusy(true);
    try {
      const res = await assignReport(report.id, staffId);
      if (res && res.ok === false) {
        toast({ type: "error", title: "Couldn't assign", message: res.error });
        return;
      }
      toast({ type: "success", title: was ? "Report reassigned" : "Report assigned", message: `${report.id} → ${name}.` });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!report}
      onClose={onClose}
      icon={UserCheck}
      tone="blue"
      title={report.assignedStaffId ? "Reassign report" : "Assign report"}
      description={`${report.id} · ${report.category} — route this to the right staff member.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy || !staffId || staffId === report.assignedStaffId} onClick={doAssign}>
            {report.assignedStaffId ? "Reassign" : "Assign"}
          </Button>
        </>
      }
    >
      <Field label="Staff member" htmlFor="assign-staff">
        <Select id="assign-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          <option value="">Select a staff member</option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>{s.name} — {s.dept}</option>
          ))}
        </Select>
      </Field>
      {report.status === "Open" && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <Info size={13} className="text-slate-400" /> Assigning moves this report to In Progress.
        </p>
      )}
    </Modal>
  );
}
