import React from "react";
import { ClipboardCheck, Loader, CircleCheck, CheckCheck } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { Card, EmptyState, StatCard, Loading } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { ReportListRow } from "../../components/ReportListRow.jsx";
import { CampusToday } from "../../components/CampusToday.jsx";

export default function StaffDashboard() {
  const { currentUser, reports, dataLoading } = useApp();
  const mine = reports.filter((r) => r.assignedStaffId === currentUser?.id);
  const count = (s) => mine.filter((r) => r.status === s).length;
  const active = mine
    .filter((r) => r.status === "Open" || r.status === "In Progress")
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || (b.id ?? "").localeCompare(a.id ?? ""));
  const recent = active.slice(0, 5);

  return (
    <AppShell activeKey="dashboard" title="Dashboard">
      <PageHeader
        title={`Welcome, ${(currentUser?.name ?? "").split(" ")[0] || "there"}`}
        subtitle={`Your maintenance queue${currentUser?.dept ? ` · ${currentUser.dept}` : ""}.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Assigned to Me" value={mine.length} icon={ClipboardCheck} tone="blue" />
        <StatCard label="In Progress" value={count("In Progress")} icon={Loader} tone="amber" />
        <StatCard label="Resolved by Me" value={count("Resolved")} icon={CircleCheck} tone="emerald" />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Active work</h3>
          {mine.length > 0 && (
            <Link to="/staff/assigned" className="text-sm font-medium text-blue-600 hover:text-blue-700">View all assigned</Link>
          )}
        </div>
        {dataLoading ? (
          <Loading />
        ) : active.length === 0 ? (
          <EmptyState icon={CheckCheck} title="All caught up" message="You have no open or in-progress reports right now." />
        ) : (
          <Card className="divide-y divide-slate-200 overflow-hidden">
            {recent.map((r) => (
              <ReportListRow key={r.id} report={r} onOpen={() => navigate(`/reports/${r.id}`)} />
            ))}
          </Card>
        )}
      </div>

      <CampusToday className="mt-8" />
    </AppShell>
  );
}
