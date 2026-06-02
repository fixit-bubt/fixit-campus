import React from "react";
import { ArrowLeft } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { useToast } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { ReportForm } from "./ReportForm.jsx";
import { todayISO } from "../../lib/helpers.js";

export default function ReportIssue() {
  const { currentUser, reports, setReports } = useApp();
  const toast = useToast();

  function handleSubmit(form) {
    const id = "R-" + (1043 + reports.length);
    const today = todayISO();
    const newReport = {
      id,
      category: form.category,
      description: form.description.trim(),
      building: form.building.trim(),
      room: form.room.trim(),
      photo: form.photo || null,
      status: "Open",
      studentId: currentUser.id,
      assignedStaffId: null,
      createdAt: today,
      timeline: [{ status: "Open", date: today }],
    };
    setReports((rs) => [newReport, ...rs]);
    toast({ type: "success", title: "Report submitted", message: `${id} is now Open.` });
    navigate(`/reports/${id}`);
  }

  return (
    <AppShell activeKey="report-new" title="Report an Issue">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate("/dashboard")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} /> Back
        </button>
        <PageHeader title="Report an Issue" subtitle="Tell us what's wrong and where — we'll route it to the right staff." />
        <ReportForm mode="create" onSubmit={handleSubmit} onCancel={() => navigate("/dashboard")} />
      </div>
    </AppShell>
  );
}
