import React, { useState } from "react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { Card, Badge, EmptyState, Button } from "../../components/ui.jsx";
import { Icon } from "../../components/Icon.jsx";
import {
  CheckCheck, SlidersHorizontal, Bell, BellOff, Clock, ChevronLeft, X,
  Smartphone, Mail, Trash2,
} from "lucide-react";

// ============================================================================
// Notifications — in-app notification center + per-sector preferences.
// Reads the shared `notifications` / `notif_prefs` tables (migration 0067).
// Rows are generated server-side by the 0067 triggers (connection / report /
// claim events); this is the read + mark-read + preferences UI.
// ============================================================================

// Per-sector display metadata. Mirrors CampusOne's settings list so a pref saved
// in one app is meaningful in the other (shared backend).
const SECTORS = [
  { id: "reports",   label: "Reports",          desc: "Maintenance issue updates",  icon: "Wrench",        tone: "amber"   },
  { id: "lostfound", label: "Lost & Found",     desc: "Claims on your items",       icon: "PackageSearch", tone: "amber"   },
  { id: "clubs",     label: "Clubs",            desc: "Club activity and posts",    icon: "UsersRound",    tone: "purple"  },
  { id: "events",    label: "Events",           desc: "Campus events and seminars", icon: "CalendarDays",  tone: "fuchsia" },
  { id: "jobs",      label: "Jobs",             desc: "Job and internship listings",icon: "Briefcase",     tone: "teal"    },
  { id: "announce",  label: "Announcements",    desc: "Official university notices",icon: "Megaphone",     tone: "blue"    },
  { id: "study",     label: "Study Hub",        desc: "New materials and resources",icon: "BookMarked",    tone: "sky"     },
  { id: "bus",       label: "Bus",              desc: "Schedule changes",           icon: "Bus",           tone: "amber"   },
  { id: "medical",   label: "Medical",          desc: "Doctor availability updates",icon: "Stethoscope",   tone: "red"     },
  { id: "market",    label: "Marketplace",      desc: "New listings near you",      icon: "Store",         tone: "emerald" },
  { id: "ride",      label: "Ride Share",       desc: "New ride offers",            icon: "Car",           tone: "emerald" },
  { id: "blood",     label: "Blood",            desc: "Urgent blood requests",      icon: "Droplet",       tone: "red"     },
  { id: "directory", label: "Directory",        desc: "Connection requests",        icon: "Users",         tone: "indigo"  },
  { id: "prayer",    label: "Prayer Times",     desc: "Daily prayer time updates",  icon: "Moon",          tone: "emerald" },
  { id: "faculty",   label: "Faculty",          desc: "Faculty announcements",      icon: "GraduationCap", tone: "teal"    },
  { id: "calendar",  label: "Academic Calendar",desc: "Academic dates and holidays",icon: "CalendarRange", tone: "rose"    },
  { id: "routines",  label: "Class Routines",   desc: "Class and exam schedules",   icon: "CalendarClock", tone: "indigo"  },
  { id: "coverpage", label: "Cover Page",       desc: "Assignment cover pages",     icon: "FileText",      tone: "teal"    },
];
const SECTOR_BY_ID = Object.fromEntries(SECTORS.map((s) => [s.id, s]));
const DEFAULT_PREF = { enabled: true, push: true, email: false, inapp: true };

// Tone -> the colored circle behind a sector icon.
const TONE_BG = {
  amber: "bg-amber-100 text-amber-700",
  purple: "bg-purple-100 text-purple-700",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700",
  teal: "bg-teal-100 text-teal-700",
  blue: "bg-blue-100 text-blue-700",
  sky: "bg-sky-100 text-sky-700",
  red: "bg-red-100 text-red-700",
  emerald: "bg-emerald-100 text-emerald-700",
  indigo: "bg-indigo-100 text-indigo-700",
  rose: "bg-rose-100 text-rose-700",
  slate: "bg-slate-100 text-slate-600",
};

function metaFor(sector) {
  return SECTOR_BY_ID[sector] || { label: sector, icon: "Bell", tone: "slate" };
}

function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${Math.max(secs, 0)}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function bucketOf(iso) {
  const age = Date.now() - new Date(iso).getTime();
  if (age < 3 * 3600 * 1000) return "new";
  if (age < 24 * 3600 * 1000) return "today";
  return "earlier";
}

// Where a notification links to. Reports use a code in the URL but the row only
// carries a uuid, so we route to the role-appropriate list rather than guess a code.
function targetFor(sector, role) {
  switch (sector) {
    case "directory": return "/students";
    case "lostfound": return "/lost-found";
    case "reports":
      return role === "Student" ? "/reports" : role === "Staff" ? "/staff/assigned" : "/admin/reports";
    case "announce": return "/announcements";
    case "events": return "/events";
    case "jobs": return "/jobs";
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Notifications center
// ---------------------------------------------------------------------------
export function Notifications() {
  const { currentUser, notifications, unreadNotifCount, markNotifRead, markAllNotifsRead, deleteNotification } = useApp();
  const [filter, setFilter] = useState("all"); // all | unread

  const list = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;
  const BUCKET_LABEL = { new: "New", today: "Today", earlier: "Earlier" };
  const groups = ["new", "today", "earlier"]
    .map((b) => ({ id: b, label: BUCKET_LABEL[b], items: list.filter((n) => bucketOf(n.createdAt) === b) }))
    .filter((g) => g.items.length > 0);

  function openNotif(n) {
    if (!n.read) markNotifRead(n.id);
    const to = targetFor(n.sector, currentUser?.role);
    if (to) navigate(to);
  }

  return (
    <AppShell
      activeKey="notifications"
      title="Notifications"
      actions={
        <button
          onClick={() => navigate("/notifications/settings")}
          title="Notification settings"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <SlidersHorizontal size={18} />
        </button>
      }
    >
      <PageHeader
        title="Notifications"
        subtitle={unreadNotifCount > 0 ? `${unreadNotifCount} unread` : "You're all caught up"}
        action={
          <Button variant="secondary" icon={CheckCheck} disabled={unreadNotifCount === 0} onClick={markAllNotifsRead}>
            Mark all read
          </Button>
        }
      />

      {/* Filter chips */}
      <div className="mb-5 flex gap-2">
        {[
          { id: "all", label: "All", count: notifications.length },
          { id: "unread", label: "Unread", count: unreadNotifCount },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filter === f.id
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
            {f.count > 0 && (
              <span className={filter === f.id ? "text-blue-100" : "text-slate-400"}>{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={CheckCheck} title="All clear" message="No notifications here." />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.id}>
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{g.label}</p>
              <Card className="divide-y divide-slate-100 overflow-hidden">
                {g.items.map((n) => {
                  const meta = metaFor(n.sector);
                  return (
                    <div
                      key={n.id}
                      className={`group flex items-start gap-3 p-4 transition-colors ${n.read ? "bg-white" : "bg-blue-50/60"}`}
                    >
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[meta.tone] || TONE_BG.slate}`}>
                        <Icon name={meta.icon} size={17} />
                      </span>
                      <button onClick={() => openNotif(n)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-start justify-between gap-3">
                          <p className={`truncate text-sm ${n.read ? "font-medium text-slate-800" : "font-semibold text-slate-900"}`}>
                            {!n.read && <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-blue-600 align-middle" />}
                            {n.title}
                          </p>
                          <span className="shrink-0 text-xs text-slate-400">{timeAgo(n.createdAt)}</span>
                        </div>
                        {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{n.body}</p>}
                      </button>
                      <button
                        onClick={() => deleteNotification(n.id)}
                        title="Dismiss"
                        className="shrink-0 rounded-lg p-1.5 text-slate-300 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-500 group-hover:opacity-100"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Small switch (no dependency; matches the blue accent)
// ---------------------------------------------------------------------------
function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-blue-600" : "bg-slate-300"
      } ${disabled ? "pointer-events-none opacity-40" : ""}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

const CHANNELS = [
  { id: "push", label: "Push", icon: Smartphone },
  { id: "email", label: "Email", icon: Mail },
  { id: "inapp", label: "In-app", icon: Bell },
];

// ---------------------------------------------------------------------------
// Notification settings
// ---------------------------------------------------------------------------
export function NotifSettings() {
  const { notifPrefs, saveNotifPref, saveNotifMaster, setAllNotifSectors } = useApp();
  const [expanded, setExpanded] = useState(null);

  const paused = notifPrefs._paused?.enabled ?? false;
  const quiet = notifPrefs._quiet?.enabled ?? false;
  const prefOf = (id) => notifPrefs[id] || DEFAULT_PREF;
  const onCount = SECTORS.filter((s) => prefOf(s.id).enabled).length;
  const allOn = onCount === SECTORS.length;

  return (
    <AppShell activeKey="notifications" title="Notification Settings">
      <button
        onClick={() => navigate("/notifications")}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft size={16} /> Back to notifications
      </button>

      <div className="mx-auto max-w-2xl space-y-3">
        {/* Master: pause all */}
        <Card className="flex items-center gap-4 p-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${paused ? "bg-red-100 text-red-600" : "bg-slate-100 text-blue-600"}`}>
            {paused ? <BellOff size={20} /> : <Bell size={20} />}
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Pause all</p>
            <p className="text-xs text-slate-500">Stop all notifications temporarily</p>
          </div>
          <Switch checked={paused} onChange={(v) => saveNotifMaster("_paused", v)} />
        </Card>

        {/* Master: quiet hours */}
        <Card className={`flex items-center gap-4 p-4 ${paused ? "opacity-50" : ""}`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
            <Clock size={20} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Quiet hours</p>
            <p className="text-xs text-slate-500">Silence notifications 10PM – 7AM</p>
          </div>
          <Switch checked={quiet} disabled={paused} onChange={(v) => saveNotifMaster("_quiet", v)} />
        </Card>

        {/* Categories header */}
        <div className="flex items-end justify-between px-1 pt-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Categories</p>
            <p className="mt-0.5 text-xs text-slate-400">{onCount} on · tap a row to set channels</p>
          </div>
          <button
            onClick={() => setAllNotifSectors(SECTORS.map((s) => s.id), !allOn)}
            disabled={paused}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-40"
          >
            {allOn ? "Turn all off" : "Turn all on"}
          </button>
        </div>

        {/* Sectors */}
        <Card className={`divide-y divide-slate-100 overflow-hidden ${paused ? "opacity-50" : ""}`}>
          {SECTORS.map((s) => {
            const p = prefOf(s.id);
            const open = expanded === s.id;
            return (
              <div key={s.id}>
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => setExpanded(open ? null : s.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[s.tone] || TONE_BG.slate}`}>
                      <Icon name={s.icon} size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{s.label}</span>
                      <span className="block truncate text-xs text-slate-500">{s.desc}</span>
                    </span>
                  </button>
                  <Switch checked={p.enabled} disabled={paused} onChange={(v) => saveNotifPref(s.id, { enabled: v })} />
                </div>

                {open && p.enabled && !paused && (
                  <div className="flex flex-wrap gap-2 px-4 pb-4 pl-16">
                    {CHANNELS.map((ch) => {
                      const ChIcon = ch.icon;
                      const on = p[ch.id];
                      return (
                        <button
                          key={ch.id}
                          onClick={() => saveNotifPref(s.id, { [ch.id]: !on })}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          <ChIcon size={14} /> {ch.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      </div>
    </AppShell>
  );
}
