import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { Card, Button, Field, Input, Textarea, Modal, EmptyState, useToast } from "../../components/ui.jsx";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TYPES = [
  { id: "holiday", label: "Holiday", dot: "bg-red-500", chip: "border-red-500 bg-red-50 text-red-700", stripe: "bg-red-500" },
  { id: "exam", label: "Exam", dot: "bg-amber-500", chip: "border-amber-500 bg-amber-50 text-amber-700", stripe: "bg-amber-500" },
  { id: "semester", label: "Semester", dot: "bg-blue-500", chip: "border-blue-500 bg-blue-50 text-blue-700", stripe: "bg-blue-500" },
  { id: "general", label: "General", dot: "bg-slate-400", chip: "border-slate-400 bg-slate-50 text-slate-600", stripe: "bg-slate-400" },
];
const TYPE = Object.fromEntries(TYPES.map((t) => [t.id, t]));
const dim = (y, m) => new Date(y, m + 1, 0).getDate();
const firstDow = (y, m) => new Date(y, m, 1).getDay();
const fmtShort = (s) => { const d = new Date(s + "T00:00:00"); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
const todayStr = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = { title: "", description: "", date: "", endDate: "", type: "general" };

export function AcademicCalendar() {
  const { calendarEvents, canManageCalendar, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent } = useApp();
  const toast = useToast();
  const now = useMemo(() => new Date(), []);
  const [[year, month], setYM] = useState([now.getFullYear(), now.getMonth()]);

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const prev = () => setYM(([y, m]) => (m === 0 ? [y - 1, 11] : [y, m - 1]));
  const next = () => setYM(([y, m]) => (m === 11 ? [y + 1, 0] : [y, m + 1]));

  // Events in the visible month.
  const monthEvents = useMemo(() => {
    const pad = String(month + 1).padStart(2, "0");
    const prefix = `${year}-${pad}`;
    return calendarEvents
      .filter((e) => (e.date || "").startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [calendarEvents, year, month]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    monthEvents.forEach((e) => {
      const day = parseInt(e.date.split("-")[2], 10);
      map.set(day, [...(map.get(day) || []), e]);
    });
    return map;
  }, [monthEvents]);

  const weeks = useMemo(() => {
    const n = dim(year, month), f = firstDow(year, month);
    const cells = Array(f).fill(null);
    for (let d = 1; d <= n; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const w = [];
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7));
    return w;
  }, [year, month]);

  const todayDay = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1;

  function openAdd() { setEditId(null); setForm({ ...EMPTY_FORM, date: todayStr() }); setModal(true); }
  function openEdit(e) {
    setEditId(e.id);
    setForm({ title: e.title, description: e.description, date: e.date, endDate: e.endDate || "", type: e.type });
    setModal(true);
  }

  async function save() {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      const res = editId ? await updateCalendarEvent(editId, form) : await addCalendarEvent(form);
      if (!res.ok) { toast({ type: "error", title: "Couldn't save", message: res.error }); return; }
      toast({ type: "success", title: editId ? "Event updated" : "Event added" });
      setModal(false);
    } finally { setSaving(false); }
  }

  async function doDelete() {
    const res = await deleteCalendarEvent(confirmDel.id);
    if (!res.ok) toast({ type: "error", title: "Couldn't delete", message: res.error });
    else toast({ type: "success", title: "Event deleted" });
    setConfirmDel(null);
  }

  return (
    <AppShell
      activeKey="calendar"
      title="Academic Calendar"
      actions={canManageCalendar ? <Button size="sm" icon={Plus} onClick={openAdd}>Add event</Button> : null}
    >
      <PageHeader title="Academic Calendar" subtitle="University holidays, exams and semester dates." />

      {/* Month nav */}
      <div className="mb-4 flex items-center justify-between">
        <button onClick={prev} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><ChevronLeft size={20} /></button>
        <h3 className="text-lg font-bold text-slate-900">{MONTHS[month]} {year}</h3>
        <button onClick={next} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><ChevronRight size={20} /></button>
      </div>

      {/* Grid */}
      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-7">
          {DAYS.map((d) => <div key={d} className="pb-2 text-center text-xs font-medium text-slate-400">{d}</div>)}
        </div>
        {weeks.map((wk, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {wk.map((day, di) => {
              const evs = day ? eventsByDay.get(day) : null;
              const isToday = day === todayDay;
              return (
                <div key={di} className="flex min-h-[52px] flex-col items-center py-1.5">
                  {day && (
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${isToday ? "bg-teal-600 font-semibold text-white" : "text-slate-700"}`}>{day}</span>
                  )}
                  {evs && (
                    <div className="mt-1 flex gap-0.5">
                      {evs.slice(0, 3).map((e, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${TYPE[e.type]?.dot || "bg-slate-400"}`} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </Card>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {TYPES.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`h-2 w-2 rounded-full ${t.dot}`} /> {t.label}
          </span>
        ))}
      </div>

      {/* Event list */}
      <div className="mt-6 space-y-2">
        {monthEvents.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No events" message={`Nothing scheduled in ${MONTHS[month]}.`} />
        ) : (
          monthEvents.map((e) => (
            <Card key={e.id} className="flex overflow-hidden">
              <span className={`w-1 shrink-0 ${TYPE[e.type]?.stripe || "bg-slate-400"}`} />
              <div className="flex-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{e.title}</p>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${TYPE[e.type]?.chip}`}>{TYPE[e.type]?.label}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{fmtShort(e.date)}{e.endDate ? ` — ${fmtShort(e.endDate)}` : ""}</p>
                {e.description && <p className="mt-1 text-sm text-slate-500">{e.description}</p>}
                {canManageCalendar && (
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => openEdit(e)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"><Pencil size={13} /> Edit</button>
                    <button onClick={() => setConfirmDel(e)} className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700"><Trash2 size={13} /> Delete</button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? "Edit event" : "Add event"}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={!form.title.trim() || !form.date}>{editId ? "Save" : "Add"}</Button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Title" htmlFor="ce-t" required><Input id="ce-t" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Mid-term exams" /></Field>
          <Field label="Type">
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button key={t.id} type="button" onClick={() => setForm((f) => ({ ...f, type: t.id }))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${form.type === t.id ? t.chip : "border-slate-200 bg-white text-slate-500"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" htmlFor="ce-d" required><Input id="ce-d" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
            <Field label="End date" htmlFor="ce-e" hint="Optional"><Input id="ce-e" type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} /></Field>
          </div>
          <Field label="Description" htmlFor="ce-de" hint="Optional"><Textarea id="ce-de" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Delete this event?"
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
