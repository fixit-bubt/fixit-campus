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
// FEATURE 1 — Bus Schedule  (signature accent: sky)
// Browse (next-departure hero + direction toggle + route cards),
// Detail (full timetable both directions), Admin form, dashboard widget.
// ============================================================================

// Routes are live reference data now (public.bus_routes, seeded in 0022) — read
// from the store via useApp().busRoutes / busById.

export function buildSchedule(route, direction, departIndex = 0) {
  const stops = direction === "to" ? route.stops : [...route.stops].reverse();
  const legs = direction === "to" ? route.legMins : [...route.legMins].reverse();
  const start = toMinutes((direction === "to" ? route.toDepartures : route.fromDepartures)[departIndex]);
  const rows = [];
  let t = start;
  for (let i = 0; i < stops.length; i++) {
    if (i > 0) t += legs[i - 1];
    rows.push({ stop: stops[i], time: minutesToHHMM(t) });
  }
  return rows;
}

// --- Route card -------------------------------------------------------------
export function BusRouteCard({ route, direction, saved, onToggleSave, onOpen }) {
  const departures = direction === "to" ? route.toDepartures : route.fromDepartures;
  const next = nextDeparture(departures);
  const timeline = direction === "to" ? route.stops : [...route.stops].reverse();

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AccentTile icon="Bus" tone="sky" />
          <div>
            <p className="text-sm font-semibold text-slate-900">{route.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400 whitespace-nowrap">
              <span className="font-mono">{route.busNo}</span> · {route.area}
            </p>
          </div>
        </div>
        <button
          onClick={onToggleSave}
          title={saved ? "Saved route" : "Save route"}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${saved ? "text-amber-500 hover:bg-amber-50" : "text-slate-300 hover:bg-slate-100 hover:text-slate-400"}`}
        >
          <Icon name="Star" size={18} className={saved ? "fill-amber-400" : ""} />
        </button>
      </div>

      <div className="mt-4 flex items-end justify-between rounded-lg bg-slate-50 px-3 py-2.5">
        {next ? (
          <>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Next departure</p>
              <p className="text-lg font-bold text-slate-900">{fmtTime(minutesToHHMM(next.mins))}</p>
            </div>
            <Badge tone="sky">{next.tomorrow ? "tomorrow" : `in ${fmtCountdown(next.wait)}`}</Badge>
          </>
        ) : (
          <p className="text-sm text-slate-400">No departures scheduled</p>
        )}
      </div>

      {/* compact stops timeline */}
      <div className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
        {timeline.map((s, i) => (
          <React.Fragment key={s}>
            <span className={i === timeline.length - 1 ? "font-medium text-slate-700" : ""}>{s}</span>
            {i < timeline.length - 1 && <Icon name="ChevronRight" size={12} className="text-slate-300" />}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-400">{route.days}</span>
        <Button size="sm" variant="secondary" iconRight="ArrowRight" onClick={onOpen}>Timetable</Button>
      </div>
    </Card>
  );
}

// --- Browse -----------------------------------------------------------------
export function BusSchedule() {
  const { busRoutes, savedBusRoutes, toggleBusSave, dataLoading } = useApp();
  const [direction, setDirection] = React.useState("to");
  const saved = savedBusRoutes;

  if (dataLoading) {
    return <AppShell activeKey="bus" title="Bus Schedule"><PageHeader title="Bus Schedule" subtitle="Campus shuttle routes, live departures, and timetables." /><Loading /></AppShell>;
  }
  if (busRoutes.length === 0) {
    return (
      <AppShell activeKey="bus" title="Bus Schedule">
        <PageHeader title="Bus Schedule" subtitle="Campus shuttle routes, live departures, and timetables." />
        <EmptyState icon="Bus" title="No routes yet" message="Campus shuttle routes will appear here once added." />
      </AppShell>
    );
  }

  // hero: soonest departure across all routes for this direction
  const hero = busRoutes
    .map((r) => {
      const deps = direction === "to" ? r.toDepartures : r.fromDepartures;
      const n = nextDeparture(deps);
      return n ? { route: r, ...n } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.wait - b.wait)[0];

  const sortedRoutes = [...busRoutes].sort((a, b) => {
    const as = saved.includes(a.id) ? 0 : 1;
    const bs = saved.includes(b.id) ? 0 : 1;
    return as - bs;
  });

  const heroStops = hero ? (direction === "to" ? hero.route.stops : [...hero.route.stops].reverse()) : [];

  return (
    <AppShell activeKey="bus" title="Bus Schedule">
      <PageHeader title="Bus Schedule" subtitle="Campus shuttle routes, live departures, and timetables." />

      {hero && (
        <CountdownBanner
          tone="sky"
          icon="Bus"
          eyebrow={direction === "to" ? "Next bus to campus" : "Next bus from campus"}
          title={hero.route.name}
          time={fmtTime(minutesToHHMM(hero.mins))}
          waitMins={hero.wait}
          tomorrow={hero.tomorrow}
          meta={`${hero.route.busNo} · from ${heroStops[0]}`}
        />
      )}

      <div className="mt-6 flex items-center justify-between">
        <SegmentToggle
          options={[{ value: "to", label: "To Campus", icon: "ArrowRight" }, { value: "from", label: "From Campus", icon: "ArrowLeft" }]}
          value={direction}
          onChange={setDirection}
        />
        <span className="hidden text-sm text-slate-400 sm:block">{busRoutes.length} routes</span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedRoutes.map((r) => (
          <BusRouteCard
            key={r.id}
            route={r}
            direction={direction}
            saved={saved.includes(r.id)}
            onToggleSave={() => toggleBusSave(r.id)}
            onOpen={() => navigate(`/bus/${r.id}`)}
          />
        ))}
      </div>
    </AppShell>
  );
}

// --- Detail -----------------------------------------------------------------
export function TimetableTable({ rows }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <th className="px-4 py-2.5 font-medium">Stop</th>
            <th className="px-4 py-2.5 text-right font-medium">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={r.stop} className={i === rows.length - 1 ? "bg-sky-50/40" : ""}>
              <td className="px-4 py-2.5">
                <span className="inline-flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${i === rows.length - 1 ? "bg-sky-600" : "bg-slate-300"}`}></span>
                  <span className={i === rows.length - 1 ? "font-medium text-slate-900" : "text-slate-700"}>{r.stop}</span>
                </span>
              </td>
              <td className="px-4 py-2.5 text-right font-medium text-slate-900">{fmtTime(r.time)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BusDetail({ id }) {
  const { currentUser, busById, dataLoading } = useApp();
  const route = busById(id);
  const [direction, setDirection] = React.useState("to");

  if (!route) {
    return (
      <AppShell activeKey="bus" title="Route">
        {dataLoading ? <Loading /> : <EmptyState icon="Bus" title="Route not found" message="This route may have changed." action={<Button onClick={() => navigate("/bus")}>Back to routes</Button>} />}
      </AppShell>
    );
  }

  const departures = direction === "to" ? route.toDepartures : route.fromDepartures;
  const sched = buildSchedule(route, direction, 0);

  return (
    <AppShell activeKey="bus" title="Route Timetable">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => navigate("/bus")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <Icon name="ArrowLeft" size={16} /> Back to routes
        </button>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <AccentTile icon="Bus" tone="sky" size={48} />
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{route.name}</h2>
              <p className="mt-0.5 text-sm text-slate-400"><span className="font-mono">{route.busNo}</span> · {route.area} · {route.days}</p>
            </div>
          </div>
          {currentUser?.role === "Admin" && (
            <Button variant="secondary" icon="Pencil" onClick={() => navigate(`/bus/${route.id}/edit`)}>Edit route</Button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <SegmentToggle
                options={[{ value: "to", label: "To Campus" }, { value: "from", label: "From Campus" }]}
                value={direction}
                onChange={setDirection}
              />
              <span className="text-xs text-slate-400">Departs {departures.map((d) => fmtTime(d)).join(", ")}</span>
            </div>
            <TimetableTable rows={sched} />
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
              <Icon name="Info" size={13} className="text-slate-400" />
              Representative timing for the first trip. Daily trips depart at {departures.map((d) => fmtTime(d)).join(" & ")}.
            </p>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900">Service details</h3>
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Bus number</dt><dd className="font-medium text-slate-900">{route.busNo}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Days operated</dt><dd className="font-medium text-slate-900">{route.days}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">To-campus trips</dt><dd className="font-medium text-slate-900">{route.toDepartures.length}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">From-campus trips</dt><dd className="font-medium text-slate-900">{route.fromDepartures.length}</dd></div>
              </dl>
              {route.fridayNote && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <Icon name="TriangleAlert" size={14} className="mt-0.5 shrink-0" />
                  {route.fridayNote}
                </div>
              )}
            </Card>

            {route.helperName && (
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-900">Route helper</h3>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={route.helperName} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{route.helperName}</p>
                      <p className="truncate text-xs text-slate-500">{route.helperPhone || "No number listed"}</p>
                    </div>
                  </div>
                  {route.helperPhone && (
                    <a href={`https://wa.me/${route.helperPhone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700">
                      <Icon name="MessageCircle" size={15} /> Chat
                    </a>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// --- Admin form -------------------------------------------------------------
// Wrapper: gate on admin + on the route being loaded before mounting the editor,
// so a deep-link/refresh to /bus/:id/edit never seeds a blank form (which a Save
// would write back over the real route).
export function BusRouteForm({ id }) {
  const { currentUser, busById, dataLoading } = useApp();
  const editing = !!id;
  const existing = editing ? busById(id) : null;

  React.useEffect(() => {
    if (currentUser.role !== "Admin") navigate("/bus");
  }, [currentUser]);

  if (editing && (dataLoading || !existing)) {
    return (
      <AppShell activeKey="bus" title="Edit Route">
        {dataLoading ? <Loading /> : <EmptyState icon="Bus" title="Route not found" message="This route may have changed." action={<Button onClick={() => navigate("/bus")}>Back to routes</Button>} />}
      </AppShell>
    );
  }
  return <BusRouteEditor id={id} existing={existing} />;
}

function BusRouteEditor({ id, existing }) {
  const { addBusRoute, updateBusRoute } = useApp();
  const toast = useToast();
  const editing = !!id;
  const [form, setForm] = React.useState(
    existing
      ? { code: existing.id, name: existing.name, area: existing.area, busNo: existing.busNo, helperName: existing.helperName, helperPhone: existing.helperPhone, days: existing.days, fridayNote: existing.fridayNote, legMins: existing.legMins, toDepartures: existing.toDepartures.join(", "), fromDepartures: existing.fromDepartures.join(", "), stops: existing.stops.join("\n") }
      : { code: "", name: "", area: "", busNo: "", helperName: "", helperPhone: "", days: "Sat–Wed", fridayNote: "", legMins: [], toDepartures: "", fromDepartures: "", stops: "" }
  );
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    const splitList = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
    const splitLines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
    const stops = splitLines(form.stops);
    const toDepartures = splitList(form.toDepartures);
    const fromDepartures = splitList(form.fromDepartures);
    // Guard: never let an empty/blank form overwrite a real route, and require
    // departures in BOTH directions (an empty list crashes buildSchedule).
    if (!form.name.trim() || stops.length < 2 || toDepartures.length === 0 || fromDepartures.length === 0 || (!editing && !form.code.trim())) {
      toast({ type: "error", title: "Missing details", message: "Add a name, a route code, at least 2 stops, and at least one departure time each way." });
      return;
    }
    const payload = {
      id: form.code.trim(),
      name: form.name.trim(),
      area: form.area.trim(),
      busNo: form.busNo.trim(),
      helperName: form.helperName.trim(),
      helperPhone: form.helperPhone.trim(),
      days: form.days.trim(),
      fridayNote: form.fridayNote.trim(),
      legMins: form.legMins,
      stops,
      toDepartures,
      fromDepartures,
    };
    setSaving(true);
    try {
      const r = editing ? await updateBusRoute(id, payload) : await addBusRoute(payload);
      if (!r.ok) { toast({ type: "error", title: "Couldn't save route", message: r.error }); return; }
      toast({ type: "success", title: editing ? "Route updated" : "Route added", message: `${form.name || "Route"} saved.` });
      navigate(editing ? `/bus/${r.id}` : "/bus");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell activeKey="bus" title={editing ? "Edit Route" : "Add Route"}>
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate(editing ? `/bus/${id}` : "/bus")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <Icon name="ArrowLeft" size={16} /> Back
        </button>
        <PageHeader title={editing ? "Edit Route" : "Add a Route"} subtitle="Admin · manage campus shuttle routes and times." />
        <form onSubmit={submit} className="space-y-6">
          <Card className="space-y-5 p-6">
            {!editing && (
              <Field label="Route code" htmlFor="bc" hint="Unique id, e.g. BR-12"><Input id="bc" placeholder="e.g. BR-12" value={form.code} onChange={(e) => set("code", e.target.value)} /></Field>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Route name" htmlFor="bn"><Input id="bn" placeholder="e.g. Uttara Line" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="Area" htmlFor="ba"><Input id="ba" placeholder="e.g. Uttara" value={form.area} onChange={(e) => set("area", e.target.value)} /></Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Bus number" htmlFor="bno"><Input id="bno" placeholder="e.g. BUBT-07" value={form.busNo} onChange={(e) => set("busNo", e.target.value)} /></Field>
              <Field label="Days operated" htmlFor="bd"><Input id="bd" placeholder="e.g. Sat–Wed" value={form.days} onChange={(e) => set("days", e.target.value)} /></Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Route helper" htmlFor="bhn" hint="Optional"><Input id="bhn" placeholder="e.g. Md. Jasim" value={form.helperName} onChange={(e) => set("helperName", e.target.value)} /></Field>
              <Field label="Helper phone" htmlFor="bhp" hint="Optional"><Input id="bhp" placeholder="+8801XXXXXXXXX" value={form.helperPhone} onChange={(e) => set("helperPhone", e.target.value)} /></Field>
            </div>
            <Field label="Stops (origin → campus, one per line)" htmlFor="bs" hint="List in travel order toward campus.">
              <Textarea id="bs" rows={5} placeholder={"Uttara House Building\nAirport\n…\nBUBT Campus"} value={form.stops} onChange={(e) => set("stops", e.target.value)} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="To-campus departures" htmlFor="btd" hint="Comma-separated, 24h"><Input id="btd" placeholder="06:45, 07:30" value={form.toDepartures} onChange={(e) => set("toDepartures", e.target.value)} /></Field>
              <Field label="From-campus departures" htmlFor="bfd" hint="Comma-separated, 24h"><Input id="bfd" placeholder="16:30, 18:15" value={form.fromDepartures} onChange={(e) => set("fromDepartures", e.target.value)} /></Field>
            </div>
            <Field label="Friday / holiday note" htmlFor="bfn" hint="Shown on the route's service-details card."><Input id="bfn" placeholder="No service on Friday & government holidays." value={form.fridayNote} onChange={(e) => set("fridayNote", e.target.value)} /></Field>
          </Card>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate("/bus")}>Cancel</Button>
            <Button type="submit" icon="Check" disabled={saving}>{saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : (editing ? "Save changes" : "Add route")}</Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

// --- Dashboard widget -------------------------------------------------------
export function BusWidget() {
  const { busRoutes, savedBusRoutes } = useApp();
  const pool = savedBusRoutes.length ? busRoutes.filter((r) => savedBusRoutes.includes(r.id)) : busRoutes;
  const next = pool
    .map((r) => { const n = nextDeparture(r.toDepartures); return n ? { route: r, ...n } : null; })
    .filter(Boolean)
    .sort((a, b) => a.wait - b.wait)[0];
  if (!next) return null;
  return (
    <button onClick={() => navigate("/bus")} className="group flex w-full items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50/40">
      <AccentTile icon="Bus" tone="sky" size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">Next bus to campus</p>
        <p className="truncate text-xs text-slate-500">
          {next.route.name} · {fmtTime(minutesToHHMM(next.mins))} {next.tomorrow ? "(tomorrow)" : `· in ${fmtCountdown(next.wait)}`}
        </p>
      </div>
      <Icon name="ArrowRight" size={18} className="text-slate-300 group-hover:text-sky-500" />
    </button>
  );
}
