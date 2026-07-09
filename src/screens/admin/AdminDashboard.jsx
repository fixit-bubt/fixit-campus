import React, { useState } from "react";
import { FileText, CircleDot, Loader, CircleCheck, CheckCheck } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { EmptyState, StatCard, Loading } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { ReportsTable } from "../../components/ReportsTable.jsx";
import { AssignModal } from "../../components/AssignModal.jsx";
import { CampusToday } from "../../components/CampusToday.jsx";

export default function AdminDashboard() {
  const { reports, dataLoading } = useApp();
  const count = (s) => reports.filter((r) => r.status === s).length;
  const unassigned = reports
    .filter((r) => r.status === "Open" && !r.assignedStaffId)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const [assignTarget, setAssignTarget] = useState(null);

  return (
    <AppShell activeKey="dashboard" title="Dashboard">
      <PageHeader title="Admin overview" subtitle="Everything happening across campus, at a glance." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total reports" value={reports.length} icon={FileText} tone="slate" />
        <StatCard label="Open" value={count("Open")} icon={CircleDot} tone="amber" />
        <StatCard label="In Progress" value={count("In Progress")} icon={Loader} tone="blue" />
        <StatCard label="Resolved" value={count("Resolved")} icon={CircleCheck} tone="emerald" />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Needs assignment</h3>
            <p className="text-xs text-ink-3">Open reports waiting for a staff member.</p>
          </div>
          <Link to="/admin/reports" className="text-base font-semibold text-brand hover:text-brand-700">All reports</Link>
        </div>
        {dataLoading ? (
          <Loading />
        ) : unassigned.length === 0 ? (
          <EmptyState icon={CheckCheck} title="Nothing waiting" message="Every open report has been assigned." />
        ) : (
          <ReportsTable rows={unassigned} onAssign={setAssignTarget} onOpen={(r) => navigate(`/reports/${r.id}`)} />
        )}
      </div>

      <CampusToday className="mt-8" />

      <AssignModal report={assignTarget} onClose={() => setAssignTarget(null)} />
    </AppShell>
  );
}
