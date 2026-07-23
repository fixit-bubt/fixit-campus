import React from "react";
import { Icon } from "./Icon.jsx";

// ============================================================================
// Feature kit — shared building blocks for the campus features.
// Each feature has ONE signature accent (see `sector.*` tokens), used only for
// icon tiles + category badges. Chrome (brand primary) stays identical
// everywhere. Legacy hue tones keep Tailwind's palette with dark: variants.
// ============================================================================

// Full class strings so Tailwind's scanner picks them up.
// Sector keys (reports, blood, study…) are the app's per-feature accents.
export const ACCENT_TILE = {
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
  slate: "bg-surface-3 text-ink-2",
  // Sector accents (A5) — one per feature, same hex in both themes.
  reports: "bg-sector-reports/15 text-sector-reports dark:bg-sector-reports/20 dark:brightness-125",
  lostfound: "bg-sector-lostfound/15 text-sector-lostfound dark:bg-sector-lostfound/20 dark:brightness-125",
  clubs: "bg-sector-clubs/15 text-sector-clubs dark:bg-sector-clubs/20 dark:brightness-125",
  events: "bg-sector-events/15 text-sector-events dark:bg-sector-events/20 dark:brightness-125",
  jobs: "bg-sector-jobs/15 text-sector-jobs dark:bg-sector-jobs/20 dark:brightness-125",
  announce: "bg-sector-announce/15 text-sector-announce dark:bg-sector-announce/20 dark:brightness-125",
  study: "bg-sector-study/15 text-sector-study dark:bg-sector-study/20 dark:brightness-125",
  bus: "bg-sector-bus/15 text-sector-bus dark:bg-sector-bus/20 dark:brightness-125",
  medical: "bg-sector-medical/15 text-sector-medical dark:bg-sector-medical/20 dark:brightness-125",
  market: "bg-sector-market/15 text-sector-market dark:bg-sector-market/20 dark:brightness-125",
  ride: "bg-sector-ride/15 text-sector-ride dark:bg-sector-ride/20 dark:brightness-125",
  blood: "bg-sector-blood/15 text-sector-blood dark:bg-sector-blood/20 dark:brightness-125",
  directory: "bg-sector-directory/15 text-sector-directory dark:bg-sector-directory/20 dark:brightness-125",
  prayer: "bg-sector-prayer/15 text-sector-prayer dark:bg-sector-prayer/20 dark:brightness-125",
  faculty: "bg-sector-faculty/15 text-sector-faculty dark:bg-sector-faculty/20 dark:brightness-125",
  calendar: "bg-sector-calendar/15 text-sector-calendar dark:bg-sector-calendar/20 dark:brightness-125",
  routines: "bg-sector-routines/15 text-sector-routines dark:bg-sector-routines/20 dark:brightness-125",
  coverpage: "bg-sector-coverpage/15 text-sector-coverpage dark:bg-sector-coverpage/20 dark:brightness-125",
  pdfmaker: "bg-sector-pdfmaker/15 text-sector-pdfmaker dark:bg-sector-pdfmaker/20 dark:brightness-125",
};

export const ACCENT_SOFT = {
  sky: "bg-sky-50 border-sky-200 dark:bg-sky-500/10 dark:border-sky-500/25",
  emerald: "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/25",
  teal: "bg-teal-50 border-teal-200 dark:bg-teal-500/10 dark:border-teal-500/25",
  violet: "bg-violet-50 border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/25",
  indigo: "bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/25",
  red: "bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/25",
  fuchsia: "bg-fuchsia-50 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:border-fuchsia-500/25",
  amber: "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/25",
  purple: "bg-purple-50 border-purple-200 dark:bg-purple-500/10 dark:border-purple-500/25",
};

// Accent icon tile (matches the StatCard tile look). `icon` is a lucide name.
export function AccentTile({ icon, tone = "slate", size = 40, iconSize, className = "" }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg ${ACCENT_TILE[tone] || ACCENT_TILE.slate} ${className}`}
      style={{ width: size, height: size }}
    >
      <Icon name={icon} size={iconSize || Math.round(size * 0.5)} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dhaka time helpers (the device clock may be in any tz; normalize to Dhaka).
// ---------------------------------------------------------------------------
export function dhakaParts(date = new Date()) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka", hour12: false,
    weekday: "short", year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
  const p = {};
  f.formatToParts(date).forEach((x) => { p[x.type] = x.value; });
  return p;
}

export function nowDhakaMinutes() {
  const p = dhakaParts();
  return parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10);
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fmtTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function fmtCountdown(mins) {
  if (mins < 0) mins = 0;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function nextDeparture(times) {
  if (!times || times.length === 0) return null; // no departures → caller renders a fallback
  const now = nowDhakaMinutes();
  const sorted = [...times].map(toMinutes).sort((a, b) => a - b);
  for (const t of sorted) {
    if (t >= now) return { mins: t, wait: t - now, tomorrow: false };
  }
  const first = sorted[0];
  return { mins: first, wait: 24 * 60 - now + first, tomorrow: true };
}

export function minutesToHHMM(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ৳ currency
export function taka(n) {
  return "\u09F3" + Number(n).toLocaleString("en-US");
}

// Build a wa.me link from a phone number. wa.me needs the number in FULL
// international form, digits only, no plus. Bangladeshi numbers are usually
// stored locally (01XXXXXXXXX) \u2014 that must become 8801XXXXXXXXX or WhatsApp
// shows an "invalid number" page. Returns null when there aren't enough digits.
export function waHref(phone) {
  let d = String(phone || "").replace(/[^0-9]/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);                 // 00-prefixed intl
  if (d.startsWith("880")) { /* already international */ }
  else if (d.startsWith("0")) d = "880" + d.slice(1);     // BD local 01... -> 8801...
  else if (d.length === 10 && d.startsWith("1")) d = "880" + d; // 1XXXXXXXXX (missing 0)
  if (d.length < 11) return null;                          // too short to be real
  return `https://wa.me/${d}`;
}

// Open a compose window for an email address. Plain mailto: silently does
// nothing on desktop browsers with no configured mail app, so we use Gmail's
// web compose (opens for any Google session — this user base is Gmail-based).
// Returns null for a missing/invalid address so the caller can hide the button.
export function mailHref(email) {
  const e = String(email || "").trim();
  if (!e || !e.includes("@")) return null;
  // view=cm opens the normal Gmail inbox with a compose popup (no fs=1, which
  // would be the bare full-screen compose window).
  return `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(e)}`;
}

export function useTick(ms = 30000) {
  const [, setN] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}


// CountdownBanner — hero "next X" banner used by Bus + Prayer.
export function CountdownBanner({ tone = "sky", icon, eyebrow, title, time, waitMins, tomorrow, meta, right }) {
  useTick();
  return (
    <div className={`relative overflow-hidden rounded-xl border ${ACCENT_SOFT[tone]} p-5 sm:p-6`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <AccentTile icon={icon} tone={tone} size={48} />
          <div>
            {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.06em] text-ink-3">{eyebrow}</p>}
            <p className="mt-0.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</p>
            {meta && <p className="mt-1 text-base text-ink-2">{meta}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          {time && <p className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{time}</p>}
          {waitMins != null && (
            <p className="mt-0.5 text-base font-semibold text-ink-3">
              {tomorrow ? "tomorrow · " : "in "}{fmtCountdown(waitMins)}
            </p>
          )}
          {right}
        </div>
      </div>
    </div>
  );
}

// SegmentToggle — segmented control (To Campus / From Campus, Find / Offer…).
export function SegmentToggle({ options, value, onChange, className = "" }) {
  return (
    <div className={`inline-flex rounded-md border border-brd bg-surface p-1 ${className}`}>
      {options.map((opt) => {
        const val = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        const active = value === val;
        return (
          <button
            key={val}
            onClick={() => onChange(val)}
            className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-base font-semibold transition-colors ${
              active ? "bg-brand text-white shadow-sm" : "text-ink-2 hover:bg-surface-2"
            }`}
          >
            {typeof opt !== "string" && opt.icon && <Icon name={opt.icon} size={15} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

