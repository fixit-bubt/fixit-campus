import React from "react";
import { Icon } from "../../components/Icon.jsx";
import {
  Button, Card, Badge, StatusBadge, Field, Input, Textarea, Select, FileUpload,
  EmptyState, Modal, Avatar, Spinner, Skeleton, StatCard, useToast,
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
import { fmtDate, relativeDate, todayISO } from "../../lib/helpers.js";

// ============================================================================
// FEATURE 1 — Bus Schedule  (signature accent: sky)
// Browse (next-departure hero + direction toggle + route cards),
// Detail (full timetable both directions), Admin form, dashboard widget.
// ============================================================================

// Compact route data — representative schedule derived from departures + leg gaps.
export const BUS_ROUTES = [
  {
    id: "BR-07", name: "Uttara Line", area: "Uttara", busNo: "BUBT-07",
    helperName: "Md. Jasim", helperPhone: "+8801712-554477",
    days: "Sat–Wed", fridayNote: "No service on Friday & government holidays.",
    stops: ["Uttara House Building", "Airport", "Khilkhet", "Mirpur-14", "Mirpur-12", "BUBT Campus"],
    legMins: [15, 15, 20, 10, 15],
    toDepartures: ["06:45", "07:30"], fromDepartures: ["16:30", "18:15"],
  },
  {
    id: "BR-03", name: "Mirpur Line", area: "Mirpur", busNo: "BUBT-03",
    helperName: "Sohel Rana", helperPhone: "+8801813-220099",
    days: "Sat–Wed", fridayNote: "No service on Friday & government holidays.",
    stops: ["Mirpur-1", "Mirpur-2", "Mirpur-10", "Mirpur-11", "Rupnagar", "BUBT Campus"],
    legMins: [8, 10, 8, 10, 7],
    toDepartures: ["07:00", "07:45"], fromDepartures: ["16:30", "17:45"],
  },
  {
    id: "BR-05", name: "Dhanmondi Line", area: "Dhanmondi", busNo: "BUBT-05",
    helperName: "Abdul Karim", helperPhone: "+8801911-778822",
    days: "Sat–Wed", fridayNote: "No service on Friday & government holidays.",
    stops: ["Dhanmondi 27", "Shyamoli", "Gabtoli", "Technical", "Mirpur-1", "BUBT Campus"],
    legMins: [12, 10, 8, 10, 12],
    toDepartures: ["06:50", "07:40"], fromDepartures: ["16:30", "18:00"],
  },
  {
    id: "BR-09", name: "Mohammadpur Line", area: "Mohammadpur", busNo: "BUBT-09",
    helperName: "Rasel Ahmed", helperPhone: "+8801677-334411",
    days: "Sat–Wed", fridayNote: "No service on Friday & government holidays.",
    stops: ["Mohammadpur Bus Stand", "Shyamoli Square", "Kallyanpur", "Mirpur-1", "Rupnagar", "BUBT Campus"],
    legMins: [10, 8, 10, 12, 8],
    toDepartures: ["07:00", "07:50"], fromDepartures: ["16:30", "17:50"],
  },
  {
    id: "BR-02", name: "Gulshan Line", area: "Gulshan", busNo: "BUBT-02",
    helperName: "Tanvir Hossain", helperPhone: "+8801556-990011",
    days: "Sat–Wed", fridayNote: "No service on Friday & government holidays.",
    stops: ["Gulshan-1", "Mohakhali", "Bijoy Sarani", "Agargaon", "Mirpur-10", "BUBT Campus"],
    legMins: [12, 10, 12, 12, 14],
    toDepartures: ["06:40", "07:30"], fromDepartures: ["16:30", "18:10"],
  },
  {
    id: "BR-11", name: "Savar Line", area: "Savar", busNo: "BUBT-11",
    helperName: "Mizanur Rahman", helperPhone: "+8801722-446688",
    days: "Sat–Wed", fridayNote: "No service on Friday & government holidays.",
    stops: ["Savar Bazar", "Hemayetpur", "Amin Bazar", "Gabtoli", "Technical", "BUBT Campus"],
    legMins: [15, 12, 12, 10, 12],
    toDepartures: ["06:30", "07:20"], fromDepartures: ["16:30", "17:40"],
  },
];

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

export function busById(id) {
  return BUS_ROUTES.find((r) => r.id === id);
}

// --- Route card -------------------------------------------------------------
export function BusRouteCard({ route, direction, saved, onToggleSave, onOpen }) {
  const departures = direction === "to" ? route.toDepartures : route.fromDepartures;
  const next = nextDeparture(departures);
  const sched = buildSchedule(route, direction, departures.findIndex((d) => toMinutes(d) === next.mins) >= 0 ? departures.findIndex((d) => toMinutes(d) === next.mins) : 0);
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
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Next departure</p>
          <p className="text-lg font-bold text-slate-900">{fmtTime(minutesToHHMM(next.mins))}</p>
        </div>
        <Badge tone="sky">{next.tomorrow ? "tomorrow" : `in ${fmtCountdown(next.wait)}`}</Badge>
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
  const [direction, setDirection] = React.useState("to");
  const [saved, setSaved] = useLocalState("fixit_bus_saved", []);
  const toggleSave = (id) => setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // hero: soonest departure across all routes for this direction
  const hero = BUS_ROUTES
    .map((r) => {
      const deps = direction === "to" ? r.toDepartures : r.fromDepartures;
      const n = nextDeparture(deps);
      return { route: r, ...n };
    })
    .sort((a, b) => a.wait - b.wait)[0];

  const sortedRoutes = [...BUS_ROUTES].sort((a, b) => {
    const as = saved.includes(a.id) ? 0 : 1;
    const bs = saved.includes(b.id) ? 0 : 1;
    return as - bs;
  });

  const heroStops = direction === "to" ? hero.route.stops : [...hero.route.stops].reverse();

  return (
    <AppShell activeKey="bus" title="Bus Schedule">
      <PageHeader title="Bus Schedule" subtitle="Campus shuttle routes, live departures, and timetables." />

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

      <div className="mt-6 flex items-center justify-between">
        <SegmentToggle
          options={[{ value: "to", label: "To Campus", icon: "ArrowRight" }, { value: "from", label: "From Campus", icon: "ArrowLeft" }]}
          value={direction}
          onChange={setDirection}
        />
        <span className="hidden text-sm text-slate-400 sm:block">{BUS_ROUTES.length} routes</span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedRoutes.map((r) => (
          <BusRouteCard
            key={r.id}
            route={r}
            direction={direction}
            saved={saved.includes(r.id)}
            onToggleSave={() => toggleSave(r.id)}
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
  const { currentUser } = useApp();
  const route = busById(id);
  const [direction, setDirection] = React.useState("to");

  if (!route) {
    return (
      <AppShell activeKey="bus" title="Route">
        <EmptyState icon="Bus" title="Route not found" message="This route may have changed." action={<Button onClick={() => navigate("/bus")}>Back to routes</Button>} />
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
          {currentUser.role === "Admin" && (
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
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <Icon name="TriangleAlert" size={14} className="mt-0.5 shrink-0" />
                {route.fridayNote}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900">Route helper</h3>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={route.helperName} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{route.helperName}</p>
                    <p className="truncate text-xs text-slate-500">{route.helperPhone}</p>
                  </div>
                </div>
                <a href={`https://wa.me/${route.helperPhone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700">
                  <Icon name="MessageCircle" size={15} /> Chat
                </a>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// --- Admin form -------------------------------------------------------------
export function BusRouteForm({ id }) {
  const { currentUser } = useApp();
  const toast = useToast();
  const editing = !!id;
  const existing = editing ? busById(id) : null;
  const [form, setForm] = React.useState(
    existing
      ? { name: existing.name, area: existing.area, busNo: existing.busNo, days: existing.days, toDepartures: existing.toDepartures.join(", "), fromDepartures: existing.fromDepartures.join(", "), stops: existing.stops.join("\n") }
      : { name: "", area: "", busNo: "", days: "Sat–Wed", toDepartures: "", fromDepartures: "", stops: "" }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  React.useEffect(() => {
    if (currentUser.role !== "Admin") navigate("/bus");
  }, [currentUser]);

  function submit(e) {
    e.preventDefault();
    toast({ type: "success", title: editing ? "Route updated" : "Route added", message: `${form.name || "Route"} saved.` });
    navigate(editing ? `/bus/${id}` : "/bus");
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
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Route name" htmlFor="bn"><Input id="bn" placeholder="e.g. Uttara Line" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="Area" htmlFor="ba"><Input id="ba" placeholder="e.g. Uttara" value={form.area} onChange={(e) => set("area", e.target.value)} /></Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Bus number" htmlFor="bno"><Input id="bno" placeholder="e.g. BUBT-07" value={form.busNo} onChange={(e) => set("busNo", e.target.value)} /></Field>
              <Field label="Days operated" htmlFor="bd"><Input id="bd" placeholder="e.g. Sat–Wed" value={form.days} onChange={(e) => set("days", e.target.value)} /></Field>
            </div>
            <Field label="Stops (origin → campus, one per line)" htmlFor="bs" hint="List in travel order toward campus.">
              <Textarea id="bs" rows={5} placeholder={"Uttara House Building\nAirport\n…\nBUBT Campus"} value={form.stops} onChange={(e) => set("stops", e.target.value)} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="To-campus departures" htmlFor="btd" hint="Comma-separated, 24h"><Input id="btd" placeholder="06:45, 07:30" value={form.toDepartures} onChange={(e) => set("toDepartures", e.target.value)} /></Field>
              <Field label="From-campus departures" htmlFor="bfd" hint="Comma-separated, 24h"><Input id="bfd" placeholder="16:30, 18:15" value={form.fromDepartures} onChange={(e) => set("fromDepartures", e.target.value)} /></Field>
            </div>
          </Card>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate("/bus")}>Cancel</Button>
            <Button type="submit" icon="Check">{editing ? "Save changes" : "Add route"}</Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

// --- Dashboard widget -------------------------------------------------------
export function BusWidget() {
  const [saved] = useLocalState("fixit_bus_saved", []);
  const pool = saved.length ? BUS_ROUTES.filter((r) => saved.includes(r.id)) : BUS_ROUTES;
  const next = pool
    .map((r) => ({ route: r, ...nextDeparture(r.toDepartures) }))
    .sort((a, b) => a.wait - b.wait)[0];
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
