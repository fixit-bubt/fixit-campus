import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search, GraduationCap, CalendarDays, Bus, Moon, MapPin, Clock, FileText, CalendarRange, ExternalLink, Megaphone, Pin, Paperclip, Calculator, Plus, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { Button, Badge, Card, Spinner, Avatar } from "../../components/ui.jsx";
import { Logo } from "../../components/Brand.jsx";
import { ThemeToggle } from "../../components/ThemeToggle.jsx";
import { CoverPageBody } from "../coverpage/CoverPage.jsx";

// ============================================================================
// Public "explore without an account" screens: Faculty / Events / Bus & Prayer.
// Reference data only — RLS (0070) exposes these tables to anon with contact
// columns excluded, so every select() below lists columns explicitly:
// select('*') as anon fails with "permission denied for column".
// ============================================================================

export const EXPLORE_NAV = [
  { label: "Faculty", path: "/explore/faculty" },
  { label: "Events", path: "/explore/events" },
  { label: "Notices", path: "/explore/announcements" },
  { label: "Calendar", path: "/explore/calendar" },
  { label: "Bus", path: "/explore/bus" },
  { label: "Prayer", path: "/explore/prayer" },
  { label: "Routines", path: "/explore/routines" },
  { label: "Cover Page", path: "/explore/cover-page" },
  { label: "CGPA", path: "/explore/cgpa" },
];
const NAV = EXPLORE_NAV;

function ExploreShell({ active, children }) {
  const { currentUser, dashboardPath } = useApp();
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-brd topbar-blur backdrop-blur-md">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <button onClick={() => navigate("/")} aria-label="FixIt home">
            <Logo />
          </button>
          <nav className="hidden flex-1 items-center justify-evenly px-8 xl:flex">
            {NAV.map((l) => (
              <button
                key={l.path}
                onClick={() => navigate(l.path)}
                className={`rounded-md px-2.5 py-2 text-[15px] font-semibold transition-colors ${
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
        {/* Mobile / tablet nav row */}
        <div className="flex gap-1 overflow-x-auto px-4 pb-2 xl:hidden">
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
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// Local (not UTC) 'YYYY-MM-DD' — the DB dates are calendar days in Dhaka time,
// so upcoming/past splits must compare against the local day, not toISOString().
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
          <p className="py-16 text-center text-base text-ink-3">
            {(q.data?.fac || []).length === 0 ? "No faculty listed yet." : "No faculty match that search."}
          </p>
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

  const today = todayLocal();
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
// Bus schedule
// ---------------------------------------------------------------------------
export function PublicBus() {
  const q = useAnonQuery(async () => {
    const { data, error } = await supabase
      .from("bus_routes")
      .select("id, name, area, bus_no, days, friday_note, stops, to_departures, from_departures, active")
      .eq("active", true)
      .order("id");
    if (error) throw error;
    return data || [];
  });

  return (
    <ExploreShell active="/explore/bus">
      <PageHead Icon={Bus} title="Bus Schedule" sub="Daily shuttle routes, stops, and departure times." />
      <LoadState {...q}>
        {(q.data || []).length === 0 ? (
          <p className="py-16 text-center text-base text-ink-3">No active routes published.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {q.data.map((r) => (
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
      </LoadState>
    </ExploreShell>
  );
}

// ---------------------------------------------------------------------------
// Prayer times
// ---------------------------------------------------------------------------
export function PublicPrayer() {
  const q = useAnonQuery(async () => {
    const [{ data: prayers, error: e1 }, { data: musallahs, error: e2 }] = await Promise.all([
      supabase.from("prayer_times").select("key, en, ar, azan, jamaat, sort").order("sort"),
      supabase.from("musallah_locations").select("id, name, floor_desc, sort").order("sort"),
    ]);
    if (e1 || e2) throw e1 || e2;
    return { prayers: prayers || [], musallahs: musallahs || [] };
  });

  return (
    <ExploreShell active="/explore/prayer">
      <PageHead Icon={Moon} title="Prayer Times" sub="Today's azan & jamaat times, and where to pray on campus." />
      <LoadState {...q}>
        <div className="mx-auto grid max-w-3xl gap-6">
          {(q.data?.prayers || []).length === 0 ? (
            <p className="py-16 text-center text-base text-ink-3">Prayer times haven't been published yet.</p>
          ) : (
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
          )}
          {(q.data?.musallahs || []).length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
      </LoadState>
    </ExploreShell>
  );
}

// ---------------------------------------------------------------------------
// Class & exam routines
// ---------------------------------------------------------------------------
export function PublicRoutines() {
  const q = useAnonQuery(async () => {
    const { data, error } = await supabase
      .from("routines")
      .select("id, type, title, department, semester, intake, section, file_url, image_url, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  });
  const [type, setType] = useState("all");
  const [dept, setDept] = useState("all");

  const depts = useMemo(
    () => [...new Set((q.data || []).map((r) => r.department).filter(Boolean))].sort(),
    [q.data]
  );
  const filtered = (q.data || []).filter(
    (r) => (type === "all" || r.type === type) && (dept === "all" || r.department === dept)
  );

  return (
    <ExploreShell active="/explore/routines">
      <PageHead Icon={CalendarRange} title="Class & Exam Routines" sub="Latest routine files published by the departments." />
      <LoadState {...q}>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-md border border-brd bg-surface p-1">
            {[["all", "All"], ["class", "Class"], ["exam", "Exam"]].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setType(v)}
                className={`rounded-sm px-3 py-1.5 text-sm font-semibold ${
                  type === v ? "bg-brand text-white" : "text-ink-2 hover:bg-surface-2"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {depts.length > 0 && (
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="h-10 rounded-md border border-brd bg-surface px-3 text-base text-ink focus:border-brand focus:outline-none"
            >
              <option value="all">All departments</option>
              {depts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-base text-ink-3">No routines published yet. Check back soon.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => {
              const href = r.file_url || r.image_url;
              return (
                <Card key={r.id} className="flex flex-col p-5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={r.type === "exam" ? "amber" : "blue"}>{r.type === "exam" ? "Exam" : "Class"}</Badge>
                    <span className="text-xs font-semibold text-ink-3">{fmtDate(r.created_at.slice(0, 10))}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-ink">{r.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[r.department, r.semester, r.intake && `Intake ${r.intake}`, r.section && `Sec ${r.section}`]
                      .filter(Boolean)
                      .map((chip) => (
                        <span key={chip} className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-semibold text-ink-2">{chip}</span>
                      ))}
                  </div>
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-base font-bold text-white hover:bg-brand-700"
                    >
                      <ExternalLink size={15} /> Open routine
                    </a>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </LoadState>
    </ExploreShell>
  );
}

// ---------------------------------------------------------------------------
// Cover page generator (full generator, guest edition)
// ---------------------------------------------------------------------------
export function PublicCoverPage() {
  const { currentUser } = useApp();
  const q = useAnonQuery(async () => {
    const [{ data: depts, error: e1 }, { data: fac, error: e2 }] = await Promise.all([
      supabase.from("departments").select("id, name").order("name"),
      supabase.from("faculty").select("id, department_id, name, designation, photo_url").order("name"),
    ]);
    if (e1 || e2) throw e1 || e2;
    return {
      departments: depts || [],
      // CoverPageBody expects the store's camelCase faculty shape.
      faculty: (fac || []).map((f) => ({
        id: f.id, name: f.name, designation: f.designation,
        departmentId: f.department_id, photo: f.photo_url,
      })),
    };
  });

  return (
    <ExploreShell active="/explore/cover-page">
      <PageHead
        Icon={FileText}
        title="Cover Page Generator"
        sub="BUBT assignment, lab, project, index & internship cover pages — print or save as PDF. Free, no account needed."
      />
      <LoadState {...q}>
        <CoverPageBody
          currentUser={currentUser}
          faculty={q.data?.faculty || []}
          departments={q.data?.departments || []}
        />
      </LoadState>
    </ExploreShell>
  );
}

// ---------------------------------------------------------------------------
// Announcements (official notices)
// ---------------------------------------------------------------------------
const PRIORITY_TONE = { Urgent: "red", Important: "amber", General: "neutral" };

export function PublicAnnouncements() {
  const q = useAnonQuery(async () => {
    const { data, error } = await supabase
      .from("announcements")
      .select("id, code, title, body, department, priority, pinned, attachment_url, created_at")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  });

  return (
    <ExploreShell active="/explore/announcements">
      <PageHead Icon={Megaphone} title="Announcements" sub="Official notices from the university and departments." />
      <LoadState {...q}>
        {(q.data || []).length === 0 ? (
          <p className="py-16 text-center text-base text-ink-3">No announcements posted yet. Check back soon.</p>
        ) : (
          <div className="mx-auto grid max-w-3xl gap-4">
            {q.data.map((a) => (
              <Card key={a.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {a.pinned && <Badge tone="blue" icon={Pin}>Pinned</Badge>}
                  <Badge tone={PRIORITY_TONE[a.priority] || "neutral"}>{a.priority}</Badge>
                  <span className="text-sm font-semibold text-ink-3">{a.department}</span>
                  <span className="ml-auto text-sm text-ink-3">{fmtDate(a.created_at.slice(0, 10))}</span>
                </div>
                <h3 className="mt-3 text-xl font-bold text-ink">{a.title}</h3>
                <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-ink-2">{a.body}</p>
                {a.attachment_url && (
                  <a
                    href={a.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-base font-semibold text-brand hover:underline"
                  >
                    <Paperclip size={15} /> View attachment
                  </a>
                )}
              </Card>
            ))}
          </div>
        )}
      </LoadState>
    </ExploreShell>
  );
}

// ---------------------------------------------------------------------------
// Academic calendar
// ---------------------------------------------------------------------------
const CAL_TONE = { holiday: "emerald", exam: "red", semester: "blue", general: "neutral" };
const CAL_LABEL = { holiday: "Holiday", exam: "Exam", semester: "Semester", general: "General" };

export function PublicCalendar() {
  const q = useAnonQuery(async () => {
    const { data, error } = await supabase
      .from("academic_calendar")
      .select("id, title, description, event_date, end_date, event_type")
      .order("event_date", { ascending: true });
    if (error) throw error;
    return data || [];
  });
  const [type, setType] = useState("all");

  const today = todayLocal();
  const filtered = (q.data || []).filter((e) => type === "all" || e.event_type === type);
  const upcoming = filtered.filter((e) => (e.end_date || e.event_date) >= today);
  const past = filtered.filter((e) => (e.end_date || e.event_date) < today);

  const row = (e) => (
    <Card key={e.id} className="flex items-start gap-4 p-4">
      <div className="w-16 shrink-0 text-center">
        <div className="text-2xl font-extrabold leading-none text-ink">{new Date(e.event_date + "T00:00:00").getDate()}</div>
        <div className="text-xs font-semibold uppercase text-ink-3">
          {new Date(e.event_date + "T00:00:00").toLocaleDateString("en-GB", { month: "short" })}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={CAL_TONE[e.event_type] || "neutral"}>{CAL_LABEL[e.event_type] || e.event_type}</Badge>
          {e.end_date && e.end_date !== e.event_date && (
            <span className="text-sm text-ink-3">until {fmtDate(e.end_date)}</span>
          )}
        </div>
        <h3 className="mt-1.5 text-lg font-bold text-ink">{e.title}</h3>
        {e.description && <p className="mt-0.5 text-base text-ink-2">{e.description}</p>}
      </div>
    </Card>
  );

  return (
    <ExploreShell active="/explore/calendar">
      <PageHead Icon={CalendarDays} title="Academic Calendar" sub="Holidays, exam periods, and semester dates." />
      <LoadState {...q}>
        <div className="mb-6 flex flex-wrap gap-1 rounded-md border border-brd bg-surface p-1">
          {[["all", "All"], ["semester", "Semester"], ["exam", "Exams"], ["holiday", "Holidays"], ["general", "General"]].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setType(v)}
              className={`rounded-sm px-3 py-1.5 text-sm font-semibold ${
                type === v ? "bg-brand text-white" : "text-ink-2 hover:bg-surface-2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-base text-ink-3">No calendar entries yet. Check back soon.</p>
        ) : (
          <div className="mx-auto max-w-3xl space-y-8">
            {upcoming.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-3">Upcoming</h2>
                <div className="grid gap-3">{upcoming.map(row)}</div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-3">Earlier</h2>
                <div className="grid gap-3 opacity-70">{past.map(row)}</div>
              </section>
            )}
          </div>
        )}
      </LoadState>
    </ExploreShell>
  );
}

// ---------------------------------------------------------------------------
// CGPA calculator — pure client tool, no database, no login
// ---------------------------------------------------------------------------
// BUBT / UGC Bangladesh uniform grading scale.
const GRADE_POINTS = [
  ["A+", 4.0], ["A", 3.75], ["A-", 3.5], ["B+", 3.25], ["B", 3.0],
  ["B-", 2.75], ["C+", 2.5], ["C", 2.25], ["D", 2.0], ["F", 0.0],
];
const GRADE_MAP = Object.fromEntries(GRADE_POINTS);

export function PublicCGPA() {
  const [rows, setRows] = useState([
    { id: 1, name: "", credit: "3", grade: "A" },
    { id: 2, name: "", credit: "3", grade: "A" },
    { id: 3, name: "", credit: "3", grade: "A" },
  ]);
  const nextId = React.useRef(4);

  const addRow = () => setRows((r) => [...r, { id: nextId.current++, name: "", credit: "3", grade: "A" }]);
  const removeRow = (id) => setRows((r) => (r.length > 1 ? r.filter((x) => x.id !== id) : r));
  const update = (id, patch) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const { gpa, totalCredits } = useMemo(() => {
    let qp = 0, cr = 0;
    for (const r of rows) {
      const c = parseFloat(r.credit);
      if (!Number.isFinite(c) || c <= 0) continue;
      const p = GRADE_MAP[r.grade];
      if (p === undefined) continue;
      qp += c * p;
      cr += c;
    }
    return { gpa: cr > 0 ? qp / cr : 0, totalCredits: cr };
  }, [rows]);

  return (
    <ExploreShell active="/explore/cgpa">
      <PageHead Icon={Calculator} title="CGPA Calculator" sub="Add your courses, credits, and grades to get your GPA — BUBT grading scale." />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="p-5">
          <div className="hidden gap-3 px-1 pb-2 text-sm font-bold text-ink-3 sm:grid sm:grid-cols-[1fr_90px_110px_40px]">
            <span>Course (optional)</span><span>Credit</span><span>Grade</span><span></span>
          </div>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_70px_90px_40px] gap-2 sm:grid-cols-[1fr_90px_110px_40px]">
                <input
                  value={r.name}
                  onChange={(e) => update(r.id, { name: e.target.value })}
                  placeholder="e.g. CSE 101"
                  className="h-11 rounded-md border border-brd bg-surface px-3 text-base text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
                />
                <input
                  value={r.credit}
                  onChange={(e) => update(r.id, { credit: e.target.value })}
                  inputMode="decimal"
                  className="h-11 rounded-md border border-brd bg-surface px-3 text-base text-ink focus:border-brand focus:outline-none"
                />
                <select
                  value={r.grade}
                  onChange={(e) => update(r.id, { grade: e.target.value })}
                  className="h-11 rounded-md border border-brd bg-surface px-2 text-base text-ink focus:border-brand focus:outline-none"
                >
                  {GRADE_POINTS.map(([g, p]) => <option key={g} value={g}>{g} ({p.toFixed(2)})</option>)}
                </select>
                <button
                  onClick={() => removeRow(r.id)}
                  aria-label="Remove course"
                  className="inline-flex h-11 w-10 items-center justify-center rounded-md border border-brd text-ink-3 hover:bg-surface-2 hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <Button variant="secondary" icon={Plus} onClick={addRow} className="mt-4">Add course</Button>
        </Card>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6 text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-ink-3">Your GPA</p>
            <p className="mt-2 text-5xl font-extrabold tabular-nums text-brand">{gpa.toFixed(2)}</p>
            <p className="mt-2 text-base text-ink-2">{totalCredits} credit{totalCredits === 1 ? "" : "s"} across {rows.length} course{rows.length === 1 ? "" : "s"}</p>
            <p className="mt-4 text-xs leading-relaxed text-ink-3">
              Weighted by credit hours on the BUBT scale (A+ = 4.00). Calculated in your browser — nothing is saved or sent.
            </p>
          </Card>
        </div>
      </div>
    </ExploreShell>
  );
}
