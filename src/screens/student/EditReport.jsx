import React, { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { useToast } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { ReportForm } from "./ReportForm.jsx";

// Reachable only while a report's status is still "Open".
export default function EditReport({ id }) {
  const { currentUser, reports, setReports } = useApp();
  const toast = useToast();
  const report = reports.find((r) => r.id === id);

  useEffect(() => {
    if (!report) {
      navigate("/reports");
      return;
    }
    if (report.studentId !== currentUser.id || report.status !== "Open") {
      navigate(`/reports/${id}`);
    }
  }, [report, id]);

  if (!report || report.studentId !== currentUser.id || report.status !== "Open") return null;

  function handleSubmit(form) {
    setReports((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r,
              category: form.category,
              description: form.description.trim(),
              building: form.building.trim(),
              room: form.room.trim(),
              photo: form.photo || null,
            }
          : r
      )
    );
    toast({ type: "success", title: "Report updated", message: `${id} has been saved.` });
    navigate(`/reports/${id}`);
  }

  return (
    <AppShell activeKey="reports" title="Edit Report">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate(`/reports/${id}`)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} /> Back to report
        </button>
        <PageHeader title="Edit Report" subtitle={`Editing ${id} · you can edit while it's still Open.`} />
        <ReportForm
          mode="edit"
          initial={{ category: report.category, description: report.description, building: report.building, room: report.room, photo: report.photo }}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/reports/${id}`)}
        />
      </div>
    </AppShell>
  );
}
