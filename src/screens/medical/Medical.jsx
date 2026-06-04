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
  nowDhakaMinutes, dhakaParts, useTick, useLocalState,
} from "../../components/featureKit.jsx";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { fmtDate, relativeDate, todayISO } from "../../lib/helpers.js";

// ============================================================================
// FEATURE 3 — Medical Center / Appointments  (signature accent: teal)
// Doctor browse, booking flow (date → slot grid → token), My Appointments,
// staff today's queue, dashboard widget.
// ============================================================================

// Doctors are live reference data now (public.doctors, seeded in 0021) — read
// from the store via useApp().doctors / doctorById.

export function dhakaISO(offset = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(Date.now() + offset * 86400000));
}
export function dhakaWeekday(offset = 0) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", weekday: "short" }).format(new Date(Date.now() + offset * 86400000));
}
export function isOnDuty(doc) {
  const wk = dhakaWeekday(0);
  if (!doc.days.includes(wk)) return false;
  const now = nowDhakaMinutes();
  return now >= toMinutes(doc.start) && now <= toMinutes(doc.end);
}
export function slotsFor(doc) {
  const out = [];
  for (let t = toMinutes(doc.start); t < toMinutes(doc.end); t += 20) out.push(minutesToHHMM(t));
  return out;
}
export function nextDutyDates(doc, n = 6) {
  const dates = [];
  for (let off = 0; off < 21 && dates.length < n; off++) {
    if (doc.days.includes(dhakaWeekday(off))) dates.push(dhakaISO(off));
  }
  return dates;
}

export const APPT_TONE = { Booked: "blue", Confirmed: "emerald", Completed: "slate", Cancelled: "red" };
export function ApptBadge({ status }) {
  return <Badge tone={APPT_TONE[status] || "slate"}>{status}</Badge>;
}

// --- Doctor card ------------------------------------------------------------
export function DoctorCard({ doc, onBook }) {
  const onDuty = isOnDuty(doc);
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <Avatar name={doc.name.replace("Dr. ", "")} size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{doc.name}</p>
          <p className="text-xs text-slate-500">{doc.specialty}</p>
        </div>
        {onDuty ? <Badge tone="emerald"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>On duty</Badge> : <Badge tone="slate">Off duty</Badge>}
      </div>
      <div className="mt-4 space-y-1.5 text-xs text-slate-500">
        <p className="flex items-center gap-1.5"><Icon name="Clock" size={13} className="text-slate-400" />{fmtTime(doc.start)} – {fmtTime(doc.end)}</p>
        <p className="flex items-center gap-1.5"><Icon name="CalendarDays" size={13} className="text-slate-400" />{doc.days.join(", ")}</p>
        <p className="flex items-center gap-1.5"><Icon name="MapPin" size={13} className="text-slate-400" />{doc.room}</p>
      </div>
      <div className="mt-4 border-t border-slate-100 pt-3">
        <Button size="sm" full icon="CalendarDays" onClick={onBook}>Book appointment</Button>
      </div>
    </Card>
  );
}

// --- Browse -----------------------------------------------------------------
export function MedicalCenter() {
  const { currentUser, appointments, doctors, dataLoading } = useApp();
  const myUpcoming = appointments.filter((a) => a.studentId === currentUser.id && (a.status === "Booked" || a.status === "Confirmed") && a.date >= dhakaISO(0)).length;
  // Admin-only for now: RLS lets only the row owner or an admin read/advance
  // appointments (0016), so a Staff queue would be empty + non-actionable until a
  // doctor_user_id link exists.
  const canSeeQueue = currentUser.role === "Admin";

  return (
    <AppShell activeKey="medical" title="Medical Center">
      <PageHeader
        title="Medical Center"
        subtitle="Book an appointment with campus doctors."
        action={
          <div className="flex gap-2">
            {canSeeQueue && <Button variant="secondary" icon="ListChecks" onClick={() => navigate("/medical/queue")}>Today's queue</Button>}
            <Button variant="secondary" icon="Ticket" onClick={() => navigate("/medical/appointments")}>
              My Appointments{myUpcoming > 0 ? ` (${myUpcoming})` : ""}
            </Button>
          </div>
        }
      />

      <div className="mb-5 flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
        <AccentTile icon="Stethoscope" tone="teal" size={40} />
        <div>
          <p className="text-sm font-semibold text-slate-900">BUBT Medical Center</p>
          <p className="text-xs text-slate-600">Ground floor, Student Welfare Building · Open Sat–Wed, 9:00 AM – 5:00 PM</p>
        </div>
      </div>

      {dataLoading ? (
        <Loading />
      ) : doctors.length === 0 ? (
        <EmptyState icon="Stethoscope" title="No doctors available" message="Check back soon — the medical center roster will appear here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {doctors.map((d) => (
            <DoctorCard key={d.id} doc={d} onBook={() => navigate(`/medical/${d.id}`)} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

// --- Booking ----------------------------------------------------------------
export function DoctorBooking({ id }) {
  const { doctorById, addAppointment, getBookedSlots, dataLoading } = useApp();
  const toast = useToast();
  const doc = doctorById(id);
  const [date, setDate] = React.useState("");
  const [slot, setSlot] = React.useState(null);
  const [confirm, setConfirm] = React.useState(false);
  const [done, setDone] = React.useState(null); // booked appt
  const [taken, setTaken] = React.useState(new Set());
  const [booking, setBooking] = React.useState(false);

  // Pick the first on-duty date once the doctor has loaded.
  React.useEffect(() => {
    if (doc && !date) {
      const ds = nextDutyDates(doc);
      if (ds.length) setDate(ds[0]);
    }
  }, [doc, date]);

  // Taken slots come from the booked_slots RPC (RLS hides other students' rows).
  React.useEffect(() => {
    if (!doc || !date) { setTaken(new Set()); return; }
    let active = true;
    getBookedSlots(doc.id, date).then((slots) => { if (active) setTaken(new Set(slots)); });
    return () => { active = false; };
  }, [doc, date]);

  if (!doc) {
    return (
      <AppShell activeKey="medical" title="Doctor">
        {dataLoading ? <Loading /> : <EmptyState icon="Stethoscope" title="Doctor not found" action={<Button onClick={() => navigate("/medical")}>Back</Button>} />}
      </AppShell>
    );
  }

  const dates = nextDutyDates(doc);
  const slots = slotsFor(doc);

  async function book() {
    setBooking(true);
    const r = await addAppointment({ doctorId: doc.id, date, slot });
    setBooking(false);
    setConfirm(false);
    if (!r.ok) {
      toast({ type: "error", title: "Couldn't book", message: r.error });
      setSlot(null);
      getBookedSlots(doc.id, date).then((s) => setTaken(new Set(s))); // slot may be gone
      return;
    }
    setDone(r.appt);
  }

  return (
    <AppShell activeKey="medical" title="Book Appointment">
      <div className="mx-auto max-w-3xl">
        <button onClick={() => navigate("/medical")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <Icon name="ArrowLeft" size={16} /> Back to doctors
        </button>

        <div className="mb-6 flex items-start gap-3">
          <Avatar name={doc.name.replace("Dr. ", "")} size={48} />
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{doc.name}</h2>
            <p className="text-sm text-slate-500">{doc.specialty} · {doc.room}</p>
          </div>
        </div>

        <Card className="p-6">
          {/* date picker */}
          <p className="text-sm font-medium text-slate-700">Pick a date</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {dates.map((d) => {
              const off = Math.round((new Date(d) - new Date(dhakaISO(0))) / 86400000);
              const label = off === 0 ? "Today" : off === 1 ? "Tomorrow" : dhakaWeekday(off);
              const active = date === d;
              return (
                <button key={d} onClick={() => { setDate(d); setSlot(null); }}
                  className={`flex flex-col items-center rounded-lg border px-3 py-2 text-center transition-colors ${active ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                  <span className={`text-xs ${active ? "text-teal-700" : "text-slate-400"}`}>{label}</span>
                  <span className={`text-sm font-semibold ${active ? "text-slate-900" : "text-slate-700"}`}>{new Date(d).getDate()} {new Intl.DateTimeFormat("en-US",{month:"short",timeZone:"Asia/Dhaka"}).format(new Date(d))}</span>
                </button>
              );
            })}
          </div>

          {/* slot grid */}
          <p className="mt-6 text-sm font-medium text-slate-700">Available time slots</p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {slots.map((s) => {
              const booked = taken.has(s);
              const active = slot === s;
              return (
                <button key={s} disabled={booked} onClick={() => setSlot(s)}
                  className={`rounded-lg border py-2 text-sm font-medium transition-colors ${
                    booked ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through"
                    : active ? "border-teal-500 bg-teal-50 text-teal-700 ring-1 ring-teal-500"
                    : "border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50/40"}`}>
                  {fmtTime(s)}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded border border-slate-200 bg-white"></span>Available</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-slate-100"></span>Booked</span>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">{slot ? <>Selected <span className="font-medium text-slate-900">{fmtTime(slot)}</span></> : "Select a slot to continue"}</p>
            <Button disabled={!slot} icon="Check" onClick={() => setConfirm(true)}>Book appointment</Button>
          </div>
        </Card>
      </div>

      {/* confirm modal */}
      <Modal open={confirm} onClose={() => setConfirm(false)} icon="CalendarCheck" tone="emerald"
        title="Confirm appointment"
        description={`${doc.name} · ${fmtDate(date)} at ${slot ? fmtTime(slot) : ""}. You'll receive a token number.`}
        footer={<>
          <Button variant="secondary" onClick={() => setConfirm(false)}>Back</Button>
          <Button onClick={book} disabled={booking}>{booking ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Confirm booking"}</Button>
        </>}
      />

      {/* token success */}
      <Modal open={!!done} onClose={() => { setDone(null); navigate("/medical/appointments"); }} icon="Ticket" tone="teal"
        title="Appointment booked"
        description="Show this token at the medical center reception on your appointment day."
        footer={<Button onClick={() => { setDone(null); navigate("/medical/appointments"); }}>View my appointments</Button>}
      >
        {done && (
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-teal-700">Your token</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{done.token}</p>
            <p className="mt-1 text-sm text-slate-600">{doc.name} · {fmtDate(done.date)} at {fmtTime(done.slot)}</p>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

// --- My Appointments --------------------------------------------------------
export function MyAppointments() {
  const { currentUser, appointments, cancelAppointment, doctorById } = useApp();
  const toast = useToast();
  const [tab, setTab] = React.useState("Upcoming");
  const [toCancel, setToCancel] = React.useState(null);

  const mine = appointments.filter((a) => a.studentId === currentUser.id);
  const today = dhakaISO(0);
  const upcoming = mine.filter((a) => (a.status === "Booked" || a.status === "Confirmed") && a.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = mine.filter((a) => !((a.status === "Booked" || a.status === "Confirmed") && a.date >= today)).sort((a, b) => b.date.localeCompare(a.date));
  const rows = tab === "Upcoming" ? upcoming : past;

  async function doCancel() {
    const r = await cancelAppointment(toCancel.id);
    if (!r.ok) { toast({ type: "error", title: "Couldn't cancel", message: r.error }); return; }
    toast({ type: "success", title: "Appointment cancelled", message: `Token ${toCancel.token} released.` });
    setToCancel(null);
  }

  return (
    <AppShell activeKey="medical" title="My Appointments">
      <PageHeader title="My Appointments" subtitle="Your bookings at the campus medical center."
        action={<Button icon="Plus" onClick={() => navigate("/medical")}>Book new</Button>} />

      <div className="mb-5"><FilterTabs options={["Upcoming", "Past"]} value={tab} onChange={setTab} counts={{ Upcoming: upcoming.length, Past: past.length }} /></div>

      {rows.length === 0 ? (
        <EmptyState icon="CalendarDays" title={`No ${tab.toLowerCase()} appointments`}
          message={tab === "Upcoming" ? "Book a doctor to see your appointments here." : "Your past visits will appear here."}
          action={tab === "Upcoming" ? <Button icon="Stethoscope" onClick={() => navigate("/medical")}>Find a doctor</Button> : null} />
      ) : (
        <Card className="divide-y divide-slate-200 overflow-hidden">
          {rows.map((a) => {
            const doc = doctorById(a.doctorId);
            const canCancel = (a.status === "Booked" || a.status === "Confirmed") && a.date >= today;
            return (
              <div key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <Avatar name={(doc?.name || "Dr").replace("Dr. ", "")} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{doc?.name || "Doctor"}</p>
                  <p className="text-xs text-slate-500">{doc?.specialty} · {fmtDate(a.date)} at {fmtTime(a.slot)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{a.token}</span>
                  <ApptBadge status={a.status} />
                  {canCancel && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setToCancel(a)}>Cancel</Button>}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Modal open={!!toCancel} onClose={() => setToCancel(null)} icon="CalendarX" tone="red"
        title="Cancel this appointment?"
        description={toCancel ? `${doctorById(toCancel.doctorId)?.name} · ${fmtDate(toCancel.date)} at ${fmtTime(toCancel.slot)}. The slot will be released.` : ""}
        footer={<>
          <Button variant="secondary" onClick={() => setToCancel(null)}>Keep it</Button>
          <Button variant="destructive" onClick={doCancel}>Cancel appointment</Button>
        </>} />
    </AppShell>
  );
}

// --- Staff: today's queue ---------------------------------------------------
export function DoctorQueue() {
  const { currentUser, appointments, userById, setAppointmentStatus, doctorById } = useApp();
  const toast = useToast();
  React.useEffect(() => { if (currentUser.role !== "Admin") navigate("/medical"); }, [currentUser]);
  const today = dhakaISO(0);
  const queue = appointments.filter((a) => a.date === today && a.status !== "Cancelled")
    .sort((a, b) => a.slot.localeCompare(b.slot));

  async function advance(a) {
    const next = a.status === "Booked" ? "Confirmed" : a.status === "Confirmed" ? "Completed" : "Completed";
    const r = await setAppointmentStatus(a.id, next);
    if (!r.ok) { toast({ type: "error", title: "Couldn't update", message: r.error }); return; }
    toast({ type: "success", title: `Marked ${next}`, message: `Token ${a.token}.` });
  }

  return (
    <AppShell activeKey="medical" title="Today's Queue">
      <PageHeader title="Today's queue" subtitle={`${fmtDate(today)} · ${queue.length} appointments at the medical center.`}
        action={<Button variant="secondary" icon="ArrowLeft" onClick={() => navigate("/medical")}>Back</Button>} />
      {queue.length === 0 ? (
        <EmptyState icon="ClipboardCheck" title="No appointments today" message="Booked appointments for today will appear here." />
      ) : (
        <Card className="divide-y divide-slate-200 overflow-hidden">
          {queue.map((a) => {
            const doc = doctorById(a.doctorId);
            const patient = userById(a.studentId);
            return (
              <div key={a.id} className="flex items-center gap-4 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-sm font-bold text-teal-700">{a.token}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{patient?.name || "Patient"}</p>
                  <p className="text-xs text-slate-500">{fmtTime(a.slot)} · {doc?.name} ({doc?.specialty})</p>
                </div>
                <ApptBadge status={a.status} />
                {a.status !== "Completed" && (
                  <Button size="sm" variant="secondary" icon={a.status === "Booked" ? "Check" : "CheckCheck"} onClick={() => advance(a)}>
                    {a.status === "Booked" ? "Confirm" : "Complete"}
                  </Button>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </AppShell>
  );
}

// --- Dashboard widget -------------------------------------------------------
export function MedicalWidget() {
  const { currentUser, appointments, doctorById } = useApp();
  const today = dhakaISO(0);
  const next = appointments
    .filter((a) => a.studentId === currentUser.id && (a.status === "Booked" || a.status === "Confirmed") && a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return (
    <button onClick={() => navigate(next ? "/medical/appointments" : "/medical")} className="group flex w-full items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50/40">
      <AccentTile icon="Stethoscope" tone="teal" size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{next ? "Next appointment" : "Medical Center"}</p>
        <p className="truncate text-xs text-slate-500">
          {next ? `${doctorById(next.doctorId)?.name} · ${fmtDate(next.date)} · ${next.token}` : "Book an appointment with a campus doctor"}
        </p>
      </div>
      <Icon name="ArrowRight" size={18} className="text-slate-300 group-hover:text-teal-500" />
    </button>
  );
}
