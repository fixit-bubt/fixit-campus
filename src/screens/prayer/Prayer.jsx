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
    <div className={`flex items-center gap-4 rounded-md border px-4 py-3 transition-colors ${
      current ? "border-success bg-success-bg" : "border-brd bg-surface"
    }`}>
      <AccentTile icon={prayer.icon} tone={current ? "emerald" : "slate"} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`text-base font-semibold ${passed ? "text-ink-3" : "text-ink"}`}>{prayer.en}</p>
          <span className={`text-base ${passed ? "text-ink-3" : "text-ink-3"}`} dir="rtl">{prayer.ar}</span>
          {current && <Badge tone="emerald">Now</Badge>}
          {isNext && !current && <Badge tone="slate">Next</Badge>}
        </div>
      </div>
      <div className="text-right whitespace-nowrap">
        <p className={`text-xs ${passed ? "text-ink-3" : "text-ink-3"}`}>Azan</p>
        <p className={`text-base font-semibold ${passed ? "text-ink-3" : "text-ink-2"}`}>{fmtTime(prayer.azan)}</p>
      </div>
      <div className="w-px self-stretch bg-surface-3"></div>
      <div className="text-right whitespace-nowrap">
        <p className={`text-xs ${passed ? "text-ink-3" : "text-ink-3"}`}>Jamaat</p>
        <p className={`text-base font-bold ${current ? "text-success" : passed ? "text-ink-3" : "text-ink"}`}>{fmtTime(prayer.jamaat)}</p>
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
  const { currentUser, dataLoading, updatePrayerJamaat,
    musallahLocations, addMusallahLocation, updateMusallahLocation, deleteMusallahLocation } = useApp();
  const { list, jummah, displayList } = usePrayerSchedule();
  const toast = useToast();
  const [view, setView] = React.useState("today");
  const [adjust, setAdjust] = React.useState(null); // prayer being edited
  const [adjVal, setAdjVal] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  // Musallah location edit state (admin only)
  const [locModal, setLocModal] = React.useState(null); // null | { mode: "add" } | { mode: "edit", loc }
  const [locName, setLocName] = React.useState("");
  const [locFloor, setLocFloor] = React.useState("");
  const [locSaving, setLocSaving] = React.useState(false);
  const [locDeleting, setLocDeleting] = React.useState(false);
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
    if (saving) return;
    setSaving(true);
    try {
      const r = await updatePrayerJamaat(adjust.key, adjVal);
      if (!r.ok) { toast({ type: "error", title: "Couldn't update", message: r.error }); return; }
      toast({ type: "success", title: "Jamaat time updated", message: `${adjust.en} jamaat set to ${fmtTime(adjVal)}.` });
      setAdjust(null);
    } finally {
      setSaving(false);
    }
  }

  function openAddLoc() { setLocName(""); setLocFloor(""); setLocModal({ mode: "add" }); }
  function openEditLoc(loc) { setLocName(loc.name); setLocFloor(loc.floorDesc); setLocModal({ mode: "edit", loc }); }
  async function saveLocModal() {
    if (locSaving || !locName.trim()) return;
    setLocSaving(true);
    try {
      const r = locModal.mode === "add"
        ? await addMusallahLocation(locName.trim(), locFloor.trim())
        : await updateMusallahLocation(locModal.loc.id, locName.trim(), locFloor.trim());
      if (!r.ok) { toast({ type: "error", title: "Couldn't save", message: r.error }); return; }
      toast({ type: "success", title: locModal.mode === "add" ? "Location added" : "Location updated" });
      setLocModal(null);
    } finally {
      setLocSaving(false);
    }
  }
  async function deleteLoc(loc) {
    if (locDeleting) return;
    setLocDeleting(true);
    try {
      const r = await deleteMusallahLocation(loc.id);
      if (!r.ok) { toast({ type: "error", title: "Couldn't delete", message: r.error }); return; }
      toast({ type: "success", title: "Location removed" });
    } finally {
      setLocDeleting(false);
    }
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
          <div className="flex items-center gap-3 rounded-md border border-success-bg bg-success-bg p-4">
            <AccentTile icon="Moon" tone="emerald" size={40} />
            <div><p className="text-xs font-semibold uppercase tracking-wide text-success">Sehri ends</p><p className="text-2xl font-bold text-ink">{fmtTime(fajr.azan)}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-warn-bg bg-warn-bg p-4">
            <AccentTile icon="Sunset" tone="amber" size={40} />
            <div><p className="text-xs font-semibold uppercase tracking-wide text-warn">Iftar</p><p className="text-2xl font-bold text-ink">{fmtTime(maghrib.azan)}</p></div>
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
                {currentUser?.role === "Admin" && (
                  <button onClick={() => openAdjust(p)} title="Adjust jamaat" className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-md bg-white/90 p-1.5 text-ink-3 shadow-sm hover:text-success group-hover:block">
                    <Icon name="Pencil" size={14} />
                  </button>
                )}
              </div>
            ))}
            {!friday && (
              <div className="flex items-center gap-2 rounded-md border border-dashed border-brd-2 bg-surface-2 px-4 py-2.5 text-xs text-ink-3">
                <Icon name="Users" size={14} className="text-ink-3" /> Every Friday, Jummah replaces Dhuhr.
              </div>
            )}
          </div>
          <div>
            <Card className="p-5">
              <h3 className="text-base font-semibold text-ink">Campus musallah</h3>
              <div className="mt-3 space-y-3 text-base">
                {musallahLocations.map((loc) => (
                  <div key={loc.id} className="group flex items-start gap-2.5">
                    <Icon name="MapPin" size={16} className="mt-0.5 shrink-0 text-success" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{loc.name}</p>
                      {loc.floorDesc && <p className="text-xs text-ink-3">{loc.floorDesc}</p>}
                    </div>
                    {currentUser?.role === "Admin" && (
                      <div className="hidden gap-1 group-hover:flex">
                        <button onClick={() => openEditLoc(loc)} className="rounded p-1 text-ink-3 hover:text-success" title="Edit location">
                          <Icon name="Pencil" size={13} />
                        </button>
                        <button onClick={() => deleteLoc(loc)} disabled={locDeleting} className="rounded p-1 text-ink-3 hover:text-danger disabled:opacity-40" title="Delete location">
                          <Icon name="Trash2" size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {currentUser?.role === "Admin" && (
                <div className="mt-4 border-t border-brd pt-3 space-y-2">
                  <button onClick={openAddLoc} className="flex items-center gap-1.5 text-xs text-success hover:text-success font-semibold">
                    <Icon name="Plus" size={13} /> Add location
                  </button>
                  <p className="flex items-center gap-1.5 text-xs text-ink-3">
                    <Icon name="Info" size={13} /> Hover a prayer to adjust its jamaat time.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-md border border-brd">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-base">
              <thead>
                <tr className="border-b border-brd bg-surface-2 text-xs uppercase tracking-wide text-ink-3">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Fajr</th>
                  <th className="px-4 py-2.5 font-semibold">Dhuhr</th>
                  <th className="px-4 py-2.5 font-semibold">Asr</th>
                  <th className="px-4 py-2.5 font-semibold">Maghrib</th>
                  <th className="px-4 py-2.5 font-semibold">Isha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brd">
                {monthRows(base).map((r) => (
                  <tr key={r.day} className={r.isToday ? "bg-emerald-50/60 dark:bg-emerald-500/10" : "hover:bg-surface-2"}>
                    <td className="px-4 py-2.5 font-semibold text-ink">{r.day}{r.isToday && <span className="ml-1.5 rounded bg-success-bg px-1.5 py-0.5 text-[10px] font-semibold text-success">Today</span>}</td>
                    <td className="px-4 py-2.5 text-ink-2">{fmtTime(r.fajr)}</td>
                    <td className="px-4 py-2.5 text-ink-2">{fmtTime(r.dhuhr)}</td>
                    <td className="px-4 py-2.5 text-ink-2">{fmtTime(r.asr)}</td>
                    <td className="px-4 py-2.5 text-ink-2">{fmtTime(r.maghrib)}</td>
                    <td className="px-4 py-2.5 text-ink-2">{fmtTime(r.isha)}</td>
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

      <Modal
        open={!!locModal}
        onClose={() => setLocModal(null)}
        icon="MapPin"
        tone="emerald"
        title={locModal?.mode === "add" ? "Add musallah location" : "Edit musallah location"}
        footer={<>
          <Button variant="secondary" onClick={() => setLocModal(null)} disabled={locSaving}>Cancel</Button>
          <Button onClick={saveLocModal} disabled={locSaving || !locName.trim()}>
            {locSaving ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Save"}
          </Button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Location name" htmlFor="loc-name" required>
            <Input id="loc-name" placeholder="e.g. Central Musallah" value={locName} onChange={(e) => setLocName(e.target.value)} />
          </Field>
          <Field label="Floor / building" htmlFor="loc-floor" hint="Optional">
            <Input id="loc-floor" placeholder="e.g. 4th floor, Main Academic Building" value={locFloor} onChange={(e) => setLocFloor(e.target.value)} />
          </Field>
        </div>
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
    <button onClick={() => navigate("/prayer")} className="group flex w-full items-center gap-4 rounded-md border border-brd bg-surface p-5 text-left shadow-sm transition-colors hover:border-success hover:bg-success-bg/40">
      <AccentTile icon={st.next.icon} tone="emerald" size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-ink">Next prayer · {st.next.en}</p>
        <p className="truncate text-xs text-ink-3">Azan {fmtTime(st.next.azan)} · in {fmtCountdown(st.wait)}</p>
      </div>
      <Icon name="ArrowRight" size={18} className="text-ink-3 group-hover:text-success" />
    </button>
  );
}
