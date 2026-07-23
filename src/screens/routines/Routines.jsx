import React, { useState, useRef } from "react";
import { Plus, Search, X, Trash2, FileText, Upload, ClipboardList, ExternalLink } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { Card, Button, Field, Input, Modal, Badge, EmptyState, useToast } from "../../components/ui.jsx";

const TABS = [{ id: "class", label: "Class Routines" }, { id: "exam", label: "Exam Routines" }];
const EMPTY = { type: "class", title: "", department: "", semester: "", intake: "", section: "", file: null };

function relTime(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(Math.floor(s / 60), 1)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function Routines() {
  const { currentUser, routines, canPostRoutines, addRoutine, deleteRoutine } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState("class");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [posting, setPosting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const fileRef = useRef(null);

  const q = search.toLowerCase();
  const list = routines
    .filter((r) => r.type === tab)
    .filter((r) => !q || r.title.toLowerCase().includes(q) || r.department.toLowerCase().includes(q) ||
      r.semester.toLowerCase().includes(q) || r.intake.toLowerCase().includes(q));

  function openPost() { setForm(EMPTY); setModal(true); }

  async function post() {
    if (!form.title.trim()) return;
    setPosting(true);
    try {
      const res = await addRoutine(form);
      if (!res.ok) { toast({ type: "error", title: "Couldn't post", message: res.error }); return; }
      toast({ type: "success", title: "Routine posted" });
      setModal(false);
    } finally { setPosting(false); }
  }

  async function doDelete() {
    const res = await deleteRoutine(confirmDel.id);
    if (!res.ok) toast({ type: "error", title: "Couldn't delete", message: res.error });
    else toast({ type: "success", title: "Routine removed" });
    setConfirmDel(null);
  }

  return (
    <AppShell activeKey="routines" title="Class & Exam Routines">
      <PageHeader
        title="Routines"
        subtitle="Class and exam schedules posted by faculty and staff."
        action={canPostRoutines ? <Button size="sm" icon={Plus} onClick={openPost}>Post routine</Button> : null}
      />

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-brd">
        {TABS.map((t) => {
          const count = routines.filter((r) => r.type === t.id).length;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-base font-semibold transition-colors ${active ? "border-teal-600 text-teal-700 dark:text-teal-300" : "border-transparent text-ink-3 hover:text-ink-2"}`}>
              {t.label}{count > 0 ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-2 rounded-md border border-brd bg-surface px-3">
        <Search size={16} className="text-ink-3" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, department, semester…"
          aria-label="Search routines" className="h-10 flex-1 bg-transparent text-base text-ink placeholder:text-ink-3 focus:outline-none" />
        {search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={15} className="text-ink-3 hover:text-ink-2" /></button>}
      </div>

      {/* List */}
      {list.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No routines" message={`No ${tab} routines posted yet.`} />
      ) : (
        <div className="space-y-2">
          {list.map((r) => {
            const url = r.fileUrl || r.imageUrl;
            const canDelete = canPostRoutines && (r.publishedBy === currentUser?.id || currentUser?.role === "Admin");
            return (
              <Card key={r.id} className="flex overflow-hidden">
                {r.imageUrl ? (
                  <img src={r.imageUrl} alt="" className="h-20 w-20 shrink-0 object-cover" />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-300"><FileText size={26} /></div>
                )}
                <div className="min-w-0 flex-1 p-3">
                  <p className="truncate text-base font-semibold text-ink">{r.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {r.department && <Badge tone="teal">{r.department}</Badge>}
                    {r.semester && <span className="text-xs text-ink-3">{r.semester}</span>}
                    {r.intake && <span className="text-xs text-ink-3">Intake {r.intake}{r.section ? ` · Sec ${r.section}` : ""}</span>}
                  </div>
                  <p className="mt-1 text-xs text-ink-3">{relTime(r.createdAt)}</p>
                  <div className="mt-2 flex items-center gap-3">
                    {url && (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-300">
                        <ExternalLink size={13} /> Open
                      </a>
                    )}
                    {canDelete && (
                      <button onClick={() => setConfirmDel(r)} className="inline-flex items-center gap-1 text-xs font-semibold text-danger hover:text-danger"><Trash2 size={13} /> Delete</button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Post modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Post a routine"
        size="lg"
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={post} loading={posting} disabled={!form.title.trim()}>Post</Button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Type">
            <div className="flex gap-2">
              {TABS.map((t) => (
                <button key={t.id} type="button" onClick={() => setForm((f) => ({ ...f, type: t.id }))}
                  className={`rounded-full border px-4 py-1.5 text-base font-semibold ${form.type === t.id ? "border-teal-600 bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300" : "border-brd bg-surface text-ink-3"}`}>
                  {t.id === "class" ? "Class" : "Exam"}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Title" htmlFor="r-t" required><Input id="r-t" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. CSE Intake 49 — Spring 2026" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department" htmlFor="r-d"><Input id="r-d" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} placeholder="e.g. CSE" /></Field>
            <Field label="Semester" htmlFor="r-s"><Input id="r-s" value={form.semester} onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))} placeholder="e.g. Spring 2026" /></Field>
            <Field label="Intake" htmlFor="r-i"><Input id="r-i" value={form.intake} onChange={(e) => setForm((f) => ({ ...f, intake: e.target.value }))} placeholder="e.g. 49" /></Field>
            <Field label="Section" htmlFor="r-se"><Input id="r-se" value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} placeholder="e.g. 5" /></Field>
          </div>
          <Field label="File" hint="PDF or image — the routine sheet.">
            <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden"
              onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className={`flex h-11 w-full items-center gap-2 rounded-md border border-dashed px-3 text-base ${form.file ? "border-teal-500 text-ink-2" : "border-brd-2 text-ink-3"} hover:bg-surface-2`}>
              <Upload size={18} className={form.file ? "text-teal-600 dark:text-teal-300" : "text-ink-3"} />
              <span className="truncate">{form.file ? form.file.name : "Choose a PDF or image…"}</span>
            </button>
          </Field>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Delete this routine?"
        description={confirmDel ? `"${confirmDel.title}" will be permanently removed.` : ""}
        icon={Trash2}
        tone="red"
        footer={<>
          <Button variant="secondary" onClick={() => setConfirmDel(null)}>Cancel</Button>
          <Button variant="destructive" onClick={doDelete}>Delete</Button>
        </>}
      />
    </AppShell>
  );
}
