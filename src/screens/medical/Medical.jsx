import React from "react";
import { Icon } from "../../components/Icon.jsx";
import { Card, Badge, Avatar, EmptyState, Loading } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { AccentTile, fmtTime, toMinutes, nowDhakaMinutes } from "../../components/featureKit.jsx";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";

// ============================================================================
// FEATURE 3 — Medical Center  (signature accent: teal)
// Read-only directory of campus doctors: schedule, duty status, room.
// Appointment booking was removed — the medical center doesn't take bookings.
// ============================================================================

// Doctors are live reference data (public.doctors, seeded in 0021) — read from
// the store via useApp().doctors.

export function dhakaWeekday(offset = 0) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", weekday: "short" }).format(new Date(Date.now() + offset * 86400000));
}
export function isOnDuty(doc) {
  const wk = dhakaWeekday(0);
  if (!doc.days.includes(wk)) return false;
  const now = nowDhakaMinutes();
  return now >= toMinutes(doc.start) && now <= toMinutes(doc.end);
}

// --- Doctor card ------------------------------------------------------------
export function DoctorCard({ doc }) {
  const onDuty = isOnDuty(doc);
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <Avatar name={doc.name.replace("Dr. ", "")} size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">{doc.name}</p>
          <p className="text-xs text-ink-3">{doc.specialty}</p>
        </div>
        {onDuty ? <Badge tone="emerald"><span className="h-1.5 w-1.5 rounded-full bg-success"></span>On duty</Badge> : <Badge tone="slate">Off duty</Badge>}
      </div>
      <div className="mt-4 space-y-1.5 text-xs text-ink-3">
        <p className="flex items-center gap-1.5"><Icon name="Clock" size={13} className="text-ink-3" />{fmtTime(doc.start)} – {fmtTime(doc.end)}</p>
        <p className="flex items-center gap-1.5"><Icon name="CalendarDays" size={13} className="text-ink-3" />{doc.days.join(", ")}</p>
        <p className="flex items-center gap-1.5"><Icon name="MapPin" size={13} className="text-ink-3" />{doc.room}</p>
      </div>
    </Card>
  );
}

// --- Browse -----------------------------------------------------------------
export function MedicalCenter() {
  const { doctors, dataLoading } = useApp();

  return (
    <AppShell activeKey="medical" title="Medical Center">
      <PageHeader
        title="Medical Center"
        subtitle="Campus doctors, schedules, and consultation rooms."
      />

      <div className="mb-5 flex items-center gap-3 rounded-md border border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 px-4 py-3">
        <AccentTile icon="Stethoscope" tone="teal" size={40} />
        <div>
          <p className="text-base font-semibold text-ink">BUBT Medical Center</p>
          <p className="text-xs text-ink-2">Ground floor, Student Welfare Building · Open Sat–Wed, 9:00 AM – 5:00 PM</p>
        </div>
      </div>

      {dataLoading ? (
        <Loading />
      ) : doctors.length === 0 ? (
        <EmptyState icon="Stethoscope" title="No doctors available" message="Check back soon — the medical center roster will appear here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {doctors.map((d) => (
            <DoctorCard key={d.id} doc={d} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

// --- Dashboard widget -------------------------------------------------------
export function MedicalWidget() {
  return (
    <button onClick={() => navigate("/medical")} className="group flex w-full items-center gap-4 rounded-md border border-brd bg-surface p-5 text-left shadow-sm transition-colors hover:border-teal-300 dark:hover:border-teal-500/40 hover:bg-teal-50/40 dark:hover:bg-teal-500/10">
      <AccentTile icon="Stethoscope" tone="teal" size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-ink">Medical Center</p>
        <p className="truncate text-xs text-ink-3">Campus doctors, schedules &amp; consultation rooms</p>
      </div>
      <Icon name="ArrowRight" size={18} className="text-ink-3 group-hover:text-teal-500 dark:group-hover:text-teal-300" />
    </button>
  );
}
