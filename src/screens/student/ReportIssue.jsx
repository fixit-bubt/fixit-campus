import React from "react";
import { ArrowLeft } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { useToast } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { ReportForm } from "./ReportForm.jsx";

export default function ReportIssue() {
  const { createReport } = useApp();
  const toast = useToast();

  async function handleSubmit(form) {
    const res = await createReport(form);
    if (!res.ok) {
      toast({ type: "error", title: "Couldn't submit report", message: res.error });
      return;
    }
    toast({ type: "success", title: "Report submitted", message: `${res.id} is now Open.` });
    navigate(`/reports/${res.id}`);
  }

  return (
    <AppShell activeKey="report-new" title="Report an Issue">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate("/dashboard")} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
          <ArrowLeft size={16} /> Back
        </button>
        <PageHeader title="Report an Issue" subtitle="Tell us what's wrong and where — we'll route it to the right staff." />
        <ReportForm mode="create" onSubmit={handleSubmit} onCancel={() => navigate("/dashboard")} />
      </div>
    </AppShell>
  );
}
