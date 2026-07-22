import React, { useState } from "react";
import { Search, CircleHelp, MapPin, Calendar, Megaphone, ThumbsUp, SearchX } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { Card, Button, EmptyState, StatusBadge, Loading, useToast } from "../../components/ui.jsx";
import { FilterTabs } from "../../components/FilterTabs.jsx";
import { CATEGORY_ICON, fmtDate } from "../../lib/helpers.js";

// One board card. The report carries no reporter identity — the feed is
// anonymous (see migration 0079). The only action is a "Me too" toggle.
function BoardCard({ report, onMeToo, busy }) {
  const CatIcon = CATEGORY_ICON[report.category] || CircleHelp;
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-3 text-ink-3">
          <CatIcon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold text-ink">{report.category}</p>
            <StatusBadge status={report.status} />
          </div>
          <p className="mt-1 line-clamp-3 text-base text-ink-2">{report.description}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1"><MapPin size={13} />{report.building}{report.room ? `, ${report.room}` : ""}</span>
            <span className="inline-flex items-center gap-1"><Calendar size={13} />{fmtDate(report.createdAt)}</span>
            <span className="font-mono">{report.id}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-brd pt-3">
        <span className="text-xs text-ink-3">
          {report.voteCount === 0
            ? "Be the first to say you're affected too."
            : `${report.voteCount} ${report.voteCount === 1 ? "student" : "students"} affected`}
        </span>
        <button
          onClick={onMeToo}
          disabled={busy}
          aria-pressed={report.voted}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-base font-semibold transition-colors disabled:opacity-60 ${
            report.voted
              ? "border-brand bg-brand-50 text-brand-700"
              : "border-brd bg-surface text-ink-2 hover:bg-surface-2"
          }`}
        >
          <ThumbsUp size={16} className={report.voted ? "fill-brand-100" : ""} />
          {report.voted ? "Me too" : "Me too"}
          <span className={`rounded-full px-1.5 text-xs ${report.voted ? "bg-brand-100 text-brand-700" : "bg-surface-3 text-ink-3"}`}>
            {report.voteCount}
          </span>
        </button>
      </div>
    </Card>
  );
}

// The "Campus Board" tab of the Reports hub (src/screens/student/Reports.jsx).
// Panel only — the hub owns the shell, header and "Report an Issue" button.
export function CampusIssuesPanel() {
  const { currentUser, campusIssues, toggleReportVote, dataLoading } = useApp();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [busyId, setBusyId] = useState(null);
  if (!currentUser) return null;

  // Rejected reports never reach the board; the rest of the lifecycle can.
  const statuses = ["All", "Open", "In Progress", "Resolved", "Closed"];
  const counts = statuses.reduce((acc, s) => {
    acc[s] = s === "All" ? campusIssues.length : campusIssues.filter((r) => r.status === s).length;
    return acc;
  }, {});

  // The feed already arrives ordered by vote count then newest — keep that order.
  const filtered = campusIssues
    .filter((r) => filter === "All" || r.status === filter)
    .filter((r) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        (r.category ?? "").toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.building ?? "").toLowerCase().includes(q) ||
        (r.id ?? "").toLowerCase().includes(q)
      );
    });

  async function meToo(r) {
    if (busyId) return;
    setBusyId(r.uuid);
    try {
      const res = await toggleReportVote(r.uuid);
      if (!res.ok) toast({ type: "error", title: "Couldn't update", message: res.error });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search campus issues"
            placeholder="Search issues…"
            className="h-11 w-full rounded-md border border-brd bg-surface pl-9 pr-3 text-base text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <FilterTabs options={statuses} value={filter} onChange={setFilter} counts={counts} />
      </div>

      {dataLoading ? (
        <Loading />
      ) : campusIssues.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campus issues yet"
          message="When students choose to share the issues they report, they'll show up here so you can add a “Me too” instead of reporting the same thing again."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matching issues"
          message="Try a different search term or status filter."
          action={<Button variant="secondary" onClick={() => { setQuery(""); setFilter("All"); }}>Clear filters</Button>}
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map((r) => (
            <BoardCard key={r.uuid} report={r} busy={busyId === r.uuid} onMeToo={() => meToo(r)} />
          ))}
        </div>
      )}
    </>
  );
}
