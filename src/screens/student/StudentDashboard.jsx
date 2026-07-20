import React from "react";
import { PackageSearch, ArrowRight, CircleDot, Loader, CircleCheck, FileText } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { Card, EmptyState, StatCard, Loading } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { ReportListRow } from "../../components/ReportListRow.jsx";
import { CampusToday } from "../../components/CampusToday.jsx";

export default function StudentDashboard() {
  const { currentUser, reports, dataLoading } = useApp();
  if (!currentUser) return null;
  const mine = reports.filter((r) => r.studentId === currentUser.id);
  const count = (s) => mine.filter((r) => r.status === s).length;
  const recent = [...mine].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 5);

  return (
    <AppShell activeKey="dashboard" title="Dashboard">
      <PageHeader
        title={`Welcome back, ${(currentUser.name ?? "").split(" ")[0] || "there"}`}
        subtitle="Here's what's happening with your campus reports."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="My Open" value={count("Open")} icon={CircleDot} tone="amber" />
        <StatCard label="In Progress" value={count("In Progress")} icon={Loader} tone="blue" />
        <StatCard label="Resolved" value={count("Resolved")} icon={CircleCheck} tone="emerald" />
      </div>

      <div className="mt-6">
        <button
          onClick={() => navigate("/lost-found")}
          className="group flex w-full items-center gap-4 rounded-lg border border-brd bg-surface p-5 text-left shadow-sm transition-colors hover:border-brand hover:bg-brand-50"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-surface-3 text-ink-2">
            <PackageSearch size={22} />
          </span>
          <div className="flex-1">
            <p className="text-base font-bold text-ink">Browse Lost &amp; Found</p>
            <p className="text-xs text-ink-3">Find a lost item or post one you found.</p>
          </div>
          <ArrowRight size={18} className="text-ink-3 group-hover:text-brand" />
        </button>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Recent reports</h3>
          {mine.length > 0 && (
            <Link to="/reports" className="text-base font-semibold text-brand hover:text-brand-700">View all</Link>
          )}
        </div>
        {dataLoading ? (
          <Loading />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No reports yet"
            message="When you report a campus issue, it'll show up here so you can track its progress. Use “Report an Issue” at the top to file one."
          />
        ) : (
          <Card className="divide-y divide-brd overflow-hidden">
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
