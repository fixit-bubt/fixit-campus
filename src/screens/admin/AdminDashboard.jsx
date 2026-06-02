import React, { useState } from "react";
import { FileText, CircleDot, Loader, CircleCheck, CheckCheck } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { EmptyState, StatCard } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { ReportsTable } from "../../components/ReportsTable.jsx";
import { AssignModal } from "../../components/AssignModal.jsx";

export default function AdminDashboard() {
  const { reports } = useApp();
  const count = (s) => reports.filter((r) => r.status === s).length;
  const unassigned = reports
    .filter((r) => r.status === "Open" && !r.assignedStaffId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
            <h3 className="text-sm font-semibold text-slate-900">Needs assignment</h3>
            <p className="text-xs text-slate-500">Open reports waiting for a staff member.</p>
          </div>
          <Link to="/admin/reports" className="text-sm font-medium text-blue-600 hover:text-blue-700">All reports</Link>
        </div>
        {unassigned.length === 0 ? (
          <EmptyState icon={CheckCheck} title="Nothing waiting" message="Every open report has been assigned." />
        ) : (
          <ReportsTable rows={unassigned} onAssign={setAssignTarget} onOpen={(r) => navigate(`/reports/${r.id}`)} />
        )}
      </div>

      <AssignModal report={assignTarget} onClose={() => setAssignTarget(null)} />
    </AppShell>
  );
}
