import React from "react";
import { Icon } from "../../components/Icon.jsx";
import {
  Button, Card, Badge, StatusBadge, Field, Input, Textarea, Select, FileUpload,
  EmptyState, Modal, Avatar, Spinner, Skeleton, StatCard, Loading, useToast,
} from "../../components/ui.jsx";
import { AppShell, PageHeader, ROLE_TONE } from "../../components/AppShell.jsx";
import { FilterTabs } from "../../components/FilterTabs.jsx";
import {
  AccentTile, CountdownBanner, SegmentToggle, RevealContact, SectionTitle,
  taka, phoneFor, fmtTime, fmtCountdown, nextDeparture, toMinutes, minutesToHHMM,
  nowDhakaMinutes, dhakaParts, useTick, useLocalState,
} from "../../components/featureKit.jsx";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { fmtDate, relativeDate, todayISO, downloadFile } from "../../lib/helpers.js";

// ============================================================================
// FEATURE 8 — Announcements  (signature accent: amber)
// Digital notice board: pinned-first list, priority badges, unread dots,
// PDF attachments, detail, admin compose form, dashboard widget.
// ============================================================================

export const DEPARTMENTS = ["Administration", "Examination Controller", "Accounts", "Facilities", "Library", "Student Welfare", "Dept. of CSE"];
export const PRIORITY_TONE = { Urgent: "red", Important: "amber", General: "slate" };
export const PRIORITY_ICON = { Urgent: "TriangleAlert", Important: "AlertCircle", General: "Info" };

export function excerpt(text, n = 120) {
  if (!text) return "";
  return text.length > n ? text.slice(0, n).trimEnd() + "…" : text;
}

// --- Notice card ------------------------------------------------------------
export function NoticeCard({ note, unread, onOpen }) {
  return (
    <button onClick={onOpen} className="group flex w-full items-start gap-4 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50/30">
      {note.image ? (
        <img src={note.image} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover" />
      ) : (
        <AccentTile icon={PRIORITY_ICON[note.priority]} tone={PRIORITY_TONE[note.priority] === "slate" ? "amber" : PRIORITY_TONE[note.priority]} size={40} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {note.pinned && <Badge tone="amber" icon="Pin">Pinned</Badge>}
          <Badge tone={PRIORITY_TONE[note.priority]}>{note.priority}</Badge>
          {note.attachment && <Icon name="Paperclip" size={14} className="text-slate-400" />}
          {unread && <span className="h-2 w-2 rounded-full bg-blue-600" title="Unread"></span>}
        </div>
        <p className={`mt-1.5 text-sm ${unread ? "font-bold" : "font-semibold"} text-slate-900`}>{note.title}</p>
        <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{excerpt(note.body)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1"><Icon name="Building2" size={12} />{note.department}</span>
          <span className="inline-flex items-center gap-1"><Icon name="Calendar" size={12} />{fmtDate(note.date)}</span>
        </div>
      </div>
      <Icon name="ChevronRight" size={16} className="mt-1 hidden text-slate-300 sm:block" />
    </button>
  );
}

// --- Browse -----------------------------------------------------------------
export function Announcements() {
  const { currentUser, announcements, dataLoading } = useApp();
  const [dept, setDept] = React.useState("All");
  const [priority, setPriority] = React.useState("All");
  const canCreate = currentUser.role === "Admin";

  const filtered = announcements
    .filter((a) => dept === "All" || a.department === dept)
    .filter((a) => priority === "All" || a.priority === priority)
    .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || b.date.localeCompare(a.date));

  const unreadCount = announcements.filter((a) => !a.readBy.includes(currentUser.id)).length;

  return (
    <AppShell activeKey="announcements" title="Announcements">
      <PageHeader title="Announcements"
        subtitle={unreadCount > 0 ? `${unreadCount} unread on the campus notice board.` : "Campus notice board — you're all caught up."}
        action={canCreate ? <Button icon="Plus" onClick={() => navigate("/announcements/new")}>Post notice</Button> : null} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs options={["All", "Urgent", "Important", "General"]} value={priority} onChange={setPriority} />
        <Select value={dept} onChange={(e) => setDept(e.target.value)} className="sm:w-56">
          <option value="All">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
      </div>

      {dataLoading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState icon="Megaphone" title="No notices" message="Announcements from campus departments will appear here." />
      ) : (
        <div className="grid gap-3">
          {filtered.map((a) => (
            <NoticeCard key={a.id} note={a} unread={!a.readBy.includes(currentUser.id)} onOpen={() => navigate(`/announcements/${a.id}`)} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

// --- Detail -----------------------------------------------------------------
export function AnnouncementDetail({ id }) {
  const { currentUser, announcements, markAnnouncementRead, deleteAnnouncement } = useApp();
  const toast = useToast();
  const note = announcements.find((a) => a.id === id);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Depend on `note` (not just `id`) so it still fires when the notice arrives
  // after an async load; markAnnouncementRead is idempotent so re-runs are safe.
  React.useEffect(() => { if (note) markAnnouncementRead(note.id); }, [id, note]);

  if (!note) {
    return (
      <AppShell activeKey="announcements" title="Notice">
        <EmptyState icon="Megaphone" title="Notice not found" action={<Button onClick={() => navigate("/announcements")}>Back to Announcements</Button>} />
      </AppShell>
    );
  }
  const canManage = currentUser.role === "Admin";

  return (
    <AppShell activeKey="announcements" title="Notice">
      <div className="mx-auto max-w-3xl">
        <button onClick={() => navigate("/announcements")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <Icon name="ArrowLeft" size={16} /> Back to Announcements
        </button>

        <Card className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            {note.pinned && <Badge tone="amber" icon="Pin">Pinned</Badge>}
            <Badge tone={PRIORITY_TONE[note.priority]} icon={PRIORITY_ICON[note.priority]}>{note.priority}</Badge>
          </div>
          <div className="mt-3 flex items-start justify-between gap-4">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{note.title}</h2>
            {canManage && <Button size="sm" variant="secondary" icon="Trash2" className="shrink-0 text-red-600" onClick={() => setConfirmDelete(true)}>Delete</Button>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
            <span className="inline-flex items-center gap-1.5"><Icon name="Building2" size={14} />{note.department}</span>
            <span className="inline-flex items-center gap-1.5"><Icon name="Calendar" size={14} />{fmtDate(note.date)}</span>
          </div>

          <div className="mt-5 whitespace-pre-line border-t border-slate-100 pt-5 text-sm leading-relaxed text-slate-700">{note.body}</div>

          {note.image && (
            <a href={note.image} target="_blank" rel="noreferrer" title="Open full image" className="mt-5 block">
              <img src={note.image} alt={note.title} className="w-full cursor-zoom-in rounded-lg border border-slate-200 transition hover:opacity-95" />
            </a>
          )}

          {note.attachment && note.attachmentUrl && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Attachment</p>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700"><Icon name="FileText" size={18} /></span>
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{note.attachment}</p><p className="text-xs text-slate-400">PDF document</p></div>
                </div>
                <Button size="sm" variant="secondary" icon="Download" onClick={() => downloadFile(note.attachmentUrl, note.attachment)}>Download</Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} icon="Trash2" tone="red"
        title="Delete this notice?" description={`"${note.title}" will be removed from the notice board.`}
        footer={<><Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="destructive" onClick={async () => { const r = await deleteAnnouncement(id); if (!r.ok) { toast({ type: "error", title: "Couldn't delete", message: r.error }); return; } toast({ type: "success", title: "Notice deleted" }); navigate("/announcements"); }}>Delete notice</Button></>} />
    </AppShell>
  );
}

// --- Compose form (admin only) ----------------------------------------------
export function AnnouncementForm() {
  const { currentUser, addAnnouncement } = useApp();
  const toast = useToast();
  const fileRef = React.useRef(null);
  React.useEffect(() => { if (currentUser.role !== "Admin") navigate("/announcements"); }, [currentUser]);
  const [form, setForm] = React.useState({ title: "", body: "", department: "", priority: "General", pinned: false, image: null, imageFile: null, attachment: null, attachmentFile: null });
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!form.title.trim()) er.title = "Enter a title.";
    if (!form.department) er.department = "Choose a department.";
    if (!form.body.trim()) er.body = "Write the notice body.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    const res = await addAnnouncement({ title: form.title.trim(), body: form.body.trim(), department: form.department, priority: form.priority, pinned: form.pinned, image: form.image, imageFile: form.imageFile, attachmentFile: form.attachmentFile });
    setSaving(false);
    if (!res.ok) { toast({ type: "error", title: "Couldn't post notice", message: res.error }); return; }
    toast({ type: "success", title: "Notice posted", message: form.pinned ? "Pinned to the top of the board." : "It's now on the notice board." });
    navigate(`/announcements/${res.id}`);
  }

  return (
    <AppShell activeKey="announcements" title="Post Notice">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate("/announcements")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <Icon name="ArrowLeft" size={16} /> Back to Announcements
        </button>
        <PageHeader title="Post a notice" subtitle="Publish to the campus notice board." />
        <form onSubmit={submit} className="space-y-6">
          <Card className="space-y-5 p-6">
            <Field label="Title" htmlFor="an-title" required error={errors.title}><Input id="an-title" placeholder="e.g. Mid-term routine published" value={form.title} error={!!errors.title} onChange={(e) => set("title", e.target.value)} /></Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Department" htmlFor="an-dept" required error={errors.department}>
                <Select id="an-dept" value={form.department} error={!!errors.department} onChange={(e) => set("department", e.target.value)}>
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </Field>
              <Field label="Priority" htmlFor="an-pri">
                <div className="flex gap-2">
                  {["General", "Important", "Urgent"].map((p) => {
                    const active = form.priority === p;
                    const tone = PRIORITY_TONE[p];
                    return <button type="button" key={p} onClick={() => set("priority", p)}
                      className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${active ? (tone === "red" ? "border-red-300 bg-red-50 text-red-700" : tone === "amber" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-300 bg-slate-100 text-slate-700") : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>{p}</button>;
                  })}
                </div>
              </Field>
            </div>
            <Field label="Body" htmlFor="an-body" required error={errors.body}><Textarea id="an-body" rows={6} placeholder="Write the full notice…" value={form.body} error={!!errors.body} onChange={(e) => set("body", e.target.value)} /></Field>
            <Field label="Notice image" htmlFor="an-image" hint="Upload a photo or scan of the printed notice — it shows inline, the way notices are usually posted.">
              <FileUpload id="an-image" value={form.image} onChange={(url, file) => setForm((f) => ({ ...f, image: url, imageFile: file }))} label="Upload notice image" />
            </Field>
            <div>
              <label className="text-sm font-medium text-slate-700">Attachment <span className="text-slate-400">(optional PDF)</span></label>
              <div className="mt-1.5 flex items-center gap-2">
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const file = e.target.files[0] || null; setForm((f) => ({ ...f, attachmentFile: file, attachment: file ? file.name : null })); }} />
                <Button type="button" variant="secondary" size="sm" icon="Paperclip" onClick={() => fileRef.current && fileRef.current.click()}>{form.attachment ? "Change file" : "Attach PDF"}</Button>
                {form.attachment && <span className="inline-flex items-center gap-1.5 text-sm text-slate-600"><Icon name="FileText" size={14} className="text-red-600" />{form.attachment}<button type="button" onClick={() => setForm((f) => ({ ...f, attachment: null, attachmentFile: null }))} className="text-slate-400 hover:text-slate-600"><Icon name="X" size={14} /></button></span>}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
              <input type="checkbox" checked={form.pinned} onChange={(e) => set("pinned", e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
              <span className="flex items-center gap-1.5 text-sm text-slate-700"><Icon name="Pin" size={14} className="text-amber-600" /> Pin to top of the board</span>
            </label>
          </Card>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate("/announcements")}>Cancel</Button>
            <Button type="submit" icon="Megaphone" disabled={saving}>{saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Post notice"}</Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

// --- Dashboard widget -------------------------------------------------------
export function AnnouncementsWidget() {
  const { currentUser, announcements } = useApp();
  const unread = announcements.filter((a) => !a.readBy.includes(currentUser.id)).length;
  const latest = [...announcements].sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || b.date.localeCompare(a.date))[0];
  return (
    <button onClick={() => navigate("/announcements")} className="group flex w-full items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50/40">
      <AccentTile icon="Megaphone" tone="amber" size={44} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">Announcements {unread > 0 && <span className="rounded-full bg-blue-100 px-1.5 text-xs font-medium text-blue-700">{unread} new</span>}</p>
        <p className="truncate text-xs text-slate-500">{latest ? latest.title : "Campus notice board"}</p>
      </div>
      <Icon name="ArrowRight" size={18} className="text-slate-300 group-hover:text-amber-500" />
    </button>
  );
}
