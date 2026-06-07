import React from "react";
import { Icon } from "./Icon.jsx";

// ============================================================================
// Feature kit — shared building blocks for the campus features.
// Each feature has ONE signature accent tone, used only for icon tiles +
// category badges. Chrome (blue-600 primary) stays identical everywhere.
// ============================================================================

// Full class strings so Tailwind's scanner picks them up.
export const ACCENT_TILE = {
  sky: "bg-sky-100 text-sky-700",
  emerald: "bg-emerald-100 text-emerald-700",
  teal: "bg-teal-100 text-teal-700",
  violet: "bg-violet-100 text-violet-700",
  indigo: "bg-indigo-100 text-indigo-700",
  red: "bg-red-100 text-red-700",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  slate: "bg-slate-100 text-slate-600",
};

export const ACCENT_SOFT = {
  sky: "bg-sky-50 border-sky-200",
  emerald: "bg-emerald-50 border-emerald-200",
  teal: "bg-teal-50 border-teal-200",
  violet: "bg-violet-50 border-violet-200",
  indigo: "bg-indigo-50 border-indigo-200",
  red: "bg-red-50 border-red-200",
  fuchsia: "bg-fuchsia-50 border-fuchsia-200",
  amber: "bg-amber-50 border-amber-200",
  purple: "bg-purple-50 border-purple-200",
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
            {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>}
            <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</p>
            {meta && <p className="mt-1 text-sm text-slate-600">{meta}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          {time && <p className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{time}</p>}
          {waitMins != null && (
            <p className="mt-0.5 text-sm font-medium text-slate-500">
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
    <div className={`inline-flex rounded-lg border border-slate-200 bg-white p-1 ${className}`}>
      {options.map((opt) => {
        const val = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        const active = value === val;
        return (
          <button
            key={val}
            onClick={() => onChange(val)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
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

