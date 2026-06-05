import React, { useState } from "react";
import { CirclePlus, Search, CircleHelp, Pencil, Trash2, ArrowRight, MapPin, Calendar, FileText, SearchX } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { Card, Button, Modal, EmptyState, StatusBadge, Loading, useToast } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { FilterTabs } from "../../components/FilterTabs.jsx";
import { CATEGORY_ICON, fmtDate } from "../../lib/helpers.js";

function MyReportCard({ report, onView, onEdit, onDelete }) {
  const editable = report.status === "Open";
  const CatIcon = CATEGORY_ICON[report.category] || CircleHelp;
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <CatIcon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{report.category}</p>
            <StatusBadge status={report.status} />
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{report.description}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1"><MapPin size={13} />{report.building}{report.room ? `, ${report.room}` : ""}</span>
            <span className="inline-flex items-center gap-1"><Calendar size={13} />{fmtDate(report.createdAt)}</span>
            <span className="font-mono">{report.id}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
        {editable && (
          <>
            <Button size="sm" variant="ghost" icon={Pencil} onClick={onEdit}>Edit</Button>
            <Button size="sm" variant="ghost" icon={Trash2} className="text-red-600 hover:bg-red-50" onClick={onDelete}>Delete</Button>
          </>
        )}
        <Button size="sm" variant="secondary" iconRight={ArrowRight} onClick={onView}>View</Button>
      </div>
    </Card>
  );
}

export default function MyReports() {
  const { currentUser, reports, deleteReport, dataLoading } = useApp();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const mine = reports.filter((r) => r.studentId === currentUser.id);
  const statuses = ["All", "Open", "In Progress", "Resolved", "Rejected", "Closed"];
  const counts = statuses.reduce((acc, s) => {
    acc[s] = s === "All" ? mine.length : mine.filter((r) => r.status === s).length;
    return acc;
  }, {});

  const filtered = mine
    .filter((r) => filter === "All" || r.status === filter)
    .filter((r) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        r.category.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.building.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  async function confirmDelete() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await deleteReport(toDelete.id);
      if (res.ok) toast({ type: "success", title: "Report deleted", message: `${toDelete.id} was removed.` });
      else toast({ type: "error", title: "Couldn't delete", message: res.error });
    } finally {
      setBusy(false);
      setToDelete(null);
    }
  }

  return (
    <AppShell activeKey="reports" title="My Reports">
      <PageHeader
        title="My Reports"
        subtitle="Track the campus issues you've reported."
        action={<Button icon={CirclePlus} onClick={() => navigate("/reports/new")}>Report an Issue</Button>}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reports…"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          />
        </div>
        <FilterTabs options={statuses} value={filter} onChange={setFilter} counts={counts} />
      </div>

      {dataLoading ? (
        <Loading />
      ) : mine.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports yet"
          message="When you report a campus issue, it'll show up here so you can track its progress."
          action={<Button icon={CirclePlus} onClick={() => navigate("/reports/new")}>Report an Issue</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matching reports"
          message="Try a different search term or status filter."
          action={<Button variant="secondary" onClick={() => { setQuery(""); setFilter("All"); }}>Clear filters</Button>}
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map((r) => (
            <MyReportCard
              key={r.id}
              report={r}
              onView={() => navigate(`/reports/${r.id}`)}
              onEdit={() => navigate(`/reports/${r.id}/edit`)}
              onDelete={() => setToDelete(r)}
            />
          ))}
        </div>
      )}

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        icon={Trash2}
        tone="red"
        title="Delete this report?"
        description={toDelete ? `${toDelete.id} — ${toDelete.category} will be permanently removed. This can't be undone.` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>Delete report</Button>
          </>
        }
      />
    </AppShell>
  );
}
