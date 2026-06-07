import React from "react";
import { Icon } from "../../components/Icon.jsx";
import {
  Button, Card, Badge, StatusBadge, Field, Input, Textarea, Select, FileUpload,
  EmptyState, Modal, Avatar, Spinner, Loading, useToast,
} from "../../components/ui.jsx";
import { AppShell, PageHeader, ROLE_TONE } from "../../components/AppShell.jsx";
import { FilterTabs } from "../../components/FilterTabs.jsx";
import {
  AccentTile, CountdownBanner, SegmentToggle,
  taka, fmtTime, fmtCountdown, nextDeparture, toMinutes, minutesToHHMM,
  nowDhakaMinutes, dhakaParts, useTick,
} from "../../components/featureKit.jsx";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { fmtDate, relativeDate, todayISO } from "../../lib/helpers.js";

// ============================================================================
// FEATURE 7 — Events  (signature accent: fuchsia)
// List/Calendar views, category filter, Upcoming/Past tabs, detail w/ RSVP +
// add-to-calendar, admin/club form, dashboard widget.
// ============================================================================

export const EVENT_CATEGORIES = ["Academic", "Cultural", "Sports", "Club", "Career"];
export const EVENT_CATEGORY_ICON = { Academic: "GraduationCap", Cultural: "Music", Sports: "Trophy", Club: "Users", Career: "Briefcase" };
export const EVENT_STATUS_TONE = { Upcoming: "blue", Today: "amber", Ongoing: "emerald", Ended: "slate" };

export function eventStatus(ev) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
  if (ev.date < today) return "Ended";
  if (ev.date > today) return "Upcoming";
  const now = nowDhakaMinutes();
  if (now < toMinutes(ev.time)) return "Today";
  if (!ev.endTime) return "Ongoing";
  if (now <= toMinutes(ev.endTime)) return "Ongoing";
  return "Ended";
}

export function EventBanner({ ev, className = "" }) {
  if (ev.banner) return <img src={ev.banner} alt={ev.title} className={`object-cover ${className}`} />;
  return (
    <div className={`flex items-center justify-center bg-fuchsia-50 ${className}`}>
      <Icon name={EVENT_CATEGORY_ICON[ev.category] || "CalendarDays"} size={44} strokeWidth={1.5} className="text-fuchsia-300" />
    </div>
  );
}

export function gcalLink(ev) {
  const d = ev.date.replace(/-/g, "");
  const s = (ev.time || "09:00").replace(":", "") + "00";
  const e = (ev.endTime || ev.time || "10:00").replace(":", "") + "00";
  const dates = `${d}T${s}/${d}T${e}`;
  const p = new URLSearchParams({ action: "TEMPLATE", text: ev.title, dates, location: ev.venue, details: ev.description });
  return `https://www.google.com/calendar/render?${p.toString()}`;
}

// --- Event card -------------------------------------------------------------
export function EventCard({ ev, onOpen }) {
  const status = eventStatus(ev);
  return (
    <button onClick={onOpen} className="group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
      <div className="relative h-32 w-full overflow-hidden">
        <EventBanner ev={ev} className="h-full w-full" />
        <div className="absolute left-3 top-3"><Badge tone="fuchsia" icon={EVENT_CATEGORY_ICON[ev.category]}>{ev.category}</Badge></div>
        <div className="absolute right-3 top-3"><Badge tone={EVENT_STATUS_TONE[status]}>{status}</Badge></div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-1 text-sm font-semibold text-slate-900">{ev.title}</h3>
        <p className="mt-0.5 text-xs text-slate-400">{ev.organizer}</p>
        <div className="mt-2.5 space-y-1 text-xs text-slate-500">
          <p className="flex items-center gap-1.5"><Icon name="CalendarDays" size={13} className="text-slate-400" />{fmtDate(ev.date)} · {fmtTime(ev.time)}</p>
          <p className="flex items-center gap-1.5"><Icon name="MapPin" size={13} className="text-slate-400" />{ev.venue}</p>
        </div>
        <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2.5 text-xs text-slate-400">
          <Icon name="Users" size={13} />{ev.attendees.length} going
        </div>
      </div>
    </button>
  );
}

// --- Calendar view ----------------------------------------------------------
export function CalendarView({ events, onOpen }) {
  const p = dhakaParts();
  const year = parseInt(p.year, 10);
  const monthIdx = new Date(`${p.month} 1, ${year}`).getMonth();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
  const firstDow = new Date(year, monthIdx, 1).getDay(); // 0=Sun
  const days = new Date(year, monthIdx + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  function isoFor(d) {
    return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return (
    <Card className="p-4 sm:p-5">
      <p className="mb-3 text-sm font-semibold text-slate-900">{p.month} {year}</p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="min-h-[64px]"></div>;
          const iso = isoFor(d);
          const dayEvents = events.filter((e) => e.date === iso);
          const isToday = iso === today;
          return (
            <div key={d} className={`min-h-[64px] rounded-lg border p-1 text-left ${isToday ? "border-fuchsia-300 bg-fuchsia-50/50" : "border-slate-100"}`}>
              <span className={`text-xs font-medium ${isToday ? "text-fuchsia-700" : "text-slate-500"}`}>{d}</span>
              <div className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, 2).map((e) => (
                  <button key={e.id} onClick={() => onOpen(e)} className="block w-full truncate rounded bg-fuchsia-100 px-1 py-0.5 text-left text-[10px] font-medium text-fuchsia-700 hover:bg-fuchsia-200">
                    {e.title}
                  </button>
                ))}
                {dayEvents.length > 2 && <span className="block px-1 text-[10px] text-slate-400">+{dayEvents.length - 2} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// --- Browse -----------------------------------------------------------------
export function Events() {
  const { events, canCreateEvents, dataLoading } = useApp();
  const [view, setView] = React.useState("list");
  const [category, setCategory] = React.useState("All");
  const [tab, setTab] = React.useState("Upcoming");

  const filtered = events.filter((e) => category === "All" || e.category === category);
  const upcoming = filtered.filter((e) => eventStatus(e) !== "Ended").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = filtered.filter((e) => eventStatus(e) === "Ended").sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const list = tab === "Upcoming" ? upcoming : past;

  return (
    <AppShell activeKey="events" title="Events">
      <PageHeader title="Events" subtitle="What's happening around campus."
        action={canCreateEvents ? <Button icon="Plus" onClick={() => navigate("/events/new")}>Create event</Button> : null} />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentToggle options={[{ value: "list", label: "List", icon: "List" }, { value: "calendar", label: "Calendar", icon: "CalendarDays" }]} value={view} onChange={setView} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {view === "list" && <FilterTabs options={["Upcoming", "Past"]} value={tab} onChange={setTab} counts={{ Upcoming: upcoming.length, Past: past.length }} />}
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-44">
            <option value="All">All categories</option>
            {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </div>

      {dataLoading ? (
        <Loading />
      ) : view === "calendar" ? (
        <CalendarView events={filtered} onOpen={(e) => navigate(`/events/${e.id}`)} />
      ) : list.length === 0 ? (
        <EmptyState icon="CalendarDays" title={`No ${tab.toLowerCase()} events`} message={tab === "Upcoming" ? "Check back soon, or browse the calendar." : "Past events will appear here."} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((e) => <EventCard key={e.id} ev={e} onOpen={() => navigate(`/events/${e.id}`)} />)}
        </div>
      )}
    </AppShell>
  );
}

// --- Detail -----------------------------------------------------------------
export function EventDetail({ id }) {
  const { currentUser, events, toggleRSVP, deleteEvent, dataLoading } = useApp();
  const toast = useToast();
  const ev = events.find((e) => e.id === id);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  if (!ev) {
    return (
      <AppShell activeKey="events" title="Event">
        {dataLoading ? <Loading /> : <EmptyState icon="CalendarDays" title="Event not found" action={<Button onClick={() => navigate("/events")}>Back to Events</Button>} />}
      </AppShell>
    );
  }
  const status = eventStatus(ev);
  const going = ev.attendees.includes(currentUser?.id);
  const canManage = currentUser?.role === "Admin" || ev.createdById === currentUser?.id;
  const ended = status === "Ended";

  async function onToggleRSVP() {
    const wasGoing = going;
    const r = await toggleRSVP(ev.id);
    if (!r.ok) { toast({ type: "error", title: "Couldn't update RSVP", message: r.error }); return; }
    toast({ type: "success", title: wasGoing ? "RSVP cancelled" : "You're going!", message: wasGoing ? "" : ev.title });
  }

  return (
    <AppShell activeKey="events" title="Event">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => navigate("/events")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <Icon name="ArrowLeft" size={16} /> Back to Events
        </button>

        <Card className="overflow-hidden">
          <div className="relative h-44 w-full sm:h-56">
            <EventBanner ev={ev} className="h-full w-full" />
            <div className="absolute left-4 top-4 flex gap-2">
              <Badge tone="fuchsia" icon={EVENT_CATEGORY_ICON[ev.category]}>{ev.category}</Badge>
              <Badge tone={EVENT_STATUS_TONE[status]}>{status}</Badge>
            </div>
          </div>
          <div className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{ev.title}</h2>
                <p className="mt-1 text-sm text-slate-500">Organized by {ev.organizer}</p>
              </div>
              {canManage && <Button variant="secondary" icon="Trash2" className="text-red-600" onClick={() => setConfirmDelete(true)}>Delete</Button>}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="flex items-start gap-2.5"><Icon name="CalendarDays" size={18} className="mt-0.5 text-fuchsia-600" /><div><p className="text-xs text-slate-400">Date</p><p className="text-sm font-medium text-slate-900">{fmtDate(ev.date)}</p></div></div>
              <div className="flex items-start gap-2.5"><Icon name="Clock" size={18} className="mt-0.5 text-fuchsia-600" /><div><p className="text-xs text-slate-400">Time</p><p className="text-sm font-medium text-slate-900">{fmtTime(ev.time)}{ev.endTime ? ` – ${fmtTime(ev.endTime)}` : ""}</p></div></div>
              <div className="flex items-start gap-2.5"><Icon name="MapPin" size={18} className="mt-0.5 text-fuchsia-600" /><div><p className="text-xs text-slate-400">Venue</p><p className="text-sm font-medium text-slate-900">{ev.venue}</p></div></div>
            </div>

            <p className="mt-5 border-t border-slate-100 pt-5 text-sm leading-relaxed text-slate-700">{ev.description}</p>

            <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Icon name="Users" size={16} className="text-slate-400" />
                <span className="font-semibold text-slate-900">{ev.attendees.length}</span> going{ev.capacity ? ` · ${ev.capacity} capacity` : ""}
              </div>
              <div className="flex gap-2">
                <a href={gcalLink(ev)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                  <Icon name="CalendarPlus" size={16} /> Add to calendar
                </a>
                {!ended && (
                  <Button variant={going ? "secondary" : "primary"} icon={going ? "Check" : "Ticket"} onClick={onToggleRSVP}>
                    {going ? "Going" : "RSVP"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} icon="Trash2" tone="red"
        title="Delete this event?" description={`"${ev.title}" and its RSVPs will be permanently removed.`}
        footer={<><Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="destructive" onClick={async () => { const r = await deleteEvent(id); if (!r.ok) { toast({ type: "error", title: "Couldn't delete", message: r.error }); return; } toast({ type: "success", title: "Event deleted" }); navigate("/events"); }}>Delete event</Button></>} />
    </AppShell>
  );
}

// --- Create form ------------------------------------------------------------
export function EventForm() {
  const { canCreateEvents, addEvent, dataLoading } = useApp();
  const toast = useToast();
  // Wait for the organizer allowlist to load before deciding access, so a
  // non-admin designated organizer isn't bounced on a cold load/refresh.
  React.useEffect(() => { if (!dataLoading && !canCreateEvents) navigate("/events"); }, [dataLoading, canCreateEvents]);
  if (!dataLoading && !canCreateEvents) return null;
  const [form, setForm] = React.useState({ title: "", category: "", organizer: "", date: todayISO(), time: "10:00", endTime: "12:00", venue: "", description: "", capacity: "", banner: null, bannerFile: null });
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    const er = {};
    if (!form.title.trim()) er.title = "Enter a title.";
    if (!form.category) er.category = "Choose a category.";
    if (!form.organizer.trim()) er.organizer = "Who's organizing?";
    if (!form.venue.trim()) er.venue = "Enter a venue.";
    if (!form.description.trim()) er.description = "Add a description.";
    if (form.endTime && form.endTime <= form.time) er.endTime = "End time must be after start.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const cap = Number(form.capacity);
      const r = await addEvent({ title: form.title.trim(), category: form.category, organizer: form.organizer.trim(), date: form.date, time: form.time, endTime: form.endTime, venue: form.venue.trim(), description: form.description.trim(), capacity: form.capacity && cap > 0 ? cap : null, banner: form.banner, bannerFile: form.bannerFile });
      if (!r.ok) { toast({ type: "error", title: "Couldn't create event", message: r.error }); return; }
      toast({ type: "success", title: "Event created", message: `"${form.title.trim()}" is now live.` });
      navigate(`/events/${r.id}`);
    } finally {
      setSaving(false);
    }
  }

  if (dataLoading) return <AppShell activeKey="events" title="Create Event"><Loading /></AppShell>;

  return (
    <AppShell activeKey="events" title="Create Event">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate("/events")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <Icon name="ArrowLeft" size={16} /> Back to Events
        </button>
        <PageHeader title="Create an event" subtitle="Publish an event to the campus calendar." />
        <form onSubmit={submit} className="space-y-6">
          <Card className="space-y-5 p-6">
            <Field label="Banner" htmlFor="ev-banner" hint="Optional cover image.">
              <FileUpload id="ev-banner" value={form.banner} onChange={(url, file) => setForm((f) => ({ ...f, banner: url, bannerFile: file }))} />
            </Field>
            <Field label="Title" htmlFor="ev-title" required error={errors.title}><Input id="ev-title" placeholder="e.g. Spring Cultural Night" value={form.title} error={!!errors.title} onChange={(e) => set("title", e.target.value)} /></Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Category" htmlFor="ev-cat" required error={errors.category}>
                <Select id="ev-cat" value={form.category} error={!!errors.category} onChange={(e) => set("category", e.target.value)}>
                  <option value="">Select a category</option>
                  {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Organizer" htmlFor="ev-org" required error={errors.organizer}><Input id="ev-org" placeholder="e.g. Cultural Club" value={form.organizer} error={!!errors.organizer} onChange={(e) => set("organizer", e.target.value)} /></Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Date" htmlFor="ev-date"><Input id="ev-date" type="date" value={form.date} min={todayISO()} onChange={(e) => set("date", e.target.value)} /></Field>
              <Field label="Start" htmlFor="ev-time"><Input id="ev-time" type="time" value={form.time} onChange={(e) => set("time", e.target.value)} /></Field>
              <Field label="End" htmlFor="ev-end" error={errors.endTime}><Input id="ev-end" type="time" value={form.endTime} error={!!errors.endTime} onChange={(e) => set("endTime", e.target.value)} /></Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Venue" htmlFor="ev-venue" required error={errors.venue}><Input id="ev-venue" placeholder="e.g. Auditorium, Main Building" value={form.venue} error={!!errors.venue} onChange={(e) => set("venue", e.target.value)} /></Field>
              <Field label="Capacity" htmlFor="ev-cap" hint="Optional"><Input id="ev-cap" type="number" min="1" placeholder="e.g. 200" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
            </div>
            <Field label="Description" htmlFor="ev-desc" required error={errors.description}><Textarea id="ev-desc" rows={4} placeholder="What's the event about?" value={form.description} error={!!errors.description} onChange={(e) => set("description", e.target.value)} /></Field>
          </Card>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate("/events")}>Cancel</Button>
            <Button type="submit" icon="Plus" disabled={saving}>{saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Create event"}</Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

// --- Dashboard widget -------------------------------------------------------
export function EventsWidget() {
  const { events } = useApp();
  const next = events.filter((e) => eventStatus(e) !== "Ended").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  return (
    <button onClick={() => navigate("/events")} className="group flex w-full items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-fuchsia-300 hover:bg-fuchsia-50/40">
      <AccentTile icon="CalendarDays" tone="fuchsia" size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{next ? "Next event" : "Events"}</p>
        <p className="truncate text-xs text-slate-500">{next ? `${next.title} · ${fmtDate(next.date)}` : "Browse what's happening on campus"}</p>
      </div>
      <Icon name="ArrowRight" size={18} className="text-slate-300 group-hover:text-fuchsia-500" />
    </button>
  );
}
