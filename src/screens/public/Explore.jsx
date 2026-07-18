import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search, GraduationCap, CalendarDays, Bus, Moon, MapPin, Clock } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { Button, Badge, Card, Spinner, Avatar } from "../../components/ui.jsx";
import { Logo } from "../../components/Brand.jsx";
import { ThemeToggle } from "../../components/ThemeToggle.jsx";

// ============================================================================
// Public "explore without an account" screens: Faculty / Events / Bus & Prayer.
// Reference data only — RLS (0070) exposes these tables to anon with contact
// columns excluded, so every select() below lists columns explicitly:
// select('*') as anon fails with "permission denied for column".
// ============================================================================

const NAV = [
  { label: "Faculty", path: "/explore/faculty" },
  { label: "Events", path: "/explore/events" },
  { label: "Bus & Prayer", path: "/explore/campus" },
];

function ExploreShell({ active, children }) {
  const { currentUser, dashboardPath } = useApp();
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-brd topbar-blur backdrop-blur-md">
        <div className="relative flex items-center justify-between px-4 py-3 sm:px-6">
          <button onClick={() => navigate("/")} aria-label="FixIt home">
            <Logo />
          </button>
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
            {NAV.map((l) => (
              <button
                key={l.path}
                onClick={() => navigate(l.path)}
                className={`rounded-md px-3 py-2 text-base font-semibold transition-colors ${
                  active === l.path ? "bg-brand-50 text-brand" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {l.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {currentUser ? (
              <Button onClick={() => navigate(dashboardPath(currentUser.role))} iconRight={ArrowRight}>
                Go to dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate("/login")}>Log In</Button>
                <Button onClick={() => navigate("/register")}>Sign Up</Button>
              </>
            )}
          </div>
        </div>
        {/* Mobile nav row */}
        <div className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {NAV.map((l) => (
            <button
              key={l.path}
              onClick={() => navigate(l.path)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
                active === l.path ? "bg-brand-50 text-brand" : "text-ink-2 hover:bg-surface-2"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 2xl:max-w-[96rem]">{children}</main>

      {!currentUser && (
        <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 2xl:max-w-[96rem]">
          <Card className="flex flex-col items-center justify-between gap-4 p-6 text-center sm:flex-row sm:text-left">
            <div>
              <p className="text-lg font-bold text-ink">You're browsing as a guest.</p>
              <p className="mt-1 text-base text-ink-2">
                Sign up with to report issues, save faculty, RSVP to events, and use the marketplace, Study Hub and more.
              </p>
            </div>
            <Button className="shrink-0 px-5" onClick={() => navigate("/register")} iconRight={ArrowRight}>
              Create free account
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}

// Shared tiny fetch helper: run once on mount, surface loading/error.
function useAnonQuery(fetcher) {
  const [state, setState] = useState({ loading: true, error: false, data: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    fetcher().then(
      (data) => alive && setState({ loading: false, error: false, data }),
      () => alive && setState({ loading: false, error: true, data: null })
    );
    return () => { alive = false; };
  }, [tick]);
  return { ...state, retry: () => setTick((t) => t + 1) };
}

function LoadState({ loading, error, retry, children }) {
  if (loading) return <div className="flex justify-center py-24"><Spinner size={26} /></div>;
  if (error) {
    return (
      <div className="py-24 text-center">
        <p className="text-lg font-semibold text-ink">Couldn't load this page.</p>
        <p className="mt-1 text-base text-ink-3">Check your connection and try again.</p>
        <Button className="mt-4" onClick={retry}>Retry</Button>
      </div>
    );
  }
  return children;
}

function PageHead({ Icon, title, sub }) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-100 text-brand-700">
        <Icon size={22} />
      </span>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-base text-ink-2">{sub}</p>
      </div>
    </div>
  );
}

// 'HH:MM' -> '5:40 PM'
function fmt12(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Faculty
// ---------------------------------------------------------------------------
export function PublicFaculty() {
  const q = useAnonQuery(async () => {
    const [{ data: depts, error: e1 }, { data: fac, error: e2 }] = await Promise.all([
      supabase.from("departments").select("id, name, branch, dept_number").order("name"),
      supabase
        .from("faculty")
        .select("id, department_id, name, designation, photo_url, research_interests, on_leave, is_chairman")
        .order("name"),
    ]);
    if (e1 || e2) throw e1 || e2;
    return { depts: depts || [], fac: fac || [] };
  });
  const [search, setSearch] = useState("");
  const [deptId, setDeptId] = useState("all");

  const deptById = useMemo(() => {
    const m = {};
    for (const d of q.data?.depts || []) m[d.id] = d;
    return m;
  }, [q.data]);

  const filtered = useMemo(() => {
    let list = q.data?.fac || [];
    if (deptId !== "all") list = list.filter((f) => f.department_id === deptId);
    const s = search.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(s) ||
          f.designation.toLowerCase().includes(s) ||
          (f.research_interests || []).some((r) => r.toLowerCase().includes(s))
      );
    }
    return list;
  }, [q.data, deptId, search]);

  return (
    <ExploreShell active="/explore/faculty">
      <PageHead
        Icon={GraduationCap}
        title="Faculty Directory"
        sub={`Browse ${q.data ? q.data.fac.length : "400+"} BUBT teachers across ${q.data ? q.data.depts.length : 13} departments — no account needed.`}
      />
      <LoadState {...q}>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, designation, or research area…"
              className="h-11 w-full rounded-md border border-brd bg-surface pl-9 pr-3 text-base text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
            />
          </div>
          <select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="h-11 rounded-md border border-brd bg-surface px-3 text-base text-ink focus:border-brand focus:outline-none sm:w-72"
          >
            <option value="all">All departments</option>
            {(q.data?.depts || []).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-base text-ink-3">No faculty match that search.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((f) => (
              <Card key={f.id} className="flex items-start gap-4 p-5">
                <Avatar name={f.name} src={f.photo_url} size={52} />
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-ink">
                    {f.name}
                    {f.is_chairman && <Badge tone="blue" className="ml-2 align-middle">Chairman</Badge>}
                    {f.on_leave && <Badge tone="amber" className="ml-2 align-middle">On leave</Badge>}
                  </p>
                  <p className="truncate text-base text-ink-2">{f.designation}</p>
                  <p className="truncate text-sm text-ink-3">{deptById[f.department_id]?.name || "—"}</p>
                  {(f.research_interests || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {f.research_interests.slice(0, 3).map((r) => (
                        <span key={r} className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-semibold text-ink-2">{r}</span>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </LoadState>
    </ExploreShell>
  );
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
const CATEGORY_TONE = { Academic: "blue", Cultural: "purple", Sports: "emerald", Club: "violet", Career: "amber" };

export function PublicEvents() {
  const q = useAnonQuery(async () => {
    const { data, error } = await supabase
      .from("events")
      .select("id, code, title, category, organizer, date, time, end_time, venue, description, banner_url")
      .order("date", { ascending: true });
    if (error) throw error;
    return data || [];
  });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (q.data || []).filter((e) => e.date >= today);
  const past = (q.data || []).length - upcoming.length;

  return (
    <ExploreShell active="/explore/events">
      <PageHead
        Icon={CalendarDays}
        title="Campus Events"
        sub="Upcoming academic, cultural, sports, club, and career events at BUBT."
      />
      <LoadState {...q}>
        {upcoming.length === 0 ? (
          <p className="py-16 text-center text-base text-ink-3">
            No upcoming events right now{past > 0 ? ` (${past} past events not shown)` : ""}. Check back soon.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map((e) => (
              <Card key={e.id} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <Badge tone={CATEGORY_TONE[e.category] || "neutral"}>{e.category}</Badge>
                  <span className="text-sm font-semibold text-ink-3">{fmtDate(e.date)}</span>
                </div>
                <h3 className="mt-3 text-xl font-bold text-ink">{e.title}</h3>
                <p className="mt-0.5 text-base text-ink-2">by {e.organizer}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-3">
                  <span className="inline-flex items-center gap-1.5"><Clock size={13} />{fmt12(e.time)}{e.end_time ? ` – ${fmt12(e.end_time)}` : ""}</span>
                  <span className="inline-flex items-center gap-1.5"><MapPin size={13} />{e.venue}</span>
                </div>
                <p className="mt-3 text-base leading-relaxed text-ink-2 line-clamp-2">{e.description}</p>
              </Card>
            ))}
          </div>
        )}
      </LoadState>
    </ExploreShell>
  );
}

// ---------------------------------------------------------------------------
// Bus & Prayer
// ---------------------------------------------------------------------------
export function PublicTransit() {
  const q = useAnonQuery(async () => {
    const [{ data: routes, error: e1 }, { data: prayers, error: e2 }, { data: musallahs, error: e3 }] = await Promise.all([
      supabase
        .from("bus_routes")
        .select("id, name, area, bus_no, days, friday_note, stops, to_departures, from_departures, active")
        .eq("active", true)
        .order("id"),
      supabase.from("prayer_times").select("key, en, ar, azan, jamaat, sort").order("sort"),
      supabase.from("musallah_locations").select("id, name, floor_desc, sort").order("sort"),
    ]);
    if (e1 || e2 || e3) throw e1 || e2 || e3;
    return { routes: routes || [], prayers: prayers || [], musallahs: musallahs || [] };
  });

  return (
    <ExploreShell active="/explore/campus">
      <PageHead
        Icon={Bus}
        title="Bus Schedule & Prayer Times"
        sub="Daily shuttle departures and today's azan & jamaat times on campus."
      />
      <LoadState {...q}>
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Bus routes */}
          <section>
            <h2 className="mb-3 text-xl font-bold text-ink">Bus routes</h2>
            {(q.data?.routes || []).length === 0 ? (
              <p className="py-10 text-center text-base text-ink-3">No active routes published.</p>
            ) : (
              <div className="grid gap-4">
                {q.data.routes.map((r) => (
                  <Card key={r.id} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-lg font-bold text-ink">{r.name} <span className="font-semibold text-ink-3">· {r.area}</span></p>
                      <Badge tone="neutral">{r.id}{r.bus_no ? ` · Bus ${r.bus_no}` : ""}</Badge>
                    </div>
                    {(r.stops || []).length > 0 && (
                      <p className="mt-2 text-base text-ink-2">{r.stops.join(" → ")}</p>
                    )}
                    <div className="mt-3 grid gap-2 text-sm text-ink-3 sm:grid-cols-2">
                      <p><span className="font-bold text-ink-2">To campus:</span> {(r.to_departures || []).map(fmt12).join(", ") || "—"}</p>
                      <p><span className="font-bold text-ink-2">From campus:</span> {(r.from_departures || []).map(fmt12).join(", ") || "—"}</p>
                    </div>
                    <p className="mt-2 text-sm text-ink-3">
                      {(r.days || []).join(", ")}{r.friday_note ? ` · ${r.friday_note}` : ""}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Prayer times */}
          <section>
            <h2 className="mb-3 inline-flex items-center gap-2 text-xl font-bold text-ink"><Moon size={18} /> Prayer times</h2>
            <Card className="overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-brd bg-surface-2 text-sm text-ink-3">
                    <th className="px-4 py-2.5 font-bold">Prayer</th>
                    <th className="px-4 py-2.5 font-bold">Azan</th>
                    <th className="px-4 py-2.5 font-bold">Jamaat</th>
                  </tr>
                </thead>
                <tbody>
                  {(q.data?.prayers || []).map((p) => (
                    <tr key={p.key} className="border-b border-brd last:border-0">
                      <td className="px-4 py-2.5 text-base font-semibold text-ink">{p.en} <span className="text-ink-3">{p.ar}</span></td>
                      <td className="px-4 py-2.5 text-base text-ink-2">{fmt12(p.azan)}</td>
                      <td className="px-4 py-2.5 text-base font-semibold text-brand">{fmt12(p.jamaat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            {(q.data?.musallahs || []).length > 0 && (
              <div className="mt-4 grid gap-3">
                {q.data.musallahs.map((m) => (
                  <Card key={m.id} className="flex items-center gap-3 p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-100 text-brand-700"><MapPin size={16} /></span>
                    <div>
                      <p className="text-base font-bold text-ink">{m.name}</p>
                      <p className="text-sm text-ink-3">{m.floor_desc}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </LoadState>
    </ExploreShell>
  );
}
