import React from "react";
import { Icon } from "../../components/Icon.jsx";
import {
  Button, Card, Badge, EmptyState, Avatar, Loading, useToast,
} from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { AccentTile } from "../../components/featureKit.jsx";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";

// ============================================================================
// FEATURE — Faculty Directory  (signature accent: indigo)
// Browse BUBT teachers by department, search by name, filter by research area
// ("find a supervisor"), view a full in-app profile, email, and bookmark.
// Data is live reference data (public.departments / public.faculty, seeded in
// 0031–0032); bookmarks are per-user (public.faculty_bookmarks). Read via
// useApp().departments / faculty / facultyBookmarks.
// ============================================================================

const ACCENT = "indigo";

// One icon per faculty/branch — the tone stays indigo everywhere (one signature
// accent per feature); only the glyph varies to give departments visual texture.
const BRANCH_ICON = {
  "Engineering & Applied Sciences": "Cpu",
  "Business": "Briefcase",
  "Science / Social Sciences": "Sigma",
  "Arts & Humanities": "BookOpenText",
  "Social Sciences": "Globe",
  "Law": "Scale",
};

const BRANCH_ORDER = [
  "Engineering & Applied Sciences",
  "Business",
  "Science / Social Sciences",
  "Arts & Humanities",
  "Social Sciences",
  "Law",
];

// Academic link metadata — order defines display order on the profile.
const LINK_META = {
  scholar: { label: "Google Scholar", icon: "GraduationCap" },
  researchgate: { label: "ResearchGate", icon: "BookOpen" },
  orcid: { label: "ORCID", icon: "Fingerprint" },
  website: { label: "Website", icon: "Globe" },
};

const shortDept = (name) => (name || "").replace(/^Department of\s+/i, "");

// Rank order for listing faculty within a department (chairman always first).
function rankIndex(desig = "") {
  const d = desig.toLowerCase();
  if (d.includes("associate professor")) return 2;
  if (d.includes("assistant professor")) return 3;
  if (d.includes("adjunct") || d.includes("visiting")) return 4;
  if (d.includes("professor")) return 1;
  if (d.includes("senior lecturer")) return 5;
  if (d.includes("lecturer")) return 6;
  if (d.includes("teaching assistant")) return 7;
  if (d.includes("demonstrator")) return 8;
  return 9;
}
function sortFaculty(list) {
  return [...list].sort((a, b) => {
    if (a.isChairman !== b.isChairman) return a.isChairman ? -1 : 1;
    const r = rankIndex(a.designation) - rankIndex(b.designation);
    if (r !== 0) return r;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}

// --- Save (bookmark) star -----------------------------------------------------
function SaveStar({ saved, onClick }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={saved ? "Saved" : "Save teacher"}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
        saved ? "text-warn hover:bg-warn-bg" : "text-ink-3 hover:bg-surface-2 hover:text-ink-3"
      }`}
    >
      <Icon name="Star" size={18} className={saved ? "fill-amber-400" : ""} />
    </button>
  );
}

function PersonBadges({ f }) {
  if (!f.isChairman && !f.onLeave) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {f.isChairman && <Badge tone="blue" icon="Crown">Chairman</Badge>}
      {f.onLeave && <Badge tone="amber" icon="PlaneTakeoff">On leave</Badge>}
    </div>
  );
}

// --- Faculty card -------------------------------------------------------------
function FacultyCard({ f, dept, saved, onToggleSave }) {
  const open = () => navigate(`/faculty/${f.id}`);
  return (
    <Card className="group flex flex-col p-5">
      <div className="flex items-start gap-3">
        <button onClick={open} className="shrink-0" title={`View ${f.name}`}>
          <Avatar name={f.name} src={f.photo} size={52} />
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={open} className="block max-w-full text-left">
            <p className="truncate text-base font-semibold text-ink group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{f.name}</p>
          </button>
          <p className="mt-0.5 truncate text-xs text-ink-3">{f.designation}</p>
          {dept && <p className="mt-0.5 truncate text-xs text-ink-3">{shortDept(dept.name)}</p>}
        </div>
        <SaveStar saved={saved} onClick={onToggleSave} />
      </div>

      <PersonBadges f={f} />

      {f.interests.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {f.interests.slice(0, 3).map((i) => (
            <span key={i} className="rounded-full bg-indigo-50 dark:bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">{i}</span>
          ))}
          {f.interests.length > 3 && (
            <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-3">+{f.interests.length - 3}</span>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-brd pt-3">
        {f.email ? (
          <a
            href={`mailto:${f.email}`}
            onClick={(e) => e.stopPropagation()}
            title={f.email}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-indigo-700 dark:hover:text-indigo-300"
          >
            <Icon name="Mail" size={14} /> Email
          </a>
        ) : <span className="text-xs text-ink-3">No email listed</span>}
        <Button size="sm" variant="secondary" iconRight="ArrowRight" onClick={open}>Profile</Button>
      </div>
    </Card>
  );
}

// --- Department card ----------------------------------------------------------
function DepartmentCard({ dept, count }) {
  return (
    <button
      onClick={() => navigate(`/faculty/dept/${dept.deptNumber}`)}
      className="group flex items-center gap-4 rounded-md border border-brd bg-surface p-5 text-left shadow-sm transition-colors hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10"
    >
      <AccentTile icon={BRANCH_ICON[dept.branch] || "GraduationCap"} tone={ACCENT} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-ink">{shortDept(dept.name)}</p>
        <p className="mt-0.5 truncate text-xs text-ink-3">{count} teacher{count === 1 ? "" : "s"}</p>
      </div>
      <Icon name="ArrowRight" size={18} className="text-ink-3 group-hover:text-indigo-500 dark:group-hover:text-indigo-300" />
    </button>
  );
}

// --- Search field -------------------------------------------------------------
function SearchField({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Icon name="Search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border border-brd bg-surface pl-10 pr-10 text-base text-ink placeholder:text-ink-3 transition-colors focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-sm text-ink-3 hover:bg-surface-2 hover:text-ink-2"
        >
          <Icon name="X" size={15} />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Browse / directory
// ============================================================================
export function FacultyDirectory() {
  const { departments, faculty, facultyBookmarks, departmentById, toggleFacultyBookmark, dataLoading } = useApp();
  const [query, setQuery] = React.useState("");
  const [interest, setInterest] = React.useState(null);
  const toast = useToast();

  const onToggleSave = async (id, name) => {
    const saved = facultyBookmarks.includes(id);
    const r = await toggleFacultyBookmark(id);
    if (!r.ok) toast({ type: "error", title: "Couldn't update", message: r.error });
    else toast({ type: "success", title: saved ? "Removed from saved" : "Saved", message: name });
  };

  // Per-department headcounts (from the loaded faculty rows).
  const countByDept = React.useMemo(() => {
    const m = {};
    faculty.forEach((f) => { m[f.departmentId] = (m[f.departmentId] || 0) + 1; });
    return m;
  }, [faculty]);

  // Most common research areas → "find a supervisor" filter chips.
  const popularInterests = React.useMemo(() => {
    const counts = new Map();
    faculty.forEach((f) => f.interests.forEach((i) => {
      const key = i.trim().toLowerCase();
      if (!key) return;
      const cur = counts.get(key) || { label: i.trim(), n: 0 };
      cur.n += 1;
      counts.set(key, cur);
    }));
    return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 14);
  }, [faculty]);

  const q = query.trim().toLowerCase();
  const filtering = q.length > 0 || !!interest;

  const results = React.useMemo(() => {
    if (!filtering) return [];
    let list = faculty;
    if (interest) {
      const si = interest.toLowerCase();
      list = list.filter((f) => (f.interests ?? []).some((i) => (i ?? "").toLowerCase() === si));
    }
    if (q) {
      list = list.filter((f) =>
        (f.name ?? "").toLowerCase().includes(q) ||
        (f.designation ?? "").toLowerCase().includes(q) ||
        (f.interests ?? []).some((i) => (i ?? "").toLowerCase().includes(q))
      );
    }
    return sortFaculty(list);
  }, [faculty, q, interest, filtering]);

  // Departments grouped by branch (only branches that exist), each sorted big→small.
  const branches = React.useMemo(() => {
    const byBranch = {};
    departments.forEach((d) => { (byBranch[d.branch] ||= []).push(d); });
    const order = [...BRANCH_ORDER, ...Object.keys(byBranch).filter((b) => !BRANCH_ORDER.includes(b))];
    return order
      .filter((b) => byBranch[b])
      .map((b) => ({
        branch: b,
        depts: byBranch[b].sort((a, c) => (countByDept[c.id] || 0) - (countByDept[a.id] || 0)),
      }));
  }, [departments, countByDept]);

  const savedCount = facultyBookmarks.length;
  const headerAction = (
    <Button variant="secondary" icon="Star" onClick={() => navigate("/faculty/saved")}>
      Saved{savedCount ? ` · ${savedCount}` : ""}
    </Button>
  );

  if (dataLoading && faculty.length === 0) {
    return (
      <AppShell activeKey="faculty" title="Faculty">
        <PageHeader title="Faculty Directory" subtitle="Browse BUBT teachers, find a supervisor by research area, and save the ones you need." />
        <Loading />
      </AppShell>
    );
  }

  return (
    <AppShell activeKey="faculty" title="Faculty">
      <PageHeader
        title="Faculty Directory"
        subtitle={`${faculty.length} teachers across ${departments.length} departments — browse, search, and find a supervisor.`}
        action={headerAction}
      />

      <SearchField value={query} onChange={setQuery} placeholder="Search by name, title, or research area…" />

      {popularInterests.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
            <Icon name="FlaskConical" size={13} /> Find a supervisor by research area
          </p>
          <div className="flex flex-wrap gap-1.5">
            {popularInterests.map((it) => {
              const active = interest && interest.toLowerCase() === it.label.toLowerCase();
              return (
                <button
                  key={it.label}
                  onClick={() => setInterest(active ? null : it.label)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active ? "bg-indigo-600 text-white" : "bg-surface text-ink-2 border border-brd hover:bg-surface-2"
                  }`}
                >
                  {it.label}
                  <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-white/20" : "bg-surface-3 text-ink-3"}`}>{it.n}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {filtering ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-base text-ink-3">
              {results.length} result{results.length === 1 ? "" : "s"}
              {interest && <> in <span className="font-semibold text-ink-2">{interest}</span></>}
            </p>
            <button onClick={() => { setQuery(""); setInterest(null); }} className="text-xs font-semibold text-ink-3 hover:text-ink-2">
              Clear
            </button>
          </div>
          {results.length === 0 ? (
            <EmptyState icon="SearchX" title="No teachers found" message="Try a different name or research area." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((f) => (
                <FacultyCard
                  key={f.id}
                  f={f}
                  dept={departmentById(f.departmentId)}
                  saved={facultyBookmarks.includes(f.id)}
                  onToggleSave={() => onToggleSave(f.id, f.name)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {branches.map(({ branch, depts }) => (
            <section key={branch}>
              <h3 className="mb-3 text-base font-semibold text-ink">{branch}</h3>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {depts.map((d) => (
                  <DepartmentCard key={d.id} dept={d} count={countByDept[d.id] || 0} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}

// ============================================================================
// Department — one department's roster
// ============================================================================
export function DepartmentFaculty({ deptNo }) {
  const { departmentByNumber, faculty, facultyBookmarks, toggleFacultyBookmark, dataLoading } = useApp();
  const [query, setQuery] = React.useState("");
  const toast = useToast();
  const dept = departmentByNumber(deptNo);

  if (!dept) {
    return (
      <AppShell activeKey="faculty" title="Department">
        {dataLoading ? <Loading /> : (
          <EmptyState
            icon="GraduationCap"
            title="Department not found"
            message="This department may have changed."
            action={<Button onClick={() => navigate("/faculty")}>Back to directory</Button>}
          />
        )}
      </AppShell>
    );
  }

  const onToggleSave = async (id, name) => {
    const saved = facultyBookmarks.includes(id);
    const r = await toggleFacultyBookmark(id);
    if (!r.ok) toast({ type: "error", title: "Couldn't update", message: r.error });
    else toast({ type: "success", title: saved ? "Removed from saved" : "Saved", message: name });
  };

  const q = query.trim().toLowerCase();
  const roster = sortFaculty(faculty.filter((f) => f.departmentId === dept.id));
  const list = q
    ? roster.filter((f) => (f.name ?? "").toLowerCase().includes(q) || (f.designation ?? "").toLowerCase().includes(q) || (f.interests ?? []).some((i) => (i ?? "").toLowerCase().includes(q)))
    : roster;

  return (
    <AppShell activeKey="faculty" title={shortDept(dept.name)}>
      <div className="mx-auto max-w-5xl">
        <button onClick={() => navigate("/faculty")} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
          <Icon name="ArrowLeft" size={16} /> All departments
        </button>

        <div className="mb-6 flex items-start gap-4">
          <AccentTile icon={BRANCH_ICON[dept.branch] || "GraduationCap"} tone={ACCENT} size={48} />
          <div className="min-w-0">
            <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{shortDept(dept.name)}</h2>
            <p className="mt-0.5 text-base text-ink-3">{dept.branch} · {roster.length} teacher{roster.length === 1 ? "" : "s"}</p>
            {dept.chairman && <p className="mt-1 text-base text-ink-2"><span className="text-ink-3">Chair:</span> {dept.chairman}</p>}
          </div>
        </div>

        {roster.length > 6 && (
          <div className="mb-4">
            <SearchField value={query} onChange={setQuery} placeholder={`Search in ${shortDept(dept.name)}…`} />
          </div>
        )}

        {list.length === 0 ? (
          <EmptyState icon="SearchX" title="No teachers found" message="Try a different name or research area." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((f) => (
              <FacultyCard
                key={f.id}
                f={f}
                dept={null}
                saved={facultyBookmarks.includes(f.id)}
                onToggleSave={() => onToggleSave(f.id, f.name)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ============================================================================
// Profile — a single teacher (Option A: everything in-app)
// ============================================================================
function LinkPill({ href, icon, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-2 rounded-md border border-brd bg-surface px-3 py-2.5 text-base font-semibold text-ink-2 transition-colors hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10"
    >
      <span className="flex items-center gap-2.5"><Icon name={icon} size={16} className="text-ink-3" /> {label}</span>
      <Icon name="ExternalLink" size={14} className="text-ink-3" />
    </a>
  );
}

export function FacultyProfile({ id }) {
  const { facultyById, departmentById, facultyBookmarks, toggleFacultyBookmark, dataLoading } = useApp();
  const toast = useToast();
  const f = facultyById(id);

  if (!f) {
    return (
      <AppShell activeKey="faculty" title="Faculty">
        {dataLoading ? <Loading /> : (
          <EmptyState
            icon="UserX"
            title="Teacher not found"
            message="This profile may have changed."
            action={<Button onClick={() => navigate("/faculty")}>Back to directory</Button>}
          />
        )}
      </AppShell>
    );
  }

  const dept = departmentById(f.departmentId);
  const saved = facultyBookmarks.includes(f.id);
  const links = Object.keys(LINK_META).filter((k) => f.links[k]);
  const phoneDigits = (f.phone || "").replace(/[^0-9]/g, "");

  async function toggleSave() {
    const r = await toggleFacultyBookmark(f.id);
    if (!r.ok) toast({ type: "error", title: "Couldn't update", message: r.error });
    else toast({ type: "success", title: saved ? "Removed from saved" : "Saved", message: f.name });
  }

  return (
    <AppShell activeKey="faculty" title={f.name}>
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate(dept ? `/faculty/dept/${dept.deptNumber}` : "/faculty")}
          className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2"
        >
          <Icon name="ArrowLeft" size={16} /> {dept ? shortDept(dept.name) : "Directory"}
        </button>

        {/* Header */}
        <Card className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Avatar name={f.name} src={f.photo} size={88} className="text-4xl" />
              <div className="min-w-0">
                <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{f.name}</h2>
                <p className="mt-0.5 text-base text-ink-2">{f.designation}</p>
                {dept && (
                  <button
                    onClick={() => navigate(`/faculty/dept/${dept.deptNumber}`)}
                    className="mt-1 inline-flex items-center gap-1.5 text-base font-semibold text-indigo-700 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-300"
                  >
                    <Icon name={BRANCH_ICON[dept.branch] || "GraduationCap"} size={14} /> {shortDept(dept.name)}
                  </button>
                )}
                {(f.isChairman || f.onLeave) && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {f.isChairman && <Badge tone="blue" icon="Crown">Chairman</Badge>}
                    {f.onLeave && <Badge tone="amber" icon="PlaneTakeoff">On study leave</Badge>}
                  </div>
                )}
              </div>
            </div>
            <Button
              variant={saved ? "secondary" : "primary"}
              icon="Star"
              onClick={toggleSave}
              className={saved ? "text-warn" : ""}
            >
              {saved ? "Saved" : "Save"}
            </Button>
          </div>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Main column */}
          <div className="space-y-6 lg:col-span-2">
            {f.interests.length > 0 && (
              <Card className="p-5">
                <h3 className="text-base font-semibold text-ink">Research interests</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {f.interests.map((i) => (
                    <span key={i} className="rounded-full bg-indigo-50 dark:bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">{i}</span>
                  ))}
                </div>
              </Card>
            )}

            {f.qualifications.length > 0 && (
              <Card className="p-5">
                <h3 className="text-base font-semibold text-ink">Qualifications</h3>
                <ul className="mt-3 space-y-2.5">
                  {f.qualifications.map((qual, i) => (
                    <li key={i} className="flex gap-2.5 text-base text-ink-2">
                      <Icon name="GraduationCap" size={16} className="mt-0.5 shrink-0 text-ink-3" />
                      <span>{qual}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {f.interests.length === 0 && f.qualifications.length === 0 && (
              <Card className="p-5">
                <p className="text-base text-ink-3">
                  No research interests or qualifications are listed for this teacher on BUBT's site yet.
                  Use the contact details to reach out directly.
                </p>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-base font-semibold text-ink">Contact</h3>
              <div className="mt-3 space-y-2.5">
                {f.email ? (
                  <a
                    href={`mailto:${f.email}`}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
                  >
                    <Icon name="Mail" size={16} /> Email
                  </a>
                ) : (
                  <p className="text-base text-ink-3">No email listed.</p>
                )}
                {f.email && <p className="break-all text-center text-xs text-ink-3">{f.email}</p>}
                {phoneDigits && (
                  <div className="flex gap-2">
                    <a href={`tel:${f.phone}`} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-brd bg-surface text-base font-semibold text-ink-2 hover:bg-surface-2">
                      <Icon name="Phone" size={15} /> Call
                    </a>
                    <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-success text-base font-semibold text-white hover:brightness-95">
                      <Icon name="MessageCircle" size={15} /> WhatsApp
                    </a>
                  </div>
                )}
              </div>
            </Card>

            {links.length > 0 && (
              <Card className="p-5">
                <h3 className="text-base font-semibold text-ink">Academic profiles</h3>
                <div className="mt-3 space-y-2">
                  {links.map((k) => (
                    <LinkPill key={k} href={f.links[k]} icon={LINK_META[k].icon} label={LINK_META[k].label} />
                  ))}
                </div>
              </Card>
            )}

            {f.profileUrl && (
              <a
                href={f.profileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-brd-2 bg-surface-2 px-3 py-2.5 text-xs font-semibold text-ink-3 hover:bg-surface-3"
              >
                <Icon name="ExternalLink" size={14} /> View official profile on bubt.edu.bd
              </a>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ============================================================================
// Saved — this user's bookmarked teachers
// ============================================================================
export function SavedFaculty() {
  const { faculty, facultyBookmarks, departmentById, toggleFacultyBookmark, dataLoading } = useApp();
  const toast = useToast();

  const onToggleSave = async (id, name) => {
    const saved = facultyBookmarks.includes(id);
    const r = await toggleFacultyBookmark(id);
    if (!r.ok) toast({ type: "error", title: "Couldn't update", message: r.error });
    else toast({ type: "success", title: saved ? "Removed from saved" : "Saved", message: name });
  };

  const saved = sortFaculty(faculty.filter((f) => facultyBookmarks.includes(f.id)));

  return (
    <AppShell activeKey="faculty" title="Saved Teachers">
      <div className="mx-auto max-w-5xl">
        <button onClick={() => navigate("/faculty")} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
          <Icon name="ArrowLeft" size={16} /> Directory
        </button>
        <PageHeader title="Saved Teachers" subtitle="Teachers you've bookmarked — your shortlist of supervisors and contacts." />

        {dataLoading && faculty.length === 0 ? (
          <Loading />
        ) : saved.length === 0 ? (
          <EmptyState
            icon="Star"
            title="No saved teachers yet"
            message="Tap the star on any teacher to add them here."
            action={<Button onClick={() => navigate("/faculty")} icon="GraduationCap">Browse faculty</Button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {saved.map((f) => (
              <FacultyCard
                key={f.id}
                f={f}
                dept={departmentById(f.departmentId)}
                saved
                onToggleSave={() => onToggleSave(f.id, f.name)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
