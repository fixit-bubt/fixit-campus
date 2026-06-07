import React from "react";
import { Icon } from "../../components/Icon.jsx";
import {
  Button, Card, Badge, Field, Input, Textarea, Select,
  EmptyState, Modal, Avatar, Spinner, Loading, useToast,
} from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { FilterTabs } from "../../components/FilterTabs.jsx";
import { AccentTile, SegmentToggle, useTick } from "../../components/featureKit.jsx";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { fmtDate, relativeDate, downloadFile } from "../../lib/helpers.js";

// ============================================================================
// Jobs & Internships  (signature accent: indigo)
// A campus-wide board. Anyone signed in can browse; admins, event organizers,
// and club presidents/VPs can post (mirrors can_create_events / can_post_jobs).
// Listings auto-expire by deadline on the client (no cron) — like Events.
// ============================================================================

const ACCENT = "indigo";

export const JOB_TYPES = [
  { value: "internship", label: "Internship", icon: "GraduationCap" },
  { value: "part_time", label: "Part-time", icon: "Clock" },
  { value: "full_time", label: "Full-time", icon: "Briefcase" },
];
const JOB_TYPE_LABEL = { internship: "Internship", part_time: "Part-time", full_time: "Full-time" };
const JOB_TYPE_TONE = { internship: "indigo", part_time: "sky", full_time: "violet" };

export const WORK_MODES = [
  { value: "onsite", label: "On-site" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
];
const WORK_MODE_LABEL = { onsite: "On-site", remote: "Remote", hybrid: "Hybrid" };

const APPLY_METHODS = [
  { value: "link", label: "Link", icon: "Link" },
  { value: "email", label: "Email", icon: "Mail" },
  { value: "file", label: "PDF circular", icon: "FileText" },
];

export const REPORT_REASONS = [
  { value: "spam", label: "Spam or duplicate" },
  { value: "scam", label: "Scam or fraud" },
  { value: "expired", label: "Position no longer open" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
];

// Today's date in Dhaka (YYYY-MM-DD) — the board's canonical "now" for deadlines,
// so the client agrees with the DB insert policy ((now() at tz 'Asia/Dhaka')::date).
const dhakaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

// Deadline-driven status, computed on every render in Dhaka time (no DB/cron).
export function jobStatus(job) {
  if (job.removed) return "Removed";
  const today = dhakaToday();
  if (!job.deadline) return "Open";
  if (job.deadline < today) return "Expired";
  const days = Math.round(
    (new Date(job.deadline + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000
  );
  if (days <= 3) return "Closing soon";
  return "Open";
}
const STATUS_TONE = { Open: "emerald", "Closing soon": "amber", Expired: "slate", Removed: "red" };

function daysLeftLabel(deadline) {
  if (!deadline) return "";
  const today = dhakaToday();
  const days = Math.round(
    (new Date(deadline + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000
  );
  if (days < 0) return "Closed " + fmtDate(deadline);
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  if (days <= 14) return `Closes in ${days} days`;
  return "Closes " + fmtDate(deadline);
}

// Who shared this listing: the club it was posted on behalf of, else the poster.
// Plain selector (takes clubById) — not a hook, so it's safe to call anywhere.
function sourceLabel(job, clubById) {
  if (job.clubId) {
    const club = clubById?.(job.clubId);
    if (club) return { name: club.name, isClub: true };
  }
  return { name: job.postedByName || "Campus Careers", isClub: false };
}

// ── Type + status chips ──────────────────────────────────────────────────────
function TypeBadge({ type }) {
  return <Badge tone={JOB_TYPE_TONE[type] || "slate"}>{JOB_TYPE_LABEL[type] || type}</Badge>;
}
function StatusPill({ status }) {
  return <Badge tone={STATUS_TONE[status] || "slate"}>{status}</Badge>;
}

// ── Save toggle (bookmark) ───────────────────────────────────────────────────
function SaveButton({ saved, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={saved ? "Saved — tap to remove" : "Save this listing"}
      aria-label={saved ? "Remove from saved" : "Save listing"}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
        saved ? "text-amber-500 hover:bg-amber-50" : "text-slate-300 hover:bg-slate-100 hover:text-slate-400"
      } ${className}`}
    >
      <Icon name="Bookmark" size={16} className={saved ? "fill-amber-400" : ""} />
    </button>
  );
}

// ── Listing card ─────────────────────────────────────────────────────────────
function JobCard({ job, onOpen }) {
  const { clubById, jobBookmarks, toggleJobBookmark } = useApp();
  const toast = useToast();
  const status = jobStatus(job);
  const source = sourceLabel(job, clubById);
  const saved = jobBookmarks.includes(job.uuid);
  const dim = status === "Expired" || status === "Removed";

  async function toggleSave() {
    const r = await toggleJobBookmark(job.uuid);
    if (!r.ok) toast({ type: "error", title: "Couldn't update", message: r.error });
  }

  // A div (not a <button>) so the inner bookmark toggle is valid markup.
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className={`group flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md ${dim ? "opacity-70" : ""}`}
    >
      <div className="flex items-start gap-3">
        <AccentTile icon="Briefcase" tone={ACCENT} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-indigo-700">{job.title}</h3>
          <p className="mt-0.5 truncate text-sm text-slate-500">{job.company}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusPill status={status} />
          <SaveButton saved={saved} onClick={toggleSave} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <TypeBadge type={job.jobType} />
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          <Icon name="MapPin" size={13} className="text-slate-400" /> {job.location}
          <span className="text-slate-300">·</span> {WORK_MODE_LABEL[job.workMode] || job.workMode}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          {source.isClub
            ? <Icon name="UsersRound" size={13} className="text-indigo-500" />
            : <Icon name="ShieldCheck" size={13} className="text-slate-400" />}
          <span className="truncate">{source.name}</span>
        </span>
        <span className={`text-xs font-medium ${status === "Closing soon" ? "text-amber-600" : status === "Expired" ? "text-slate-400" : "text-slate-500"}`}>
          {daysLeftLabel(job.deadline)}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Screen 1 — Browse  (/jobs)
// ============================================================================
export function Jobs() {
  const { jobs, canPostJobs, currentUser, jobBookmarks, dataLoading } = useApp();
  useTick(60000); // re-evaluate "closing soon / expired" as the day rolls over
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState("All");
  const [mode, setMode] = React.useState("All");
  const [tab, setTab] = React.useState("Open");

  // Removed listings never reach students/staff (RLS hides them; this is a
  // second guard for admins, who CAN load them).
  const visible = jobs.filter((j) => !j.removed);
  const counts = { Open: 0, "Closing soon": 0, Expired: 0 };
  visible.forEach((j) => {
    const s = jobStatus(j);
    if (s === "Open") { counts.Open += 1; }
    else if (s === "Closing soon") { counts["Closing soon"] += 1; counts.Open += 1; } // "Open" tab = currently open
    else if (s === "Expired") { counts.Expired += 1; }
  });

  const filtered = visible
    .filter((j) => {
      const s = jobStatus(j);
      if (tab === "Open") return s === "Open" || s === "Closing soon";
      if (tab === "Closing soon") return s === "Closing soon";
      return s === "Expired";
    })
    .filter((j) => type === "All" || j.jobType === type)
    .filter((j) => mode === "All" || j.workMode === mode)
    .filter((j) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (j.title || "").toLowerCase().includes(q)
        || (j.company || "").toLowerCase().includes(q)
        || (j.location || "").toLowerCase().includes(q);
    })
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  return (
    <AppShell activeKey="jobs" title="Jobs & Internships">
      <PageHeader
        title="Jobs & Internships"
        subtitle="Opportunities shared across campus — newest first."
        action={
          <div className="flex gap-2">
            {jobBookmarks.length > 0 && (
              <Button variant="secondary" icon="Bookmark" onClick={() => navigate("/jobs/saved")}>Saved ({jobBookmarks.length})</Button>
            )}
            {currentUser?.role === "Admin" && (
              <Button variant="secondary" icon="ShieldAlert" onClick={() => navigate("/jobs/moderate")}>Moderation</Button>
            )}
            {canPostJobs && <Button icon="Plus" onClick={() => navigate("/jobs/new")}>Post a Job</Button>}
          </div>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Icon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search jobs"
            placeholder="Search title, company, or location…"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <FilterTabs options={["Open", "Closing soon", "Expired"]} value={tab} onChange={setTab} counts={counts} />
          <Select value={type} onChange={(e) => setType(e.target.value)} className="sm:w-40">
            <option value="All">All types</option>
            {JOB_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Select value={mode} onChange={(e) => setMode(e.target.value)} className="sm:w-36">
            <option value="All">All modes</option>
            {WORK_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </div>
      </div>

      {dataLoading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="Briefcase"
          title="No openings posted yet"
          message={canPostJobs ? "Be the first to share an opportunity with campus." : "Check back soon — new opportunities are posted here."}
          action={canPostJobs && <Button icon="Plus" onClick={() => navigate("/jobs/new")}>Post a Job</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="SearchX"
          title={tab === "Expired" ? "No expired listings" : "No matching openings"}
          message="Try a different search, type, or location filter."
          action={<Button variant="secondary" onClick={() => { setQuery(""); setType("All"); setMode("All"); setTab("Open"); }}>Clear filters</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((j) => <JobCard key={j.id} job={j} onOpen={() => navigate(`/jobs/${j.id}`)} />)}
        </div>
      )}
    </AppShell>
  );
}

// ── How to apply ─────────────────────────────────────────────────────────────
function ApplyBlock({ job }) {
  const [downloading, setDownloading] = React.useState(false);
  if (job.applyMethod === "email") {
    return (
      <a
        href={`mailto:${job.applyValue}?subject=${encodeURIComponent("Application — " + job.title)}`}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
      >
        <Icon name="Mail" size={16} /> Apply by email
      </a>
    );
  }
  if (job.applyMethod === "file") {
    return (
      <button
        onClick={async () => { setDownloading(true); await downloadFile(job.applyFileUrl, job.applyFileName || "circular.pdf"); setDownloading(false); }}
        disabled={!job.applyFileUrl || downloading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
      >
        {downloading ? <Spinner size={16} className="border-white/40 border-t-white" /> : <Icon name="Download" size={16} />}
        {job.applyFileName || "Download circular"}
      </button>
    );
  }
  // link
  const href = /^https?:\/\//i.test(job.applyValue || "") ? job.applyValue : `https://${job.applyValue}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
    >
      <Icon name="ExternalLink" size={16} /> Apply online
    </a>
  );
}

// ── Report a listing ─────────────────────────────────────────────────────────
function ReportModal({ job, open, onClose }) {
  const { reportJob } = useApp();
  const toast = useToast();
  const [reason, setReason] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    if (saving || !reason) { if (!reason) toast({ type: "error", title: "Pick a reason" }); return; }
    setSaving(true);
    try {
      const r = await reportJob(job.id, reason, note.trim());
      if (!r.ok) { toast({ type: "error", title: "Couldn't report", message: r.error }); return; }
      onClose();
      toast({ type: "success", title: "Thanks for flagging", message: "An admin will review this listing." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="Flag"
      tone="amber"
      title="Report this listing"
      description="Tell us what's wrong. Reports are private and reviewed by an admin."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>
            {saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Submit report"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Reason" required>
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Select a reason</option>
            {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>
        <Field label="Details" hint="Optional — anything that helps the admin decide.">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What looks off about this listing?" />
        </Field>
      </div>
    </Modal>
  );
}

// ============================================================================
// Screen 2 — Detail  (/jobs/:id)
// ============================================================================
export function JobDetail({ id }) {
  const { jobs, currentUser, userById, clubById, jobBookmarks, toggleJobBookmark, withdrawJob, removeJob, restoreJob, dataLoading } = useApp();
  const toast = useToast();
  useTick(60000);
  const job = jobs.find((j) => j.id === id);
  const [confirmWithdraw, setConfirmWithdraw] = React.useState(false);
  const [reporting, setReporting] = React.useState(false);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [removeReason, setRemoveReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const source = sourceLabel(job || {}, clubById);

  if (!job) {
    return (
      <AppShell activeKey="jobs" title="Listing">
        {dataLoading
          ? <Loading />
          : <EmptyState icon="Briefcase" title="Listing not found" message="This opportunity may have been removed or has expired." action={<Button onClick={() => navigate("/jobs")}>Back to Jobs</Button>} />}
      </AppShell>
    );
  }

  const status = jobStatus(job);
  const isOwner = job.postedById === currentUser?.id;
  const isAdmin = currentUser?.role === "Admin";
  const closed = status === "Expired" || status === "Removed";
  const poster = userById(job.postedById);
  const saved = jobBookmarks.includes(job.uuid);

  async function toggleSave() {
    const r = await toggleJobBookmark(job.uuid);
    if (!r.ok) toast({ type: "error", title: "Couldn't update", message: r.error });
  }
  async function doWithdraw() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await withdrawJob(job.id);
      setConfirmWithdraw(false);
      if (!r.ok) { toast({ type: "error", title: "Couldn't withdraw", message: r.error }); return; }
      toast({ type: "success", title: "Listing withdrawn" });
      navigate("/jobs");
    } finally {
      setBusy(false);
    }
  }
  async function doRemove() {
    if (busy || !removeReason) { if (!removeReason) toast({ type: "error", title: "Add a reason" }); return; }
    setBusy(true);
    try {
      const r = await removeJob(job.id, removeReason);
      setRemoveOpen(false);
      if (!r.ok) { toast({ type: "error", title: "Couldn't remove", message: r.error }); return; }
      toast({ type: "success", title: "Listing removed" });
    } finally {
      setBusy(false);
    }
  }
  async function doRestore() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await restoreJob(job.id);
      if (!r.ok) { toast({ type: "error", title: "Couldn't restore", message: r.error }); return; }
      toast({ type: "success", title: "Listing restored" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell activeKey="jobs" title="Listing">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => navigate("/jobs")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <Icon name="ArrowLeft" size={16} /> Back to Jobs
        </button>

        {job.removed && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <Icon name="ShieldAlert" size={16} className="mt-0.5 shrink-0" />
            {/* Admin removals carry a reason; a poster-withdrawn listing doesn't. */}
            <span>{job.removedReason ? `Removed by an admin — ${job.removedReason}` : "This listing was withdrawn by the poster."}</span>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Main */}
          <div className="lg:col-span-3">
            <div className="flex items-start gap-4">
              <AccentTile icon="Briefcase" tone={ACCENT} size={52} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <TypeBadge type={job.jobType} />
                  <StatusPill status={status} />
                </div>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{job.title}</h2>
                <p className="mt-0.5 text-base text-slate-600">{job.company}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5"><Icon name="MapPin" size={15} className="text-slate-400" /> {job.location} · {WORK_MODE_LABEL[job.workMode]}</span>
              {job.stipend && <span className="inline-flex items-center gap-1.5"><Icon name="Wallet" size={15} className="text-slate-400" /> {job.stipend}</span>}
              <span className="inline-flex items-center gap-1.5"><Icon name="CalendarClock" size={15} className="text-slate-400" /> {daysLeftLabel(job.deadline)}</span>
            </div>

            <section className="mt-6">
              <h3 className="text-sm font-semibold text-slate-900">About this role</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{job.description}</p>
            </section>

            {job.requirements && (
              <section className="mt-6">
                <h3 className="text-sm font-semibold text-slate-900">Requirements</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{job.requirements}</p>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2">
            <Card className="space-y-4 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Shared by</p>
                <div className="mt-2 flex items-center gap-2.5">
                  {source.isClub
                    ? <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"><Icon name="UsersRound" size={18} /></span>
                    : <Avatar name={poster?.name || source.name} size={36} src={poster?.avatar} />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{source.name}</p>
                    <p className="text-xs text-slate-400">Posted {relativeDate(job.createdAt)}</p>
                  </div>
                </div>
              </div>

              {!closed ? (
                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">How to apply</p>
                  <ApplyBlock job={job} />
                  <p className="mt-2 text-center text-xs text-slate-400">Deadline {fmtDate(job.deadline)}</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  <Icon name="CalendarX" size={16} className="text-slate-400" />
                  {status === "Removed" ? "This listing is no longer available." : "Applications are closed."}
                </div>
              )}

              {/* Save / unsave */}
              <div className="border-t border-slate-100 pt-4">
                <button
                  onClick={toggleSave}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    saved ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon name="Bookmark" size={16} className={saved ? "fill-amber-400" : ""} /> {saved ? "Saved" : "Save listing"}
                </button>
              </div>

              {/* Owner / admin / report actions */}
              <div className="border-t border-slate-100 pt-4">
                {isOwner ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" icon="Pencil" onClick={() => navigate(`/jobs/${id}/edit`)}>Edit</Button>
                    {!job.removed && <Button variant="secondary" icon="Archive" className="text-red-600" onClick={() => setConfirmWithdraw(true)}>Withdraw</Button>}
                  </div>
                ) : isAdmin ? (
                  <div className="flex flex-wrap gap-2">
                    {job.removed
                      ? <Button variant="secondary" icon="RotateCcw" onClick={doRestore} disabled={busy}>Restore</Button>
                      : <Button variant="destructive" icon="ShieldAlert" onClick={() => setRemoveOpen(true)}>Remove</Button>}
                  </div>
                ) : (
                  <button onClick={() => setReporting(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-red-600">
                    <Icon name="Flag" size={15} /> Report this listing
                  </button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Withdraw confirm */}
      <Modal
        open={confirmWithdraw}
        onClose={() => setConfirmWithdraw(false)}
        icon="Archive"
        tone="red"
        title="Withdraw this listing?"
        description={`"${job.title}" will be removed from the board. This can't be undone.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmWithdraw(false)}>Cancel</Button>
            <Button variant="destructive" onClick={doWithdraw} disabled={busy}>
              {busy ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Withdraw"}
            </Button>
          </>
        }
      />

      {/* Admin remove (with reason) */}
      <Modal
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        icon="ShieldAlert"
        tone="red"
        title="Remove this listing"
        description="The poster is notified that an admin removed it. Give a short reason."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoveOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={doRemove} disabled={busy}>
              {busy ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Remove listing"}
            </Button>
          </>
        }
      >
        <Field label="Reason" required>
          <Select value={removeReason} onChange={(e) => setRemoveReason(e.target.value)}>
            <option value="">Select a reason</option>
            {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>
      </Modal>

      <ReportModal job={job} open={reporting} onClose={() => setReporting(false)} />
    </AppShell>
  );
}

// ============================================================================
// Screen 3 — Post / Edit form  (/jobs/new  &  /jobs/:id/edit)
// ============================================================================
// Wrapper: gate access, and on edit wait for the listing to load (so a deep
// link never seeds a blank form that Save would write back) and bounce a
// non-owner before the editor mounts.
export function JobForm({ id }) {
  const { jobs, currentUser, canPostJobs, dataLoading } = useApp();
  const editing = !!id;
  const existing = editing ? jobs.find((j) => j.id === id) : null;
  const denied = editing && existing && existing.postedById !== currentUser?.id;

  // Wait for the parallel load before deciding — canPostJobs depends on
  // clubMembers/eventOrganizers, which arrive async on a deep link, so we must
  // not bounce a valid poster mid-load.
  React.useEffect(() => {
    if (dataLoading) return;
    if (!canPostJobs) { navigate("/jobs"); return; }
    if (denied) navigate(`/jobs/${id}`);
  }, [dataLoading, canPostJobs, denied, id]);

  if (dataLoading) {
    return <AppShell activeKey="jobs" title={editing ? "Edit Listing" : "Post a Job"}><Loading /></AppShell>;
  }
  if (!canPostJobs || denied) return null;
  if (editing && !existing) {
    return (
      <AppShell activeKey="jobs" title="Edit Listing">
        <EmptyState icon="Briefcase" title="Listing not found" message="This opportunity may have been removed." action={<Button onClick={() => navigate("/jobs")}>Back to Jobs</Button>} />
      </AppShell>
    );
  }
  return <JobEditor id={id} existing={existing} />;
}

function JobEditor({ id, existing }) {
  const { addJob, updateJob, clubs, userRoleIn } = useApp();
  const toast = useToast();
  const editing = !!id;

  // Clubs the user runs (president/VP) — they may post on the club's behalf.
  const officerClubs = clubs.filter((c) => ["president", "vp"].includes(userRoleIn(c.id)));

  const [form, setForm] = React.useState(
    existing
      ? {
          title: existing.title, company: existing.company, jobType: existing.jobType,
          workMode: existing.workMode, location: existing.location, stipend: existing.stipend || "",
          deadline: existing.deadline, requirements: existing.requirements || "", description: existing.description,
          clubId: existing.clubId || "", applyMethod: existing.applyMethod,
          applyValue: existing.applyValue || "",
          applyFile: null, applyFileName: existing.applyFileName || "",
        }
      : {
          title: "", company: "", jobType: "internship", workMode: "onsite", location: "",
          stipend: "", deadline: "", requirements: "", description: "",
          clubId: "", applyMethod: "link", applyValue: "", applyFile: null, applyFileName: "",
        }
  );
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function validate() {
    const er = {};
    if (!form.title.trim()) er.title = "Give the role a title.";
    if (!form.company.trim()) er.company = "Add the company or organization.";
    if (!form.location.trim()) er.location = "Where is it based?";
    if (!form.description.trim()) er.description = "Describe the role.";
    if (!form.deadline) er.deadline = "Set an application deadline.";
    else if (form.deadline < dhakaToday() && (!editing || form.deadline !== existing?.deadline)) er.deadline = "Deadline can't be in the past.";
    if (form.applyMethod === "link" && !form.applyValue.trim()) er.applyValue = "Add the application link.";
    if (form.applyMethod === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.applyValue.trim())) er.applyValue = "Add a valid email address.";
    if (form.applyMethod === "file" && !form.applyFile && !form.applyFileName) er.applyFile = "Upload the circular (PDF).";
    return er;
  }

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    const er = validate();
    setErrors(er);
    if (Object.keys(er).length) { toast({ type: "error", title: "Check the form", message: "A few fields need attention." }); return; }
    setSaving(true);
    try {
      const data = {
        title: form.title.trim(), company: form.company.trim(), jobType: form.jobType,
        workMode: form.workMode, location: form.location.trim(), stipend: form.stipend.trim(),
        deadline: form.deadline, requirements: form.requirements.trim(), description: form.description.trim(),
        clubId: form.clubId || null, applyMethod: form.applyMethod,
        applyValue: form.applyMethod === "file" ? null : form.applyValue.trim(),
        applyFile: form.applyFile, applyFileName: form.applyFileName,
      };
      const res = editing ? await updateJob(id, data) : await addJob(data);
      if (!res.ok) { toast({ type: "error", title: editing ? "Couldn't update" : "Couldn't post", message: res.error }); return; }
      if (editing) { toast({ type: "success", title: "Listing updated" }); navigate(`/jobs/${id}`); }
      else { toast({ type: "success", title: "Listing posted", message: "It's now live on the board." }); navigate(`/jobs/${res.id}`); }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell activeKey="jobs" title={editing ? "Edit Listing" : "Post a Job"}>
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate(editing ? `/jobs/${id}` : "/jobs")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <Icon name="ArrowLeft" size={16} /> Back
        </button>
        <PageHeader title={editing ? "Edit Listing" : "Post a Job"} subtitle="Share an opportunity with the whole campus." />

        <form onSubmit={submit} className="space-y-6">
          <Card className="space-y-5 p-6">
            <Field label="Job title" htmlFor="jb-title" required error={errors.title}>
              <Input id="jb-title" placeholder="e.g. Frontend Developer Intern" value={form.title} error={!!errors.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Company / organization" htmlFor="jb-company" required error={errors.company}>
              <Input id="jb-company" placeholder="e.g. Brain Station 23" value={form.company} error={!!errors.company} onChange={(e) => set("company", e.target.value)} />
            </Field>

            <Field label="Type" required>
              <SegmentToggle options={JOB_TYPES} value={form.jobType} onChange={(v) => set("jobType", v)} />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Location" htmlFor="jb-loc" required error={errors.location}>
                <Input id="jb-loc" placeholder="e.g. Dhaka or On-campus" value={form.location} error={!!errors.location} onChange={(e) => set("location", e.target.value)} />
              </Field>
              <Field label="Work mode" required>
                <Select value={form.workMode} onChange={(e) => set("workMode", e.target.value)}>
                  {WORK_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Stipend / salary" htmlFor="jb-stipend" hint="Optional — e.g. ৳10,000/mo or Unpaid.">
                <Input id="jb-stipend" placeholder="e.g. ৳15,000 / month" value={form.stipend} onChange={(e) => set("stipend", e.target.value)} />
              </Field>
              <Field label="Application deadline" htmlFor="jb-deadline" required error={errors.deadline}>
                <Input id="jb-deadline" type="date" min={dhakaToday()} value={form.deadline} error={!!errors.deadline} onChange={(e) => set("deadline", e.target.value)} />
              </Field>
            </div>

            {officerClubs.length > 0 && (
              <Field label="Post on behalf of" htmlFor="jb-club" hint="Shows a club badge on the listing.">
                <Select id="jb-club" value={form.clubId} onChange={(e) => set("clubId", e.target.value)}>
                  <option value="">Just me / Campus Careers</option>
                  {officerClubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            )}

            <Field label="Description" htmlFor="jb-desc" required error={errors.description}>
              <Textarea id="jb-desc" rows={5} placeholder="Responsibilities, what the role involves, who it's for…" value={form.description} error={!!errors.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Field label="Requirements" htmlFor="jb-req" hint="Optional — year, CGPA, skills.">
              <Textarea id="jb-req" rows={3} placeholder="e.g. 3rd/4th year · CGPA 3.0+ · React, Git" value={form.requirements} onChange={(e) => set("requirements", e.target.value)} />
            </Field>
          </Card>

          <Card className="space-y-5 p-6">
            <div>
              <p className="text-sm font-medium text-slate-700">How should students apply?</p>
              <p className="mt-0.5 text-xs text-slate-400">Pick one — an external link, an email address, or an uploaded circular.</p>
            </div>
            <SegmentToggle options={APPLY_METHODS} value={form.applyMethod} onChange={(v) => set("applyMethod", v)} />

            {form.applyMethod === "link" && (
              <Field label="Application link" htmlFor="jb-link" required error={errors.applyValue}>
                <Input id="jb-link" placeholder="https://…" value={form.applyValue} error={!!errors.applyValue} onChange={(e) => set("applyValue", e.target.value)} />
              </Field>
            )}
            {form.applyMethod === "email" && (
              <Field label="Application email" htmlFor="jb-email" required error={errors.applyValue}>
                <Input id="jb-email" type="email" placeholder="careers@company.com" value={form.applyValue} error={!!errors.applyValue} onChange={(e) => set("applyValue", e.target.value)} />
              </Field>
            )}
            {form.applyMethod === "file" && (
              <Field label="Circular (PDF)" required error={errors.applyFile}>
                <div className="flex flex-col gap-2">
                  {form.applyFileName && (
                    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <Icon name="FileText" size={14} className="text-slate-400" />
                      <span className="flex-1 truncate text-sm text-slate-600">{form.applyFileName}</span>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, applyFile: null, applyFileName: "" }))} className="text-slate-300 hover:text-slate-500"><Icon name="X" size={14} /></button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.type !== "application/pdf") { toast({ type: "error", title: "PDF only", message: "Please upload a PDF circular." }); return; }
                      if (file.size > 5 * 1024 * 1024) { toast({ type: "error", title: "Too large", message: "Keep the PDF under 5 MB." }); return; }
                      setForm((f) => ({ ...f, applyFile: file, applyFileName: file.name }));
                    }}
                    className="text-sm text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>
              </Field>
            )}
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate(editing ? `/jobs/${id}` : "/jobs")}>Cancel</Button>
            <Button type="submit" icon={editing ? "Check" : "Plus"} disabled={saving}>
              {saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : editing ? "Save changes" : "Post job"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

// ============================================================================
// Screen 4 — Admin moderation  (/jobs/moderate)
// ============================================================================
export function ModerateJobs() {
  const { jobs, jobReports, userById, clubById, removeJob, restoreJob, dataLoading } = useApp();
  const toast = useToast();
  const [removeTarget, setRemoveTarget] = React.useState(null);
  const [removeReason, setRemoveReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Listings with at least one report, most-reported first — the review queue.
  const reported = jobs
    .filter((j) => !j.removed && (j.reportCount || 0) > 0)
    .sort((a, b) => (b.reportCount || 0) - (a.reportCount || 0));
  const removed = jobs.filter((j) => j.removed).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const reportsFor = (jobUuid) => (jobReports || []).filter((r) => r.jobId === jobUuid);

  async function doRemove() {
    if (busy || !removeReason) { if (!removeReason) toast({ type: "error", title: "Add a reason" }); return; }
    setBusy(true);
    try {
      const r = await removeJob(removeTarget.id, removeReason);
      setRemoveTarget(null); setRemoveReason("");
      if (!r.ok) { toast({ type: "error", title: "Couldn't remove", message: r.error }); return; }
      toast({ type: "success", title: "Listing removed" });
    } finally {
      setBusy(false);
    }
  }
  async function doRestore(job) {
    const r = await restoreJob(job.id);
    if (!r.ok) { toast({ type: "error", title: "Couldn't restore", message: r.error }); return; }
    toast({ type: "success", title: "Listing restored" });
  }

  const reasonLabel = (v) => REPORT_REASONS.find((r) => r.value === v)?.label || v;

  return (
    <AppShell activeKey="jobs" title="Moderation">
      <PageHeader
        title="Job Moderation"
        subtitle="Review reported listings and remove anything that breaks the rules."
        action={<Button variant="secondary" icon="ArrowLeft" onClick={() => navigate("/jobs")}>Back to Jobs</Button>}
      />

      {dataLoading ? (
        <Loading />
      ) : (
        <div className="space-y-8">
          {/* Reported queue */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Icon name="Flag" size={15} className="text-amber-500" /> Reported ({reported.length})
            </h3>
            {reported.length === 0 ? (
              <EmptyState icon="ShieldCheck" title="Nothing reported" message="No listings are awaiting review." />
            ) : (
              <div className="space-y-3">
                {reported.map((job) => {
                  const reps = reportsFor(job.uuid);
                  const source = job.clubId ? clubById(job.clubId)?.name : job.postedByName;
                  return (
                    <Card key={job.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <button onClick={() => navigate(`/jobs/${job.id}`)} className="text-left text-sm font-semibold text-slate-900 hover:text-indigo-700">{job.title}</button>
                          <p className="mt-0.5 text-xs text-slate-500">{job.company} · {source || "Campus Careers"} · posted {relativeDate(job.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone="amber" icon="Flag">{job.reportCount} report{job.reportCount === 1 ? "" : "s"}</Badge>
                          <Button size="sm" variant="destructive" icon="ShieldAlert" onClick={() => setRemoveTarget(job)}>Remove</Button>
                        </div>
                      </div>
                      {reps.length > 0 && (
                        <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                          {reps.map((r) => (
                            <li key={r.id} className="flex items-start gap-2 text-xs text-slate-500">
                              <Icon name="CornerDownRight" size={13} className="mt-0.5 shrink-0 text-slate-300" />
                              <span><span className="font-medium text-slate-700">{reasonLabel(r.reason)}</span>{r.note ? ` — ${r.note}` : ""} <span className="text-slate-400">· {userById(r.reporterId)?.name || "A student"}</span></span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Removed */}
          {removed.length > 0 && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Icon name="Archive" size={15} className="text-slate-400" /> Removed ({removed.length})
              </h3>
              <div className="space-y-3">
                {removed.map((job) => (
                  <Card key={job.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">{job.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{job.company}{job.removedReason ? ` · removed: ${job.removedReason}` : ""}</p>
                    </div>
                    <Button size="sm" variant="secondary" icon="RotateCcw" onClick={() => doRestore(job)}>Restore</Button>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Remove confirm (with reason) */}
      <Modal
        open={!!removeTarget}
        onClose={() => { setRemoveTarget(null); setRemoveReason(""); }}
        icon="ShieldAlert"
        tone="red"
        title="Remove this listing"
        description={removeTarget ? `"${removeTarget.title}" will be hidden from the board.` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setRemoveTarget(null); setRemoveReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={doRemove} disabled={busy}>
              {busy ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Remove listing"}
            </Button>
          </>
        }
      >
        <Field label="Reason" required>
          <Select value={removeReason} onChange={(e) => setRemoveReason(e.target.value)}>
            <option value="">Select a reason</option>
            {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>
      </Modal>
    </AppShell>
  );
}

// ============================================================================
// Screen 5 — Saved listings  (/jobs/saved)  + the in-app deadline reminder
// ============================================================================
export function SavedJobs() {
  const { jobs, jobBookmarks, dataLoading } = useApp();
  useTick(60000);
  const saved = jobs
    .filter((j) => !j.removed && jobBookmarks.includes(j.uuid))
    .sort((a, b) => (a.deadline || "").localeCompare(b.deadline || "")); // soonest deadline first
  const closingSoon = saved.filter((j) => jobStatus(j) === "Closing soon");

  return (
    <AppShell activeKey="jobs" title="Saved Jobs">
      <div className="mx-auto max-w-5xl">
        <button onClick={() => navigate("/jobs")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <Icon name="ArrowLeft" size={16} /> Back to Jobs
        </button>
        <PageHeader title="Saved Jobs" subtitle="Listings you've bookmarked — your shortlist, soonest deadline first." />

        {closingSoon.length > 0 && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Icon name="BellRing" size={16} className="mt-0.5 shrink-0 text-amber-500" />
            <span><strong>{closingSoon.length}</strong> of your saved {closingSoon.length === 1 ? "listing closes" : "listings close"} within 3 days — apply before the deadline passes.</span>
          </div>
        )}

        {dataLoading && jobs.length === 0 ? (
          <Loading />
        ) : saved.length === 0 ? (
          <EmptyState
            icon="Bookmark"
            title="No saved listings yet"
            message="Tap the bookmark on any listing to add it to your shortlist."
            action={<Button icon="Briefcase" onClick={() => navigate("/jobs")}>Browse jobs</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((j) => <JobCard key={j.id} job={j} onOpen={() => navigate(`/jobs/${j.id}`)} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ============================================================================
// Dashboard widget (Campus Today) — surfaces open count, or an amber nudge when
// the user has saved listings closing soon (the in-app deadline reminder).
// ============================================================================
export function JobsWidget() {
  const { jobs, jobBookmarks } = useApp();
  const active = jobs.filter((j) => !j.removed);
  const openCount = active.filter((j) => { const s = jobStatus(j); return s === "Open" || s === "Closing soon"; }).length;
  const savedClosing = active.filter((j) => jobBookmarks.includes(j.uuid) && jobStatus(j) === "Closing soon").length;

  return (
    <button
      onClick={() => navigate(savedClosing > 0 ? "/jobs/saved" : "/jobs")}
      className="group flex w-full items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
    >
      <AccentTile icon="Briefcase" tone={ACCENT} size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">Jobs &amp; Internships</p>
        {savedClosing > 0 ? (
          <p className="truncate text-xs font-medium text-amber-600">{savedClosing} saved {savedClosing === 1 ? "listing closes" : "listings close"} soon — apply now</p>
        ) : (
          <p className="truncate text-xs text-slate-500">{openCount} open opportunit{openCount === 1 ? "y" : "ies"} right now</p>
        )}
      </div>
      <Icon name="ArrowRight" size={18} className="text-slate-300 group-hover:text-indigo-500" />
    </button>
  );
}
