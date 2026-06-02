import React, { useState } from "react";
import { Search, SearchX } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { Button, Select, EmptyState } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { ReportsTable } from "../../components/ReportsTable.jsx";
import { AssignModal } from "../../components/AssignModal.jsx";
import { CATEGORIES } from "../../lib/helpers.js";

export default function AllReports() {
  const { reports } = useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [assignTarget, setAssignTarget] = useState(null);

  const statuses = ["All", "Open", "In Progress", "Resolved", "Rejected", "Closed"];

  const filtered = reports
    .filter((r) => status === "All" || r.status === status)
    .filter((r) => category === "All" || r.category === category)
    .filter((r) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return r.category.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.building.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <AppShell activeKey="all-reports" title="All Reports">
      <PageHeader title="All Reports" subtitle={`${reports.length} reports across campus.`} />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all reports…"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
            {statuses.map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-48">
            <option value="All">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="No matching reports" message="Try different filters." action={<Button variant="secondary" onClick={() => { setQuery(""); setStatus("All"); setCategory("All"); }}>Clear filters</Button>} />
      ) : (
        <ReportsTable rows={filtered} onAssign={setAssignTarget} onOpen={(r) => navigate(`/reports/${r.id}`)} />
      )}

      <AssignModal report={assignTarget} onClose={() => setAssignTarget(null)} />
    </AppShell>
  );
}
