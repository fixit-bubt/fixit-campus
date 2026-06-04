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
// FEATURE 5 — Ride Share  (signature accent: indigo)
// Browse (Find / Offer intent toggle + filters), detail (WhatsApp after
// requesting), offer form, dashboard widget.
// ============================================================================

export const VEHICLES = ["Car", "CNG", "Bike"];
export const VEHICLE_ICON = { Car: "Car", CNG: "Truck", Bike: "Bike" };
export const DOW = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

export function seatsLeft(ride) {
  return ride.seatsTotal - ride.requesterIds.length;
}

// --- Ride card --------------------------------------------------------------
export function RideCard({ ride, driver, mine, onOpen }) {
  const left = seatsLeft(ride);
  const full = left <= 0;
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={driver?.name || "?"} size={38} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">{mine ? "You" : driver?.name || "Unknown"}</p>
            <p className="text-xs text-slate-400">{ride.direction}</p>
          </div>
        </div>
        <Badge tone="indigo" icon={VEHICLE_ICON[ride.vehicle]}>{ride.vehicle}</Badge>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
        <span className="font-medium text-slate-900">{ride.origin}</span>
        <Icon name="ArrowRight" size={15} className="text-indigo-500" />
        <span className="font-medium text-slate-900">{ride.destination}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-slate-100 py-2">
          <p className="text-[11px] text-slate-400">Departs</p>
          <p className="text-sm font-semibold text-slate-900">{fmtTime(ride.time)}</p>
        </div>
        <div className="rounded-lg border border-slate-100 py-2">
          <p className="text-[11px] text-slate-400">Seats</p>
          <p className={`text-sm font-semibold ${full ? "text-red-600" : "text-slate-900"}`}>{left}/{ride.seatsTotal}</p>
        </div>
        <div className="rounded-lg border border-slate-100 py-2">
          <p className="text-[11px] text-slate-400">Fare/seat</p>
          <p className="text-sm font-semibold text-slate-900">{taka(ride.fare)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span className="inline-flex items-center gap-1"><Icon name="Calendar" size={13} />{fmtDate(ride.date)}</span>
        {full ? <Badge tone="red">Full</Badge> : <Badge tone="emerald">Seats available</Badge>}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <Button size="sm" full variant={full ? "secondary" : "primary"} iconRight="ArrowRight" onClick={onOpen} disabled={full && !mine}>
          {mine ? "Manage ride" : full ? "Full" : "Request seat"}
        </Button>
      </div>
    </Card>
  );
}

// --- Browse -----------------------------------------------------------------
export function RideShare() {
  const { currentUser, rides, userById, dataLoading } = useApp();
  const [intent, setIntent] = React.useState("find");
  const [direction, setDirection] = React.useState("All");
  const [area, setArea] = React.useState("");

  const mineRides = rides.filter((r) => r.driverId === currentUser.id);
  const findRides = rides
    .filter((r) => r.driverId !== currentUser.id)
    .filter((r) => direction === "All" || r.direction === direction)
    .filter((r) => {
      const q = area.trim().toLowerCase();
      if (!q) return true;
      return r.origin.toLowerCase().includes(q) || r.destination.toLowerCase().includes(q);
    })
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return (
    <AppShell activeKey="rideshare" title="Ride Share">
      <PageHeader title="Ride Share" subtitle="Share rides to and from campus with fellow students."
        action={<Button icon="Plus" onClick={() => navigate("/rides/new")}>Offer a Ride</Button>} />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentToggle
          options={[{ value: "find", label: "Find a Ride", icon: "Search" }, { value: "offer", label: "My Rides", icon: "Car" }]}
          value={intent} onChange={setIntent}
        />
        {intent === "find" && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:w-56">
              <Icon name="MapPin" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Filter by area…"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30" />
            </div>
            <Select value={direction} onChange={(e) => setDirection(e.target.value)} className="sm:w-44">
              <option value="All">Any direction</option>
              <option value="To Campus">To Campus</option>
              <option value="From Campus">From Campus</option>
            </Select>
          </div>
        )}
      </div>

      {dataLoading ? (
        <Loading />
      ) : intent === "find" ? (
        findRides.length === 0 ? (
          <EmptyState icon="Car" title="No rides match" message="Try clearing filters, or offer a ride yourself." action={<Button variant="secondary" onClick={() => { setArea(""); setDirection("All"); }}>Clear filters</Button>} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {findRides.map((r) => <RideCard key={r.id} ride={r} driver={userById(r.driverId)} onOpen={() => navigate(`/rides/${r.id}`)} />)}
          </div>
        )
      ) : mineRides.length === 0 ? (
        <EmptyState icon="Car" title="You haven't offered a ride" message="Post a ride to share seats and split fare." action={<Button icon="Plus" onClick={() => navigate("/rides/new")}>Offer a Ride</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {mineRides.map((r) => <RideCard key={r.id} ride={r} driver={currentUser} mine onOpen={() => navigate(`/rides/${r.id}`)} />)}
        </div>
      )}
    </AppShell>
  );
}

// Driver's contact, shown to a requester after they request a seat. Offering a
// ride is consent, so the driver's number is always revealed (via the
// ride_contact RPC) — unless the driver never saved one.
function DriverContact({ code, driverId, driverName }) {
  const { getRideContact } = useApp();
  const [phase, setPhase] = React.useState("idle"); // idle | loading | done
  const [contact, setContact] = React.useState(null);

  async function reveal() {
    setPhase("loading");
    setContact(await getRideContact(code, driverId));
    setPhase("done");
  }

  if (phase !== "done") {
    return (
      <button onClick={reveal} disabled={phase === "loading"}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60">
        <Icon name="MessageCircle" size={16} /> {phase === "loading" ? "Getting contact…" : "Show driver's WhatsApp"}
      </button>
    );
  }

  const wa = contact?.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, "")}` : null;
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
        <Icon name="CircleCheck" size={16} /> {contact?.name || driverName || "Driver"}
      </div>
      {wa ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <p className="truncate text-sm text-slate-600">{contact.whatsapp}</p>
          <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700">
            <Icon name="MessageCircle" size={16} /> WhatsApp
          </a>
        </div>
      ) : (
        <p className="mt-1 text-xs text-slate-500">This driver hasn't shared a WhatsApp number yet.</p>
      )}
      <p className="mt-2 text-xs text-slate-400">Coordinate pickup and fare with the driver on WhatsApp.</p>
    </div>
  );
}

// A requester's contact, shown to the ride's driver — but only if that requester
// opted in via show_whatsapp (gated inside the ride_contact RPC).
function RequesterContact({ code, requesterId }) {
  const { getRideContact } = useApp();
  const [phase, setPhase] = React.useState("idle"); // idle | loading | done
  const [contact, setContact] = React.useState(null);

  async function reveal() {
    setPhase("loading");
    setContact(await getRideContact(code, requesterId));
    setPhase("done");
  }

  if (phase === "done") {
    const wa = contact?.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, "")}` : null;
    return wa ? (
      <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700">
        <Icon name="MessageCircle" size={14} /> Chat
      </a>
    ) : (
      <span className="shrink-0 text-xs text-slate-400">No number shared</span>
    );
  }
  return (
    <button onClick={reveal} disabled={phase === "loading"}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60">
      <Icon name="MessageCircle" size={14} /> {phase === "loading" ? "…" : "Contact"}
    </button>
  );
}

// --- Detail -----------------------------------------------------------------
export function RideDetail({ id }) {
  const { currentUser, rides, userById, requestSeat, deleteRide, dataLoading } = useApp();
  const toast = useToast();
  const ride = rides.find((r) => r.id === id);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  if (!ride) {
    return (
      <AppShell activeKey="rideshare" title="Ride">
        {dataLoading ? <Loading /> : <EmptyState icon="Car" title="Ride not found" action={<Button onClick={() => navigate("/rides")}>Back to Ride Share</Button>} />}
      </AppShell>
    );
  }
  const driver = userById(ride.driverId);
  const mine = ride.driverId === currentUser.id;
  const requested = ride.requesterIds.includes(currentUser.id);
  const left = seatsLeft(ride);

  return (
    <AppShell activeKey="rideshare" title="Ride Details">
      <div className="mx-auto max-w-3xl">
        <button onClick={() => navigate("/rides")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <Icon name="ArrowLeft" size={16} /> Back to Ride Share
        </button>

        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AccentTile icon={VEHICLE_ICON[ride.vehicle]} tone="indigo" size={48} />
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{ride.origin} → {ride.destination}</h2>
              <p className="text-sm text-slate-400">{ride.direction} · {ride.vehicle}</p>
            </div>
          </div>
          {mine && <Button variant="secondary" icon="Trash2" className="text-red-600" onClick={() => setConfirmDelete(true)}>Delete</Button>}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              {[
                { l: "Date", v: fmtDate(ride.date), icon: "Calendar" },
                { l: "Departs", v: fmtTime(ride.time), icon: "Clock" },
                { l: "Seats left", v: `${left}/${ride.seatsTotal}`, icon: "Users" },
                { l: "Fare/seat", v: taka(ride.fare), icon: "Wallet" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="flex items-center gap-1.5 text-xs text-slate-400"><Icon name={s.icon} size={13} />{s.l}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{s.v}</p>
                </div>
              ))}
            </Card>

            {ride.notes && (
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-900">Notes from {mine ? "you" : driver?.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{ride.notes}</p>
              </Card>
            )}

            {ride.recurring && ride.recurring.length > 0 && (
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-900">Recurring days</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {DOW.map((d) => {
                    const on = ride.recurring.includes(d);
                    return <span key={d} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${on ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400"}`}>{d}</span>;
                  })}
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            {mine ? (
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-900">Seat requests</h3>
                {ride.requesterIds.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">No requests yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {ride.requesterIds.map((uid) => {
                      const u = userById(uid);
                      return (
                        <div key={uid} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                          <div className="flex items-center gap-2 min-w-0"><Avatar name={u?.name || "?"} size={26} /><span className="truncate text-sm text-slate-700">{u?.name}</span></div>
                          <RequesterContact code={ride.id} requesterId={uid} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-900">{requested ? "Seat requested" : "Request a seat"}</h3>
                {requested ? (
                  <div className="mt-3">
                    <DriverContact code={ride.id} driverId={ride.driverId} driverName={driver?.name} />
                  </div>
                ) : left <= 0 ? (
                  <p className="mt-2 text-sm text-red-600">This ride is full.</p>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-slate-500">Request a seat to get the driver's WhatsApp and confirm.</p>
                    <Button className="mt-3" full icon="Check" onClick={async () => { const r = await requestSeat(ride.id); if (!r.ok) { toast({ type: "error", title: "Couldn't request seat", message: r.error }); return; } toast({ type: "success", title: "Seat requested", message: "Driver's contact is now available." }); }}>Request a seat</Button>
                  </>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} icon="Trash2" tone="red"
        title="Delete this ride?" description="Your offered ride will be removed and requesters will no longer see it."
        footer={<><Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="destructive" onClick={async () => { const r = await deleteRide(id); if (!r.ok) { toast({ type: "error", title: "Couldn't delete", message: r.error }); return; } toast({ type: "success", title: "Ride deleted" }); navigate("/rides"); }}>Delete ride</Button></>} />
    </AppShell>
  );
}

// --- Offer form -------------------------------------------------------------
export function OfferRide() {
  const { addRide } = useApp();
  const toast = useToast();
  const [form, setForm] = React.useState({ origin: "", destination: "", direction: "To Campus", date: todayISO(), time: "07:30", seatsTotal: "3", fare: "", vehicle: "Car", recurring: [], notes: "" });
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleDay = (d) => setForm((f) => ({ ...f, recurring: f.recurring.includes(d) ? f.recurring.filter((x) => x !== d) : [...f.recurring, d] }));

  function validate() {
    const er = {};
    if (!form.origin.trim()) er.origin = "Enter the pickup point.";
    if (!form.destination.trim()) er.destination = "Enter the destination.";
    if (!form.fare || isNaN(Number(form.fare)) || Number(form.fare) < 0) er.fare = "Enter a fare per seat.";
    if (!form.seatsTotal || Number(form.seatsTotal) < 1) er.seatsTotal = "At least 1 seat.";
    return er;
  }
  async function submit(e) {
    e.preventDefault();
    const er = validate();
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    const r = await addRide({ origin: form.origin.trim(), destination: form.destination.trim(), direction: form.direction, date: form.date, time: form.time, seatsTotal: Number(form.seatsTotal), fare: Number(form.fare), vehicle: form.vehicle, recurring: form.recurring, notes: form.notes.trim() });
    if (!r.ok) { setSaving(false); toast({ type: "error", title: "Couldn't post ride", message: r.error }); return; }
    toast({ type: "success", title: "Ride posted", message: `${form.origin.trim()} → ${form.destination.trim()} is now live.` });
    navigate(`/rides/${r.id}`);
  }

  return (
    <AppShell activeKey="rideshare" title="Offer a Ride">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate("/rides")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <Icon name="ArrowLeft" size={16} /> Back to Ride Share
        </button>
        <PageHeader title="Offer a Ride" subtitle="Share your commute and split the fare." />
        <form onSubmit={submit} className="space-y-6">
          <Card className="space-y-5 p-6">
            <SegmentToggle options={[{ value: "To Campus", label: "To Campus" }, { value: "From Campus", label: "From Campus" }]} value={form.direction} onChange={(v) => set("direction", v)} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="From" htmlFor="ro" required error={errors.origin}><Input id="ro" placeholder="e.g. Uttara Sector 7" value={form.origin} error={!!errors.origin} onChange={(e) => set("origin", e.target.value)} /></Field>
              <Field label="To" htmlFor="rd" required error={errors.destination}><Input id="rd" placeholder="e.g. BUBT Campus" value={form.destination} error={!!errors.destination} onChange={(e) => set("destination", e.target.value)} /></Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Date" htmlFor="rdate"><Input id="rdate" type="date" value={form.date} min={todayISO()} onChange={(e) => set("date", e.target.value)} /></Field>
              <Field label="Departure time" htmlFor="rtime"><Input id="rtime" type="time" value={form.time} onChange={(e) => set("time", e.target.value)} /></Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Seats" htmlFor="rseats" required error={errors.seatsTotal}><Input id="rseats" type="number" min="1" max="6" value={form.seatsTotal} error={!!errors.seatsTotal} onChange={(e) => set("seatsTotal", e.target.value)} /></Field>
              <Field label="Fare/seat (৳)" htmlFor="rfare" required error={errors.fare}><Input id="rfare" type="number" min="0" placeholder="e.g. 80" value={form.fare} error={!!errors.fare} onChange={(e) => set("fare", e.target.value)} /></Field>
              <Field label="Vehicle" htmlFor="rveh"><Select id="rveh" value={form.vehicle} onChange={(e) => set("vehicle", e.target.value)}>{VEHICLES.map((v) => <option key={v}>{v}</option>)}</Select></Field>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Recurring days <span className="text-slate-400">(optional)</span></label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DOW.map((d) => {
                  const on = form.recurring.includes(d);
                  return <button type="button" key={d} onClick={() => toggleDay(d)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${on ? "bg-indigo-100 text-indigo-700" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>{d}</button>;
                })}
              </div>
            </div>
            <Field label="Notes" htmlFor="rnotes" hint="Pickup details, AC, luggage space, etc."><Textarea id="rnotes" rows={3} placeholder="Anything riders should know…" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          </Card>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate("/rides")}>Cancel</Button>
            <Button type="submit" icon="Plus" disabled={saving}>{saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Post ride"}</Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

// --- Dashboard widget -------------------------------------------------------
export function RideWidget() {
  const { currentUser, rides } = useApp();
  const avail = rides.filter((r) => r.driverId !== currentUser.id && seatsLeft(r) > 0).length;
  return (
    <button onClick={() => navigate("/rides")} className="group flex w-full items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/40">
      <AccentTile icon="Car" tone="indigo" size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">Ride Share</p>
        <p className="truncate text-xs text-slate-500">{avail} ride{avail === 1 ? "" : "s"} with seats available</p>
      </div>
      <Icon name="ArrowRight" size={18} className="text-slate-300 group-hover:text-indigo-500" />
    </button>
  );
}
