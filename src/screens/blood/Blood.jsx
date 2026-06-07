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
// FEATURE 6 — Blood Donation  (signature accent: red)
// Requests + Donors tabs, "I can donate" pledge w/ contact reveal,
// register-as-donor + request-blood forms, donors-by-group summary.
// ============================================================================

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const URGENCY_TONE = { Urgent: "red", Today: "amber", "This week": "slate" };
export const URGENCY_RANK = { Urgent: 0, Today: 1, "This week": 2 };

export function daysSince(iso) {
  return Math.floor((Date.now() - new Date(iso + "T00:00:00").getTime()) / 86400000);
}
export function isEligible(donor) {
  return !donor.lastDonated || daysSince(donor.lastDonated) > 90;
}
export function eligibleDate(iso) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + 91);
  return d.toISOString().slice(0, 10);
}

// Big blood-group badge
export function GroupBadge({ group, size = "md" }) {
  const dims = size === "lg" ? "h-14 w-14 text-xl" : "h-11 w-11 text-base";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg bg-red-100 font-bold text-red-700 ${dims}`}>
      {group}
    </span>
  );
}

// --- Request card -----------------------------------------------------------
export function RequestCard({ req, requester, mine, pledged, onDonate }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <GroupBadge group={req.group} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={URGENCY_TONE[req.urgency]}>{req.urgency === "Urgent" && <Icon name="TriangleAlert" size={12} />}{req.urgency}</Badge>
            <span className="text-xs text-slate-400">{relativeDate(req.createdAt)}</span>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-slate-900">{req.units} unit{req.units > 1 ? "s" : ""} · {req.patient}</p>
          <div className="mt-1.5 space-y-1 text-xs text-slate-500">
            <p className="flex items-center gap-1.5"><Icon name="Building2" size={13} className="text-slate-400" />{req.hospital}</p>
            <p className="flex items-center gap-1.5"><Icon name="MapPin" size={13} className="text-slate-400" />{req.area}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-400">{req.pledges.length} donor{req.pledges.length === 1 ? "" : "s"} responded</span>
        {mine ? (
          <Badge tone="slate">Your request</Badge>
        ) : (
          <Button size="sm" variant={pledged ? "secondary" : "destructive"} icon={pledged ? "MessageCircle" : "HeartPulse"} onClick={onDonate}>
            {pledged ? "Contact" : "I can donate"}
          </Button>
        )}
      </div>
    </Card>
  );
}

// A registered donor's WhatsApp, revealed on click (registering is consent, so
// the donor_contact RPC always returns it — unless they never saved a number).
function DonorContact({ userId }) {
  const { getDonorContact } = useApp();
  const [phase, setPhase] = React.useState("idle"); // idle | loading | done
  const [contact, setContact] = React.useState(null);

  async function reveal() {
    setPhase("loading");
    setContact(await getDonorContact(userId));
    setPhase("done");
  }

  if (phase === "done") {
    const wa = contact?.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, "")}` : null;
    return wa ? (
      <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700"><Icon name="MessageCircle" size={14} /> Chat</a>
    ) : (
      <span className="shrink-0 text-xs text-slate-400">No number shared</span>
    );
  }
  return (
    <button onClick={reveal} disabled={phase === "loading"}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
      <Icon name="MessageCircle" size={14} /> {phase === "loading" ? "…" : "Contact"}
    </button>
  );
}

// --- Donor card -------------------------------------------------------------
export function DonorCard({ donor, isAdmin }) {
  const eligible = isEligible(donor);
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <GroupBadge group={donor.group} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{donor.name}</p>
          <div className="mt-1.5 space-y-1 text-xs text-slate-500">
            <p className="flex items-center gap-1.5"><Icon name="MapPin" size={13} className="text-slate-400" />{donor.area}</p>
            <p className="flex items-center gap-1.5"><Icon name="Clock" size={13} className="text-slate-400" />{donor.lastDonated ? `Last donated ${fmtDate(donor.lastDonated)}` : "No donation on record"}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        {eligible ? <Badge tone="emerald"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>Available to donate</Badge>
          : <Badge tone="amber">Eligible {fmtDate(eligibleDate(donor.lastDonated))}</Badge>}
        {(eligible || isAdmin) && <DonorContact userId={donor.userId} />}
      </div>
    </Card>
  );
}

// The requester's contact, shown in the pledge modal. The donor has just
// pledged, so the blood_requester_contact RPC will return it — fetched on open.
function BloodRequesterContact({ code, fallbackName }) {
  const { getBloodRequesterContact } = useApp();
  const [phase, setPhase] = React.useState("loading"); // loading | done
  const [contact, setContact] = React.useState(null);

  React.useEffect(() => {
    let active = true;
    getBloodRequesterContact(code).then((c) => { if (active) { setContact(c); setPhase("done"); } });
    return () => { active = false; };
  }, [code]);

  const wa = contact?.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, "")}` : null;
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><Icon name="CircleCheck" size={16} /> Requester contact</div>
      {phase === "loading" ? (
        <p className="mt-2 text-xs text-slate-500">Getting contact…</p>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{contact?.name || fallbackName || "Requester"}</p><p className="truncate text-xs text-slate-500">{contact?.whatsapp || "No number shared"}</p></div>
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"><Icon name="MessageCircle" size={16} /> WhatsApp</a>}
        </div>
      )}
    </div>
  );
}

// --- Main (tabs) ------------------------------------------------------------
export function BloodDonation() {
  const { currentUser, bloodRequests, donors, userById, pledgeBlood, dataLoading } = useApp();
  const isAdmin = currentUser?.role === "Admin";
  const toast = useToast();
  const [tab, setTab] = React.useState("Requests");
  const [groupFilter, setGroupFilter] = React.useState("All");
  const [active, setActive] = React.useState(null); // request being donated to
  const myDonor = donors.find((d) => d.userId === currentUser.id);

  const requests = [...bloodRequests]
    .filter((r) => groupFilter === "All" || r.group === groupFilter)
    .sort((a, b) => (URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]) || b.createdAt.localeCompare(a.createdAt));

  const donorList = donors
    .filter((d) => groupFilter === "All" || d.group === groupFilter)
    .sort((a, b) => Number(isEligible(b)) - Number(isEligible(a)));

  // donors-by-group summary
  const byGroup = BLOOD_GROUPS.map((g) => ({ g, n: donors.filter((d) => d.group === g).length }));

  async function donate(req) {
    const r = await pledgeBlood(req.id);
    if (!r.ok) { toast({ type: "error", title: "Couldn't pledge", message: r.error }); return; }
    setActive(req);
  }

  return (
    <AppShell activeKey="blood" title="Blood Donation">
      <PageHeader title="Blood Donation"
        subtitle={isAdmin ? "View all donors and active blood requests on campus." : "Find donors and respond to urgent blood requests on campus."}
        action={isAdmin ? null : (
          <div className="flex gap-2">
            <Button variant="secondary" icon="UserPlus" onClick={() => navigate("/blood/register")}>{myDonor ? "Update donor info" : "Register as donor"}</Button>
            <Button icon="Plus" onClick={() => navigate("/blood/request")}>Request blood</Button>
          </div>
        )} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs options={["Requests", "Donors"]} value={tab} onChange={setTab} counts={{ Requests: bloodRequests.length, Donors: donors.length }} />
        <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="sm:w-44">
          <option value="All">All blood groups</option>
          {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
        </Select>
      </div>

      {dataLoading ? (
        <Loading />
      ) : tab === "Requests" ? (
        requests.length === 0 ? (
          <EmptyState icon="Droplet" title="No requests right now" message="Urgent blood requests will appear here, most urgent first." action={<Button icon="Plus" onClick={() => navigate("/blood/request")}>Request blood</Button>} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {requests.map((r) => (
              <RequestCard key={r.id} req={r} requester={userById(r.requesterId)} mine={r.requesterId === currentUser.id} pledged={r.pledges.includes(currentUser.id)} onDonate={() => donate(r)} />
            ))}
          </div>
        )
      ) : (
        <>
          <Card className="mb-4 p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Donors by group</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {byGroup.map(({ g, n }) => (
                <div key={g} className="rounded-lg border border-slate-100 bg-slate-50 py-2 text-center">
                  <p className="text-sm font-bold text-red-700">{g}</p>
                  <p className="text-xs text-slate-500">{n}</p>
                </div>
              ))}
            </div>
          </Card>
          {donorList.length === 0 ? (
            <EmptyState icon="Users" title="No donors yet" message="Be the first to join the donor registry." action={<Button icon="UserPlus" onClick={() => navigate("/blood/register")}>Register as donor</Button>} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {donorList.map((d) => <DonorCard key={d.id} donor={{ ...d, name: userById(d.userId)?.name || "Student" }} isAdmin={isAdmin} />)}
            </div>
          )}
        </>
      )}

      {/* pledge → reveal requester contact */}
      <Modal open={!!active} onClose={() => setActive(null)} icon="HeartPulse" tone="red"
        title="Thank you for donating" description={active ? `You've responded to the ${active.group} request. Contact the requester to coordinate.` : ""}
        footer={<Button onClick={() => setActive(null)}>Done</Button>}>
        {active && <BloodRequesterContact code={active.id} fallbackName={userById(active.requesterId)?.name} />}
      </Modal>
    </AppShell>
  );
}

// --- Register as donor ------------------------------------------------------
export function RegisterDonor() {
  const { currentUser, donors, registerDonor } = useApp();
  const toast = useToast();
  const existing = donors.find((d) => d.userId === currentUser.id);
  const [form, setForm] = React.useState(existing
    ? { group: existing.group, area: existing.area, lastDonated: existing.lastDonated || "", phone: currentUser.whatsapp || "" }
    : { group: "", area: "", lastDonated: "", phone: currentUser.whatsapp || "" });
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!form.group) er.group = "Select your blood group.";
    if (!form.area.trim()) er.area = "Enter your area.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    const r = await registerDonor({ group: form.group, area: form.area.trim(), lastDonated: form.lastDonated || null, phone: form.phone.trim() });
    if (!r.ok) { setSaving(false); toast({ type: "error", title: "Couldn't save", message: r.error }); return; }
    toast({ type: "success", title: existing ? "Donor info updated" : "Registered as donor", message: "Thank you for joining the registry." });
    navigate("/blood");
  }

  return (
    <AppShell activeKey="blood" title="Register as Donor">
      <div className="mx-auto max-w-xl">
        <button onClick={() => navigate("/blood")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <Icon name="ArrowLeft" size={16} /> Back
        </button>
        <PageHeader title={existing ? "Update donor info" : "Register as donor"} subtitle="Join the campus donor registry so others can reach you." />
        <form onSubmit={submit} className="space-y-6">
          <Card className="space-y-5 p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Blood group" htmlFor="dg" required error={errors.group}>
                <Select id="dg" value={form.group} error={!!errors.group} onChange={(e) => set("group", e.target.value)}>
                  <option value="">Select group</option>
                  {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
                </Select>
              </Field>
              <Field label="Area" htmlFor="da" required error={errors.area}><Input id="da" placeholder="e.g. Mirpur-2" value={form.area} error={!!errors.area} onChange={(e) => set("area", e.target.value)} /></Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Last donated" htmlFor="dl" hint="Leave blank if never."><Input id="dl" type="date" max={todayISO()} value={form.lastDonated} onChange={(e) => set("lastDonated", e.target.value)} /></Field>
              <Field label="WhatsApp number" htmlFor="dp" hint="Shown to those who need your group."><Input id="dp" placeholder="+8801XXXXXXXXX" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
              <Icon name="Info" size={14} className="mt-0.5 shrink-0" /> Donors are eligible again 3 months after their last donation — we'll compute your availability automatically.
            </div>
          </Card>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate("/blood")}>Cancel</Button>
            <Button type="submit" icon="Check" disabled={saving}>{saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : (existing ? "Save changes" : "Register")}</Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

// --- Request blood ----------------------------------------------------------
export function RequestBlood() {
  const { addBloodRequest } = useApp();
  const toast = useToast();
  const [form, setForm] = React.useState({ group: "", units: "1", patient: "", hospital: "", area: "", urgency: "Urgent" });
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!form.group) er.group = "Select the blood group needed.";
    if (!form.patient.trim()) er.patient = "Who is it for?";
    if (!form.hospital.trim()) er.hospital = "Enter the hospital.";
    if (!form.area.trim()) er.area = "Enter the area.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    const r = await addBloodRequest({ group: form.group, units: Number(form.units), patient: form.patient.trim(), hospital: form.hospital.trim(), area: form.area.trim(), urgency: form.urgency });
    if (!r.ok) { setSaving(false); toast({ type: "error", title: "Couldn't post request", message: r.error }); return; }
    toast({ type: "success", title: "Request posted", message: `${form.group} request is now visible to donors.` });
    navigate("/blood");
  }

  return (
    <AppShell activeKey="blood" title="Request Blood">
      <div className="mx-auto max-w-xl">
        <button onClick={() => navigate("/blood")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <Icon name="ArrowLeft" size={16} /> Back
        </button>
        <PageHeader title="Request blood" subtitle="Post a request so eligible donors can respond quickly." />
        <form onSubmit={submit} className="space-y-6">
          <Card className="space-y-5 p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Blood group needed" htmlFor="bg" required error={errors.group}>
                <Select id="bg" value={form.group} error={!!errors.group} onChange={(e) => set("group", e.target.value)}>
                  <option value="">Select group</option>
                  {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
                </Select>
              </Field>
              <Field label="Units needed" htmlFor="bu"><Select id="bu" value={form.units} onChange={(e) => set("units", e.target.value)}>{[1,2,3,4].map((n) => <option key={n} value={n}>{n} unit{n>1?"s":""}</option>)}</Select></Field>
            </div>
            <Field label="Patient / for whom" htmlFor="bp" required error={errors.patient}><Input id="bp" placeholder="e.g. Father of Tanvir (BBA)" value={form.patient} error={!!errors.patient} onChange={(e) => set("patient", e.target.value)} /></Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Hospital" htmlFor="bh" required error={errors.hospital}><Input id="bh" placeholder="e.g. Dhaka Medical College" value={form.hospital} error={!!errors.hospital} onChange={(e) => set("hospital", e.target.value)} /></Field>
              <Field label="Area" htmlFor="bar" required error={errors.area}><Input id="bar" placeholder="e.g. Shahbagh" value={form.area} error={!!errors.area} onChange={(e) => set("area", e.target.value)} /></Field>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Urgency</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {["Urgent", "Today", "This week"].map((u) => {
                  const active = form.urgency === u;
                  return <button type="button" key={u} onClick={() => set("urgency", u)} className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${active ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{u}</button>;
                })}
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
              <Icon name="Lock" size={14} className="mt-0.5 shrink-0 text-slate-400" /> Donors who respond get your WhatsApp to coordinate — your contact stays private until then.
            </div>
          </Card>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate("/blood")}>Cancel</Button>
            <Button type="submit" variant="destructive" icon="Droplet" disabled={saving}>{saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Post request"}</Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

// --- Dashboard widget -------------------------------------------------------
export function BloodWidget() {
  const { bloodRequests } = useApp();
  const urgent = bloodRequests.filter((r) => r.urgency === "Urgent").length;
  return (
    <button onClick={() => navigate("/blood")} className="group flex w-full items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-red-300 hover:bg-red-50/40">
      <AccentTile icon="Droplet" tone="red" size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">Blood Donation</p>
        <p className="truncate text-xs text-slate-500">{urgent > 0 ? `${urgent} urgent request${urgent === 1 ? "" : "s"} need donors` : "Browse requests and donors"}</p>
      </div>
      <Icon name="ArrowRight" size={18} className="text-slate-300 group-hover:text-red-500" />
    </button>
  );
}
