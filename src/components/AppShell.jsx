import React, { useState } from "react";
import { LogOut, Menu, X, Bell, ChevronDown } from "lucide-react";
import { useApp } from "../data/store.jsx";
import { navigate, Link, useHashRoute } from "../lib/router.jsx";
import { Avatar, Badge } from "./ui.jsx";
import { Icon } from "./Icon.jsx";
import { Logo } from "./Brand.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";

// ============================================================================
// AppShell — sidebar + top bar + content area for all logged-in screens.
// Role-aware, sectioned nav. Mobile: sidebar collapses into a slide-in drawer.
// Nav items use lucide icon NAMES (resolved by <Icon name=…/>); only features
// that actually exist are listed — Campus Life / Community grow per release.
// ============================================================================

// Study Hub is students-only (staff/admins don't have a section), so it's added
// to the Student nav explicitly rather than to the shared CAMPUS_LIFE group.
const STUDY_HUB = { key: "study-hub", label: "Study Hub", icon: "BookMarked", path: "/study-hub" };
// Cover Page Generator is also students-only (BUBT assignment/lab/report covers).
const COVER_PAGE = { key: "cover-page", label: "Cover Page", icon: "FileBadge", path: "/cover-page" };

// "Academics" — coursework tools: what you need to attend and pass classes.
// Split out of Campus Life, which had grown to 11 items and stopped being a
// meaningful grouping. Study Hub + Cover Page are students-only (see above).
const ACADEMICS = [
  { key: "routines", label: "Class Routines", icon: "ClipboardList", path: "/routines" },
  { key: "calendar", label: "Academic Calendar", icon: "CalendarRange", path: "/calendar" },
  { key: "faculty", label: "Faculty", icon: "GraduationCap", path: "/faculty" },
];
// Shared "Campus Life" group — things happening around campus, not coursework.
const CAMPUS_LIFE = [
  { key: "clubs", label: "Clubs", icon: "UsersRound", path: "/clubs" },
  { key: "events", label: "Events", icon: "CalendarDays", path: "/events" },
  { key: "announcements", label: "Announcements", icon: "Megaphone", path: "/announcements" },
  { key: "prayer", label: "Prayer Times", icon: "Moon", path: "/prayer" },
  { key: "jobs", label: "Jobs & Internships", icon: "Briefcase", path: "/jobs" },
];
// Bus lives in Services with Medical — it's campus logistics, not an activity.
const BUS = { key: "bus", label: "Bus Schedule", icon: "Bus", path: "/bus" };
const MEDICAL = { key: "medical", label: "Medical Center", icon: "Stethoscope", path: "/medical" };
// Shared "Community" group (grows as features ship: ride share, blood…).
const COMMUNITY = [
  { key: "marketplace", label: "Marketplace", icon: "Store", path: "/marketplace" },
  { key: "rideshare", label: "Ride Share", icon: "Car", path: "/rides" },
  { key: "blood", label: "Blood Donation", icon: "Droplet", path: "/blood" },
];

const NAV_BY_ROLE = {
  Student: [
    { section: null, items: [
      { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard", path: "/dashboard" },
      // One row for the whole report loop: My Reports / Campus Board tabs plus
      // the "Report an Issue" button all live on this page, so /campus-issues
      // and /reports/new have no sidebar row of their own. `match` keeps the
      // row highlighted on the sibling route (see activeKeyForPath).
      { key: "reports", label: "Reports", icon: "FileText", path: "/reports", match: ["/campus-issues"] },
      { key: "messages", label: "Messages", icon: "MessagesSquare", path: "/messages" },
    ]},
    { section: "Academics", items: [STUDY_HUB, ...ACADEMICS, COVER_PAGE] },
    { section: "Campus Life", items: CAMPUS_LIFE },
    { section: "Services", items: [
      MEDICAL,
      BUS,
      { key: "lost-found", label: "Lost & Found", icon: "PackageSearch", path: "/lost-found" },
    ]},
    { section: "Community", items: [
      ...COMMUNITY,
      { key: "directory", label: "Students", icon: "Users", path: "/students" },
    ]},
    { section: null, items: [
      { key: "profile", label: "My Profile", icon: "CircleUser", path: "/profile" },
    ]},
  ],
  Staff: [
    { section: null, items: [
      { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard", path: "/staff" },
      { key: "assigned", label: "Assigned to Me", icon: "ClipboardCheck", path: "/staff/assigned" },
    ]},
    // Staff are maintenance workers, not students — the student-academic items
    // (Faculty, Clubs, Events, Academic Calendar, Class Routines, Jobs) are
    // dropped, so Staff get no Academics group at all. Only the
    // campus-worker-relevant slice of Campus Life stays.
    { section: "Campus Life", items: CAMPUS_LIFE.filter((i) => ["prayer", "announcements"].includes(i.key)) },
    { section: "Services", items: [MEDICAL, BUS] },
    // Community features are "any adult on campus" — kept in full.
    { section: "Community", items: COMMUNITY },
    { section: null, items: [
      { key: "profile", label: "My Profile", icon: "CircleUser", path: "/profile" },
    ]},
  ],
  Admin: [
    { section: null, items: [
      { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard", path: "/admin" },
      { key: "all-reports", label: "All Reports", icon: "FileText", path: "/admin/reports" },
      { key: "users", label: "Manage Users", icon: "Users", path: "/admin/users" },
      { key: "faculty-admin", label: "Faculty Profiles", icon: "GraduationCap", path: "/admin/faculty" },
      { key: "studyhub-admin", label: "Study Hub", icon: "BookMarked", path: "/admin/study-hub" },
      { key: "clubs-admin", label: "Clubs", icon: "UsersRound", path: "/admin/clubs" },
    ]},
    { section: "Academics", items: ACADEMICS },
    { section: "Campus Life", items: CAMPUS_LIFE.filter((i) => i.key !== "clubs") },
    { section: "Services", items: [MEDICAL, BUS] },
    { section: "Community", items: COMMUNITY },
    { section: null, items: [
      { key: "profile", label: "My Profile", icon: "CircleUser", path: "/profile" },
    ]},
  ],
};

// Stable empty fallback — a fresh [] each render would retrigger the accordion
// effect, whose dep list includes `nav`.
const EMPTY_NAV = [];

export const ROLE_TONE = { Student: "blue", Staff: "amber", Admin: "emerald" };

// Set of feature nav keys visible to a role. CampusToday uses this so its cards
// only ever show features the role can actually open from the sidebar — the card
// grid can't drift from the nav (e.g. Staff has no Events/Jobs/Clubs nav item, so
// it gets no Events/Jobs/Clubs card either).
export function navKeysForRole(role) {
  return new Set((NAV_BY_ROLE[role] || []).flatMap((g) => g.items).map((i) => i.key));
}

// Remembers the sidebar's scroll offset across navigations (and even a remount),
// so clicking a nav item never snaps the list back to the top.
let navScrollStore = 0;

// Named nav groups collapse into accordions so the sidebar isn't a 23-row wall.
// Ungrouped items (section: null — Dashboard, Reports, Profile…) always show.
// The accordion is EXCLUSIVE: opening a group closes the others. That caps the
// expanded sidebar at (ungrouped + headers + largest group) instead of letting a
// user who expanded everything once keep a full-height list forever.
const NAV_OPEN_STORE = "fixit.navOpenSection";
function readOpenSection() {
  try {
    const raw = localStorage.getItem(NAV_OPEN_STORE);
    return typeof raw === "string" && raw ? raw : null;
  } catch { return null; }
}
function writeOpenSection(name) {
  try {
    if (name) localStorage.setItem(NAV_OPEN_STORE, name);
    else localStorage.removeItem(NAV_OPEN_STORE);
  } catch { /* storage blocked — in-memory only */ }
}
// Section a nav key lives in, or null when it's an always-visible item.
function sectionForKey(nav, key) {
  for (const g of nav) if (g.section && g.items.some((i) => i.key === key)) return g.section;
  return null;
}

// Open/close state for the nav accordion. Lives in AppLayout, NOT in
// SidebarContent, because SidebarContent is mounted twice (desktop aside +
// mobile drawer) — per-instance state would let the two copies disagree.
function useNavAccordion(nav, activeKey) {
  const [openSection, setOpenSection] = useState(() => readOpenSection());
  // Navigating into a collapsed group reveals it (otherwise the active item
  // sits highlighted inside a group the user can't see) — and persists, so the
  // reveal survives a reload instead of silently snapping shut.
  React.useEffect(() => {
    const s = sectionForKey(nav, activeKey);
    if (s) setOpenSection((prev) => { if (prev === s) return prev; writeOpenSection(s); return s; });
  }, [activeKey, nav]);
  const toggleSection = React.useCallback((name) => {
    setOpenSection((prev) => { const next = prev === name ? null : name; writeOpenSection(next); return next; });
  }, []);
  return { openSection, toggleSection };
}

function SidebarContent({ nav, activeKey, onNavigate, onLogout, badges = {}, openSection, onToggleSection }) {
  const navRef = React.useRef(null);
  // Badge count for a collapsed group, so unread messages etc. aren't hidden.
  const groupBadge = (items) => items.reduce((n, i) => n + (badges[i.key] || 0), 0);
  // Restore after every render (route change re-renders this); a no-op when the
  // position is already correct, but reasserts it if anything reset the scroll.
  React.useLayoutEffect(() => {
    const el = navRef.current;
    if (el && el.scrollTop !== navScrollStore) el.scrollTop = navScrollStore;
  });
  // When the ACTIVE item changes (navigation / fresh load), make sure it's in
  // view — scrolls only this list, never the window. Scoped to activeKey so it
  // never fights the user's manual scrolling on unrelated re-renders.
  // openSection is a dep too: navigating into a COLLAPSED group reveals it from
  // a passive effect one commit later, so on the activeKey commit the row isn't
  // in the DOM yet and the querySelector below bails. Without this dep the
  // active row would silently never be scrolled into view on that path.
  React.useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const act = el.querySelector('[data-active="true"]');
    if (!act) return;
    const er = el.getBoundingClientRect();
    const ar = act.getBoundingClientRect();
    if (er.height > 0 && (ar.top < er.top || ar.bottom > er.bottom)) {
      el.scrollTop += ar.top - er.top - (er.height - ar.height) / 2;
    }
  }, [activeKey, openSection]);
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link to="/"><Logo /></Link>
      </div>
      <nav
        ref={navRef}
        onScroll={(e) => { navScrollStore = e.currentTarget.scrollTop; }}
        className="flex-1 min-h-0 space-y-4 overflow-y-auto px-3 py-2"
      >
        {nav.map((group, gi) => {
          const collapsible = Boolean(group.section);
          const open = !collapsible || openSection === group.section;
          const hidden = collapsible && !open ? groupBadge(group.items) : 0;
          return (
          <div key={group.section || `g${gi}`} className="space-y-1">
            {collapsible && (
              <button
                onClick={() => onToggleSection(group.section)}
                aria-expanded={open}
                className="flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 hover:bg-surface-2 hover:text-ink-2"
              >
                <ChevronDown size={13} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
                {group.section}
                {hidden > 0 && (
                  <span className="ml-auto inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none text-white">
                    {hidden > 9 ? "9+" : hidden}
                  </span>
                )}
              </button>
            )}
            {open && group.items.map((item) => {
              const active = item.key === activeKey;
              return (
                <button
                  key={item.key}
                  data-active={active ? "true" : undefined}
                  onClick={() => onNavigate(item.path)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-base font-semibold transition-colors ${
                    active ? "bg-brand-50 text-brand-700" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  <Icon name={item.icon} size={18} className={active ? "text-brand" : "text-ink-3"} />
                  {item.label}
                  {badges[item.key] > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold leading-none text-white">
                      {badges[item.key] > 9 ? "9+" : badges[item.key]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-brd p-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-base font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <LogOut size={18} className="text-ink-3" />
          Log out
        </button>
      </div>
    </div>
  );
}

// Maps the current route to the nav key to highlight, by longest matching item
// path (so /clubs/123 → clubs, /reports/new → reports). An item may also list
// extra `match` paths for routes it owns that aren't under its own path — e.g.
// the Reports row owns /campus-issues, which is its Campus Board tab.
function activeKeyForPath(path, role) {
  const items = (NAV_BY_ROLE[role] || []).flatMap((g) => g.items);
  let bestKey = null, bestLen = -1;
  for (const it of items) {
    for (const base of [it.path, ...(it.match || [])]) {
      if ((path === base || path.startsWith(base + "/")) && base.length > bestLen) {
        bestKey = it.key; bestLen = base.length;
      }
    }
  }
  return bestKey;
}

// Lets the per-screen top bar open the mobile drawer, which now lives in the
// persistent AppLayout rather than in each screen's AppShell.
const LayoutContext = React.createContext({ openDrawer: () => {} });
export function useLayout() { return React.useContext(LayoutContext); }

// AppLayout — persistent frame for all signed-in screens. Rendered ONCE around
// the routed content (see App.jsx) so the sidebar and its scroll position
// survive navigation instead of remounting per screen. Active nav is derived
// from the route, so screens don't pass activeKey to keep the sidebar in sync.
export function AppLayout({ children }) {
  const { currentUser, logout, totalUnreadMessages = 0 } = useApp();
  const path = useHashRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer on Escape (it's an aria-modal dialog).
  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Close the drawer whenever the route changes.
  React.useEffect(() => { setDrawerOpen(false); }, [path]);

  // Derived before the signed-out early return — useNavAccordion is a hook, so
  // it can't sit behind a conditional return.
  const nav = NAV_BY_ROLE[currentUser?.role] || EMPTY_NAV;
  const activeKey = activeKeyForPath(path, currentUser?.role);
  const { openSection, toggleSection } = useNavAccordion(nav, activeKey);

  if (!currentUser) return <>{children}</>;
  const go = (p) => { setDrawerOpen(false); navigate(p); };
  const navBadges = { messages: totalUnreadMessages };

  return (
    <LayoutContext.Provider value={{ openDrawer: () => setDrawerOpen(true) }}>
      <div className="min-h-screen bg-bg">
        {/* Desktop sidebar — mounts once, persists across navigation */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-brd bg-surface lg:block">
          <SidebarContent nav={nav} activeKey={activeKey} onNavigate={go} onLogout={logout} badges={navBadges} openSection={openSection} onToggleSection={toggleSection} />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60" onClick={() => setDrawerOpen(false)} />
            <div role="dialog" aria-modal="true" aria-label="Menu" className="absolute inset-y-0 left-0 w-64 bg-surface shadow-xl">
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="absolute right-3 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2"
              >
                <X size={18} />
              </button>
              <SidebarContent nav={nav} activeKey={activeKey} onNavigate={go} onLogout={logout} badges={navBadges} openSection={openSection} onToggleSection={toggleSection} />
            </div>
          </div>
        )}

        {/* Main column */}
        <div className="lg:pl-60">{children}</div>
      </div>
    </LayoutContext.Provider>
  );
}

// AppShell — per-screen top bar + content, rendered inside AppLayout's main
// column. `activeKey` is accepted for backward-compat but unused (active nav is
// now route-derived in AppLayout).
export function AppShell({ activeKey, title, actions, children }) {
  const { currentUser, logout, dataError, retryData, unreadNotifCount = 0 } = useApp();
  const { openDrawer } = useLayout();
  if (!currentUser) return null;

  return (
    <>
        {/* Top bar */}
        <header className="topbar-blur sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-brd px-4 backdrop-blur sm:px-6">
          <button
            onClick={openDrawer}
            aria-label="Open menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 lg:hidden"
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0 flex-1">
            {title && <h1 className="truncate text-xl font-bold text-ink sm:text-2xl">{title}</h1>}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {actions}
            <ThemeToggle />
            <button
              onClick={() => navigate("/notifications")}
              title="Notifications"
              aria-label={unreadNotifCount > 0 ? `Notifications, ${unreadNotifCount} unread` : "Notifications"}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink-2"
            >
              <Bell size={19} />
              {unreadNotifCount > 0 && (
                <span className="absolute right-1 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate("/profile")}
              title="My profile"
              className="hidden items-center gap-2.5 rounded-md p-1 pr-1.5 hover:bg-surface-2 sm:flex"
            >
              <div className="text-right">
                <p className="text-base font-semibold leading-tight text-ink">{currentUser.name}</p>
                <p className="text-xs leading-tight text-ink-3">{currentUser.email}</p>
              </div>
              <Avatar name={currentUser.name} src={currentUser.avatar} />
            </button>
            <button onClick={() => navigate("/profile")} title="My profile" className="sm:hidden">
              <Avatar name={currentUser.name} src={currentUser.avatar} size={32} />
            </button>
            <Badge tone={ROLE_TONE[currentUser.role]} className="hidden sm:inline-flex">{currentUser.role}</Badge>
            <button
              onClick={logout}
              title="Log out"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink-2"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* A background load failed — offer a retry instead of silently showing empty lists. */}
        {dataError && (
          <div className="flex items-center justify-between gap-3 border-b border-brd bg-warn-bg px-4 py-2.5 text-base text-warn sm:px-6">
            <span>Some data couldn't be loaded. Check your connection and try again.</span>
            <button onClick={retryData} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-warn px-3 text-xs font-bold text-white hover:brightness-95">
              Retry
            </button>
          </div>
        )}

        {/* Content — widen on large screens so feature pages fill the space
            next to the sidebar instead of sitting in a narrow centered column. */}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 xl:max-w-7xl 2xl:max-w-[100rem]">{children}</main>
    </>
  );
}

// PageHeader — title + subtitle + optional action, used at top of content
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h2>
        {subtitle && <p className="mt-1 text-base text-ink-2">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  );
}
