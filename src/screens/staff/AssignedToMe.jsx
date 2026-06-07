import React, { useState } from "react";
import { Search, ClipboardCheck, SearchX } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { Card, Button, EmptyState, Loading } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { FilterTabs } from "../../components/FilterTabs.jsx";
import { ReportListRow } from "../../components/ReportListRow.jsx";

export default function AssignedToMe() {
  const { currentUser, reports, dataLoading } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  const mine = reports.filter((r) => r.assignedStaffId === currentUser?.id);
  const statuses = ["All", "Open", "In Progress", "Resolved"];
  const counts = statuses.reduce((acc, s) => {
    acc[s] = s === "All" ? mine.length : mine.filter((r) => r.status === s).length;
    return acc;
  }, {});

  const filtered = mine
    .filter((r) => filter === "All" || r.status === filter)
    .filter((r) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (r.category ?? "").toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q) || (r.building ?? "").toLowerCase().includes(q) || (r.id ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || (b.id ?? "").localeCompare(a.id ?? ""));

  return (
    <AppShell activeKey="assigned" title="Assigned to Me">
      <PageHeader title="Assigned to Me" subtitle="Reports routed to you — open one to advance its status." />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assigned reports…"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          />
        </div>
        <FilterTabs options={statuses} value={filter} onChange={setFilter} counts={counts} />
      </div>

      {dataLoading ? (
        <Loading />
      ) : mine.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing assigned yet" message="When an admin assigns you a report, it'll appear here." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="No matching reports" message="Try a different search or filter." action={<Button variant="secondary" onClick={() => { setQuery(""); setFilter("All"); }}>Clear filters</Button>} />
      ) : (
        <Card className="divide-y divide-slate-200 overflow-hidden">
          {filtered.map((r) => (
            <ReportListRow key={r.id} report={r} onOpen={() => navigate(`/reports/${r.id}`)} />
          ))}
        </Card>
      )}
    </AppShell>
  );
}
