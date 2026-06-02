import React from "react";
import { CirclePlus, PackageSearch, ArrowRight, CircleDot, Loader, CircleCheck, FileText } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { Card, Button, EmptyState, StatCard } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { ReportListRow } from "../../components/ReportListRow.jsx";

export default function StudentDashboard() {
  const { currentUser, reports } = useApp();
  const mine = reports.filter((r) => r.studentId === currentUser.id);
  const count = (s) => mine.filter((r) => r.status === s).length;
  const recent = [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return (
    <AppShell activeKey="dashboard" title="Dashboard">
      <PageHeader
        title={`Welcome back, ${currentUser.name.split(" ")[0]}`}
        subtitle="Here's what's happening with your campus reports."
        action={<Button icon={CirclePlus} onClick={() => navigate("/reports/new")}>Report an Issue</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="My Open" value={count("Open")} icon={CircleDot} tone="amber" />
        <StatCard label="In Progress" value={count("In Progress")} icon={Loader} tone="blue" />
        <StatCard label="Resolved" value={count("Resolved")} icon={CircleCheck} tone="emerald" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => navigate("/reports/new")}
          className="group flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <CirclePlus size={22} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Report an Issue</p>
            <p className="text-xs text-slate-500">Flag a maintenance problem on campus.</p>
          </div>
          <ArrowRight size={18} className="text-slate-300 group-hover:text-blue-500" />
        </button>
        <button
          onClick={() => navigate("/lost-found")}
          className="group flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <PackageSearch size={22} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Browse Lost &amp; Found</p>
            <p className="text-xs text-slate-500">Find a lost item or post one you found.</p>
          </div>
          <ArrowRight size={18} className="text-slate-300 group-hover:text-blue-500" />
        </button>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Recent reports</h3>
          {mine.length > 0 && (
            <Link to="/reports" className="text-sm font-medium text-blue-600 hover:text-blue-700">View all</Link>
          )}
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No reports yet"
            message="When you report a campus issue, it'll show up here so you can track its progress."
            action={<Button icon={CirclePlus} onClick={() => navigate("/reports/new")}>Report an Issue</Button>}
          />
        ) : (
          <Card className="divide-y divide-slate-200 overflow-hidden">
            {recent.map((r) => (
              <ReportListRow key={r.id} report={r} onOpen={() => navigate(`/reports/${r.id}`)} />
            ))}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
