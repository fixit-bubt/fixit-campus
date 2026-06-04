import React from "react";
import { Icon } from "../../components/Icon.jsx";
import {
  Button, Card, Badge, StatusBadge, Field, Input, Textarea, Select, FileUpload,
  EmptyState, Modal, Avatar, Spinner, Skeleton, StatCard, Loading, useToast,
} from "../../components/ui.jsx";
import { AppShell, PageHeader, ROLE_TONE } from "../../components/AppShell.jsx";
import { FilterTabs } from "../../components/FilterTabs.jsx";
import {
  AccentTile, CountdownBanner, SegmentToggle, RevealContact, SectionTitle,
  taka, fmtTime, fmtCountdown, nextDeparture, toMinutes, minutesToHHMM,
  nowDhakaMinutes, dhakaParts, useTick,
} from "../../components/featureKit.jsx";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { fmtDate, relativeDate, todayISO } from "../../lib/helpers.js";

// ============================================================================
// FEATURE 2 — Prayer Times  (signature accent: emerald)
// Next-prayer countdown, daily list (Azan + Jamaat, current highlighted),
// month table, Ramadan Sehri/Iftar strip, musallah location, admin adjust.
// ============================================================================

// Prayer times are live config now (public.prayer_times, seeded in 0023) — read
// from the store via useApp().prayerTimes. Icons are a UI concern, mapped by key.
export const PRAYER_ICONS = { fajr: "Sunrise", dhuhr: "Sun", asr: "Sun", maghrib: "Sunset", isha: "Moon", jummah: "Users" };

// Forced on to showcase the strip; in production this is Hijri-date driven.
export const SHOW_RAMADAN_STRIP = true;

export function hijriDate() {
  try {
    return new Intl.DateTimeFormat("en-US-u-ca-islamic", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date());
  } catch (e) {
    return "";
  }
}
export function gregorianDhaka() {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date());
}
export function isFridayDhaka() {
  return dhakaParts().weekday === "Fri";
}

// Builds the daily prayer list (with icons) + the Jummah row from live config.
// `displayList` applies the Friday substitution (Jummah replaces Dhuhr) so the
// screen and the dashboard widget compute "next prayer" identically.
export function usePrayerSchedule() {
  const { prayerTimes } = useApp();
  const withIcon = (p) => ({ ...p, icon: PRAYER_ICONS[p.key] || "Clock" });
  const list = plist(prayerTimes).map(withIcon);
  const jummahRow = prayerTimes.find((p) => p.key === "jummah");
  const jummah = jummahRow ? withIcon(jummahRow) : null;
  const displayList = isFridayDhaka() && jummah
    ? list.map((p) => (p.key === "dhuhr" ? jummah : p))
    : list;
  return { list, jummah, displayList };
}
function plist(prayerTimes) {
  return prayerTimes.filter((p) => p.key !== "jummah");
}

export function prayerState(list) {
  const now = nowDhakaMinutes();
  let currentIdx = -1;
  list.forEach((p, i) => { if (toMinutes(p.azan) <= now) currentIdx = i; });
  // next azan
  let next = list.find((p) => toMinutes(p.azan) > now);
  let tomorrow = false;
  if (!next) { next = list[0]; tomorrow = true; }
  const wait = tomorrow ? 24 * 60 - now + toMinutes(next.azan) : toMinutes(next.azan) - now;
  return { currentIdx, next, tomorrow, wait };
}

// --- Daily list row ---------------------------------------------------------
export function PrayerRow({ prayer, state, isNext }) {
  const passed = state === "passed";
  const current = state === "current";
  return (
    <div className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors ${
      current ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
    }`}>
      <AccentTile icon={prayer.icon} tone={current ? "emerald" : "slate"} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold ${passed ? "text-slate-400" : "text-slate-900"}`}>{prayer.en}</p>
          <span className={`text-sm ${passed ? "text-slate-300" : "text-slate-400"}`} dir="rtl">{prayer.ar}</span>
          {current && <Badge tone="emerald">Now</Badge>}
          {isNext && !current && <Badge tone="slate">Next</Badge>}
        </div>
      </div>
      <div className="text-right whitespace-nowrap">
        <p className={`text-xs ${passed ? "text-slate-300" : "text-slate-400"}`}>Azan</p>
        <p className={`text-sm font-medium ${passed ? "text-slate-400" : "text-slate-700"}`}>{fmtTime(prayer.azan)}</p>
      </div>
      <div className="w-px self-stretch bg-slate-100"></div>
      <div className="text-right whitespace-nowrap">
        <p className={`text-xs ${passed ? "text-slate-300" : "text-slate-400"}`}>Jamaat</p>
        <p className={`text-sm font-bold ${current ? "text-emerald-700" : passed ? "text-slate-400" : "text-slate-900"}`}>{fmtTime(prayer.jamaat)}</p>
      </div>
    </div>
  );
}

// --- Month table ------------------------------------------------------------
// Computed client-side from the live base Azan times (a tiny deterministic
// drift so the month reads realistically). `base` maps key -> 'HH:MM'.
export function monthRows(base) {
  const p = dhakaParts();
  const year = parseInt(p.year, 10);
  const monthIdx = new Date(`${p.month} 1, ${year}`).getMonth();
  const today = parseInt(p.day, 10);
  const days = new Date(year, monthIdx + 1, 0).getDate();
  const rows = [];
  for (let d = 1; d <= days; d++) {
    const drift = Math.round(Math.sin(d / 5) * 3);
    rows.push({
      day: d,
      isToday: d === today,
      fajr: minutesToHHMM(toMinutes(base.fajr) + Math.round(drift / 2)),
      dhuhr: minutesToHHMM(toMinutes(base.dhuhr) + (d > 15 ? 1 : 0)),
      asr: minutesToHHMM(toMinutes(base.asr) + drift),
      maghrib: minutesToHHMM(toMinutes(base.maghrib) + Math.round(drift / 2) + (d > 15 ? 2 : 0)),
      isha: minutesToHHMM(toMinutes(base.isha) + Math.round(drift / 2)),
    });
  }
  return rows;
}

export function PrayerTimes() {
  const { currentUser, dataLoading, updatePrayerJamaat } = useApp();
  const { list, jummah, displayList } = usePrayerSchedule();
  const toast = useToast();
  const [view, setView] = React.useState("today");
  const [adjust, setAdjust] = React.useState(null); // prayer being edited
  const [adjVal, setAdjVal] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  useTick();

  if (dataLoading || list.length === 0) {
    return (
      <AppShell activeKey="prayer" title="Prayer Times">
        <PageHeader title="Prayer Times" subtitle="Daily salah schedule for the campus musallah, Dhaka." />
        {dataLoading ? <Loading /> : <EmptyState icon="Moon" title="Prayer times not set" message="The campus prayer schedule will appear here once configured." />}
      </AppShell>
    );
  }

  const friday = isFridayDhaka();
  const st = prayerState(displayList);
  // Look up by key (not position) — the table is admin-editable, so a row could
  // be missing; the Ramadan strip below only renders when both are present.
  const fajr = list.find((p) => p.key === "fajr");
  const maghrib = list.find((p) => p.key === "maghrib");
  const base = Object.fromEntries(list.map((p) => [p.key, p.azan]));

  function openAdjust(p) { setAdjust(p); setAdjVal(p.jamaat); }
  async function saveAdjust() {
    setSaving(true);
    const r = await updatePrayerJamaat(adjust.key, adjVal);
    setSaving(false);
    if (!r.ok) { toast({ type: "error", title: "Couldn't update", message: r.error }); return; }
    toast({ type: "success", title: "Jamaat time updated", message: `${adjust.en} jamaat set to ${fmtTime(adjVal)}.` });
    setAdjust(null);
  }

  return (
    <AppShell activeKey="prayer" title="Prayer Times">
      <PageHeader title="Prayer Times" subtitle="Daily salah schedule for the campus musallah, Dhaka." />

      <CountdownBanner
        tone="emerald"
        icon={st.next.icon}
        eyebrow="Next prayer"
        title={`${st.next.en} · Azan ${fmtTime(st.next.azan)}`}
        waitMins={st.wait}
        tomorrow={st.tomorrow}
        meta={`${gregorianDhaka()} · ${hijriDate()}`}
      />

      {SHOW_RAMADAN_STRIP && fajr && maghrib && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <AccentTile icon="Moon" tone="emerald" size={40} />
            <div><p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Sehri ends</p><p className="text-lg font-bold text-slate-900">{fmtTime(fajr.azan)}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <AccentTile icon="Sunset" tone="amber" size={40} />
            <div><p className="text-xs font-medium uppercase tracking-wide text-amber-700">Iftar</p><p className="text-lg font-bold text-slate-900">{fmtTime(maghrib.azan)}</p></div>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <SegmentToggle options={[{ value: "today", label: "Today" }, { value: "month", label: "This month" }]} value={view} onChange={setView} />
        {friday && <Badge tone="emerald" icon="Users">Jummah today</Badge>}
      </div>

      {view === "today" ? (
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="space-y-2.5 lg:col-span-2">
            {displayList.map((p, i) => (
              <div key={p.key} className="group relative">
                <PrayerRow prayer={p} state={i === st.currentIdx ? "current" : toMinutes(p.azan) <= nowDhakaMinutes() ? "passed" : "upcoming"} isNext={p.key === st.next.key} />
                {currentUser.role === "Admin" && (
                  <button onClick={() => openAdjust(p)} title="Adjust jamaat" className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-lg bg-white/90 p-1.5 text-slate-400 shadow-sm hover:text-emerald-600 group-hover:block">
                    <Icon name="Pencil" size={14} />
                  </button>
                )}
              </div>
            ))}
            {!friday && (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
                <Icon name="Users" size={14} className="text-slate-400" /> Jummah jamaat is at {fmtTime(jummah?.jamaat || "13:15")} every Friday (replaces Dhuhr).
              </div>
            )}
          </div>
          <div>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900">Campus musallah</h3>
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <Icon name="MapPin" size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div><p className="font-medium text-slate-900">Central Musallah</p><p className="text-xs text-slate-500">4th floor, Main Academic Building</p></div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Icon name="MapPin" size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div><p className="font-medium text-slate-900">Women's Musallah</p><p className="text-xs text-slate-500">2nd floor, Annex Building</p></div>
                </div>
              </div>
              {currentUser.role === "Admin" && (
                <p className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-400">
                  <Icon name="Info" size={13} /> Hover a prayer to adjust its jamaat time.
                </p>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Fajr</th>
                  <th className="px-4 py-2.5 font-medium">Dhuhr</th>
                  <th className="px-4 py-2.5 font-medium">Asr</th>
                  <th className="px-4 py-2.5 font-medium">Maghrib</th>
                  <th className="px-4 py-2.5 font-medium">Isha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthRows(base).map((r) => (
                  <tr key={r.day} className={r.isToday ? "bg-emerald-50/60" : "hover:bg-slate-50"}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{r.day}{r.isToday && <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">Today</span>}</td>
                    <td className="px-4 py-2.5 text-slate-600">{fmtTime(r.fajr)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{fmtTime(r.dhuhr)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{fmtTime(r.asr)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{fmtTime(r.maghrib)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{fmtTime(r.isha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={!!adjust}
        onClose={() => setAdjust(null)}
        icon="Clock"
        tone="emerald"
        title={adjust ? `Adjust ${adjust.en} jamaat` : ""}
        description="Set the congregation (jamaat) time for the campus musallah."
        footer={<>
          <Button variant="secondary" onClick={() => setAdjust(null)}>Cancel</Button>
          <Button onClick={saveAdjust} disabled={saving}>{saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Save time"}</Button>
        </>}
      >
        <Field label="Jamaat time" htmlFor="adj">
          <Input id="adj" type="time" value={adjVal} onChange={(e) => setAdjVal(e.target.value)} />
        </Field>
      </Modal>
    </AppShell>
  );
}

// --- Dashboard widget -------------------------------------------------------
export function PrayerWidget() {
  const { displayList } = usePrayerSchedule();
  useTick();
  if (displayList.length === 0) return null;
  const st = prayerState(displayList);
  return (
    <button onClick={() => navigate("/prayer")} className="group flex w-full items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40">
      <AccentTile icon={st.next.icon} tone="emerald" size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">Next prayer · {st.next.en}</p>
        <p className="truncate text-xs text-slate-500">Azan {fmtTime(st.next.azan)} · in {fmtCountdown(st.wait)}</p>
      </div>
      <Icon name="ArrowRight" size={18} className="text-slate-300 group-hover:text-emerald-500" />
    </button>
  );
}
