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

// Eligibility — the 90-day wait between donations (mirrors the mobile app).
export const DONATION_WAIT_DAYS = 90;
export function donorEligibility(lastDonated) {
  if (!lastDonated) return { eligible: true, daysLeft: 0 };
  const then = new Date(lastDonated).getTime();
  if (isNaN(then)) return { eligible: true, daysLeft: 0 };
  const days = Math.floor((Date.now() - then) / 86400000);
  const daysLeft = Math.max(0, DONATION_WAIT_DAYS - days);
  return { eligible: daysLeft === 0, daysLeft };
}
export function isEligible(donor) {
  return donorEligibility(donor.lastDonated).eligible;
}

// Big blood-group badge
export function GroupBadge({ group, size = "md" }) {
  const dims = size === "lg" ? "h-14 w-14 text-3xl" : "h-11 w-11 text-xl";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-md bg-danger-bg font-bold text-danger ${dims}`}>
      {group}
    </span>
  );
}

// --- Request card -----------------------------------------------------------
export function RequestCard({ req, requester, mine, pledged, onDonate, onManage }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <GroupBadge group={req.group} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={URGENCY_TONE[req.urgency]}>{req.urgency === "Urgent" && <Icon name="TriangleAlert" size={12} />}{req.urgency}</Badge>
            <span className="text-xs text-ink-3">{relativeDate(req.createdAt)}</span>
          </div>
          <p className="mt-1.5 text-base font-semibold text-ink">{req.units} unit{req.units > 1 ? "s" : ""} · {req.patient}</p>
          <div className="mt-1.5 space-y-1 text-xs text-ink-3">
            <p className="flex items-center gap-1.5"><Icon name="Building2" size={13} className="text-ink-3" />{req.hospital}</p>
            <p className="flex items-center gap-1.5"><Icon name="MapPin" size={13} className="text-ink-3" />{req.area}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-brd pt-3">
        <span className="text-xs text-ink-3">{req.pledges.length} donor{req.pledges.length === 1 ? "" : "s"} responded</span>
        {mine ? (
          <span className="flex items-center gap-2">
            <Badge tone="slate">Your request</Badge>
            <Button size="sm" variant="secondary" icon="Users" onClick={onManage}>Manage</Button>
          </span>
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
// `disabled` = donor is inside the 90-day wait; contact stays hidden.
function DonorContact({ userId, disabled = false }) {
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
      <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-success px-2.5 text-xs font-semibold text-white hover:brightness-95"><Icon name="MessageCircle" size={14} /> Chat</a>
    ) : (
      <span className="shrink-0 text-xs text-ink-3">No number shared</span>
    );
  }
  return (
    <button onClick={reveal} disabled={disabled || phase === "loading"}
      title={disabled ? "This donor is within the 90-day wait between donations" : undefined}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-success px-2.5 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-50 disabled:pointer-events-none">
      <Icon name="MessageCircle" size={14} /> {phase === "loading" ? "…" : "Contact"}
    </button>
  );
}

// --- Donor card -------------------------------------------------------------
// Ineligible donors show a countdown pill and their Contact button is disabled.
// A donor viewing their own card gets an "I donated" action instead.
export function DonorCard({ donor, isSelf = false, onMarkDonated }) {
  const { eligible, daysLeft } = donorEligibility(donor.lastDonated);
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <GroupBadge group={donor.group} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">{donor.name}{isSelf && <span className="ml-1.5 text-xs font-semibold text-ink-3">(you)</span>}</p>
          <div className="mt-1.5 space-y-1 text-xs text-ink-3">
            <p className="flex items-center gap-1.5"><Icon name="MapPin" size={13} className="text-ink-3" />{donor.area}</p>
            <p className="flex items-center gap-1.5"><Icon name="Clock" size={13} className="text-ink-3" />{donor.lastDonated ? `Last donated ${fmtDate(donor.lastDonated)}` : "No donation on record"}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-brd pt-3">
        {eligible ? <Badge tone="emerald"><span className="h-1.5 w-1.5 rounded-full bg-success"></span>Available to donate</Badge>
          : <Badge tone="amber"><Icon name="Clock" size={12} />Eligible in {daysLeft} day{daysLeft === 1 ? "" : "s"}</Badge>}
        {isSelf ? (
          <Button size="sm" variant="secondary" icon="HeartHandshake" onClick={onMarkDonated}>I donated</Button>
        ) : (
          <DonorContact userId={donor.userId} disabled={!eligible} />
        )}
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
    <div className="rounded-md border border-success-bg bg-success-bg p-4">
      <div className="flex items-center gap-1.5 text-base font-semibold text-success"><Icon name="CircleCheck" size={16} /> Requester contact</div>
      {phase === "loading" ? (
        <p className="mt-2 text-xs text-ink-3">Getting contact…</p>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-brd bg-surface p-3">
          <div className="min-w-0"><p className="truncate text-base font-semibold text-ink">{contact?.name || fallbackName || "Requester"}</p><p className="truncate text-xs text-ink-3">{contact?.whatsapp || "No number shared"}</p></div>
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-success px-3 text-base font-semibold text-white hover:brightness-95"><Icon name="MessageCircle" size={16} /> WhatsApp</a>}
        </div>
      )}
    </div>
  );
}

// Requester-only manage panel: responder list (via the requester-gated RPC),
// per-responder "Confirm donated", and a two-step "Mark fulfilled".
function ManageRequestModal({ req, onClose }) {
  const { getBloodResponders, confirmBloodDonation, markBloodRequestFulfilled } = useApp();
  const toast = useToast();
  const [phase, setPhase] = React.useState("loading"); // loading | ready | error
  const [responders, setResponders] = React.useState([]);
  const [confirming, setConfirming] = React.useState(null); // donor_id in flight
  const [armFulfill, setArmFulfill] = React.useState(false);
  const [closing, setClosing] = React.useState(false);

  const load = React.useCallback(async () => {
    const r = await getBloodResponders(req.id);
    if (!r.ok) { setPhase("error"); return; }
    setResponders(r.responders);
    setPhase("ready");
  }, [req.id]);

  React.useEffect(() => { load(); }, [load]);

  async function confirmDonor(donorId, name) {
    if (confirming) return;
    setConfirming(donorId);
    try {
      const r = await confirmBloodDonation(req.id, donorId);
      if (!r.ok) { toast({ type: "error", title: "Couldn't confirm", message: r.error }); return; }
      toast({ type: "success", title: "Donation confirmed", message: `${name || "The donor"}'s eligibility clock was reset — they've been notified.` });
      await load(); // pledge now carries fulfilled_at
    } finally {
      setConfirming(null);
    }
  }

  async function fulfill() {
    if (closing) return;
    setClosing(true);
    try {
      const r = await markBloodRequestFulfilled(req.id);
      if (!r.ok) { toast({ type: "error", title: "Couldn't mark fulfilled", message: r.error }); return; }
      toast({ type: "success", title: "Request fulfilled", message: "It's no longer shown to donors. Thank you!" });
      onClose();
    } finally {
      setClosing(false);
    }
  }

  return (
    <Modal open onClose={onClose} icon="Users" tone="red" size="lg"
      title="Manage your request"
      description={`${req.group} · ${req.units} unit${req.units > 1 ? "s" : ""} for ${req.patient}. Confirm donors who donated, then mark the request fulfilled.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={closing}>Close</Button>
          {armFulfill ? (
            <Button variant="destructive" icon="CheckCheck" onClick={fulfill} loading={closing}>Yes, mark fulfilled</Button>
          ) : (
            <Button icon="CheckCheck" onClick={() => setArmFulfill(true)}>Mark fulfilled</Button>
          )}
        </>
      }>
      {armFulfill && (
        <p className="mb-3 rounded-md bg-warn-bg px-3 py-2 text-xs text-warn">
          Fulfilled requests disappear from the donor feed. This can't be undone from the web.
        </p>
      )}
      {phase === "loading" ? (
        <Loading className="py-8" />
      ) : phase === "error" ? (
        <p className="text-base text-ink-3">Couldn't load responders. Close and try again.</p>
      ) : responders.length === 0 ? (
        <p className="rounded-md bg-surface-2 px-3 py-4 text-center text-base text-ink-3">No donors have responded yet.</p>
      ) : (
        <ul className="divide-y divide-brd rounded-md border border-brd">
          {responders.map((p) => (
            <li key={p.donor_id} className="flex items-center gap-3 p-3">
              <Avatar name={p.full_name || "Donor"} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-ink">
                  {p.full_name || "Donor"}
                  {p.blood_group && <span className="ml-1.5 text-xs font-bold text-danger">{p.blood_group}</span>}
                </p>
                <p className="text-xs text-ink-3">
                  Responded {relativeDate(p.pledged_at)}
                  {p.last_donated ? ` · last donated ${fmtDate(p.last_donated)}` : ""}
                </p>
              </div>
              {p.fulfilled_at ? (
                <Badge tone="emerald"><Icon name="Check" size={12} />Donated</Badge>
              ) : (
                <Button size="sm" variant="secondary" icon="HeartHandshake"
                  loading={confirming === p.donor_id} disabled={!!confirming}
                  onClick={() => confirmDonor(p.donor_id, p.full_name)}>
                  Confirm donated
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

// --- Main (tabs) ------------------------------------------------------------
export function BloodDonation() {
  const { currentUser, bloodRequests, donors, userById, pledgeBlood, markDonatedToday, dataLoading } = useApp();
  const isAdmin = currentUser?.role === "Admin";
  const toast = useToast();
  const [tab, setTab] = React.useState("Requests");
  const [groupFilter, setGroupFilter] = React.useState("All");
  const [active, setActive] = React.useState(null); // request being donated to
  const [donating, setDonating] = React.useState(false);
  const [manage, setManage] = React.useState(null); // own request being managed
  const [askDonated, setAskDonated] = React.useState(false); // "I donated" confirm
  const [stamping, setStamping] = React.useState(false);
  const myDonor = donors.find((d) => d.userId === currentUser?.id);

  const requests = [...bloodRequests]
    .filter((r) => groupFilter === "All" || r.group === groupFilter)
    .sort((a, b) => (URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]) || b.createdAt.localeCompare(a.createdAt));

  const donorList = donors
    .filter((d) => groupFilter === "All" || d.group === groupFilter)
    .sort((a, b) => Number(isEligible(b)) - Number(isEligible(a)));

  // donors-by-group summary
  const byGroup = BLOOD_GROUPS.map((g) => ({ g, n: donors.filter((d) => d.group === g).length }));

  async function donate(req) {
    if (donating) return;
    setDonating(true);
    try {
      const r = await pledgeBlood(req.id);
      if (!r.ok) { toast({ type: "error", title: "Couldn't pledge", message: r.error }); return; }
      setActive(req);
    } finally {
      setDonating(false);
    }
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
              <RequestCard key={r.id} req={r} requester={userById(r.requesterId)} mine={r.requesterId === currentUser?.id} pledged={r.pledges.includes(currentUser?.id)} onDonate={() => donate(r)} onManage={() => setManage(r)} />
            ))}
          </div>
        )
      ) : (
        <>
          <Card className="mb-4 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-3">Donors by group</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {byGroup.map(({ g, n }) => (
                <div key={g} className="rounded-md border border-brd bg-surface-2 py-2 text-center">
                  <p className="text-base font-bold text-danger">{g}</p>
                  <p className="text-xs text-ink-3">{n}</p>
                </div>
              ))}
            </div>
          </Card>
          {donorList.length === 0 ? (
            <EmptyState icon="Users" title="No donors yet" message="Be the first to join the donor registry." action={<Button icon="UserPlus" onClick={() => navigate("/blood/register")}>Register as donor</Button>} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {donorList.map((d) => (
                <DonorCard key={d.id} donor={{ ...d, name: userById(d.userId)?.name || "Student" }}
                  isSelf={d.userId === currentUser?.id} onMarkDonated={() => setAskDonated(true)} />
              ))}
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

      {/* requester manages responders + closes the request */}
      {manage && <ManageRequestModal req={manage} onClose={() => setManage(null)} />}

      {/* donor stamps their own donation date */}
      <Modal open={askDonated} onClose={() => setAskDonated(false)} icon="HeartHandshake" tone="red"
        title="Record today's donation?"
        description="This sets your last-donated date to today and starts your 90-day wait. Only do this after you've actually donated."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAskDonated(false)} disabled={stamping}>Cancel</Button>
            <Button icon="Check" loading={stamping} onClick={async () => {
              if (stamping) return;
              setStamping(true);
              try {
                const r = await markDonatedToday();
                if (!r.ok) { toast({ type: "error", title: "Couldn't save", message: r.error }); return; }
                toast({ type: "success", title: "Thank you for donating!", message: `You'll be eligible again in ${DONATION_WAIT_DAYS} days.` });
                setAskDonated(false);
              } finally {
                setStamping(false);
              }
            }}>Yes, I donated today</Button>
          </>
        } />
    </AppShell>
  );
}

// --- Register as donor ------------------------------------------------------
export function RegisterDonor() {
  const { currentUser, donors, registerDonor } = useApp();
  const toast = useToast();
  const existing = donors.find((d) => d.userId === currentUser?.id);
  const [form, setForm] = React.useState(existing
    ? { group: existing.group, area: existing.area, lastDonated: existing.lastDonated || "", phone: currentUser?.whatsapp || "" }
    : { group: "", area: "", lastDonated: "", phone: currentUser?.whatsapp || "" });
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    const er = {};
    if (!form.group) er.group = "Select your blood group.";
    if (!form.area.trim()) er.area = "Enter your area.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const r = await registerDonor({ group: form.group, area: form.area.trim(), lastDonated: form.lastDonated || null, phone: form.phone.trim() });
      if (!r.ok) { toast({ type: "error", title: "Couldn't save", message: r.error }); return; }
      toast({ type: "success", title: existing ? "Donor info updated" : "Registered as donor", message: "Thank you for joining the registry." });
      navigate("/blood");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell activeKey="blood" title="Register as Donor">
      <div className="mx-auto max-w-xl">
        <button onClick={() => navigate("/blood")} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
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
            <div className="flex items-start gap-2 rounded-md bg-danger-bg px-3 py-2.5 text-xs text-danger">
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
    if (saving) return;
    const er = {};
    if (!form.group) er.group = "Select the blood group needed.";
    if (!form.patient.trim()) er.patient = "Who is it for?";
    if (!form.hospital.trim()) er.hospital = "Enter the hospital.";
    if (!form.area.trim()) er.area = "Enter the area.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const r = await addBloodRequest({ group: form.group, units: Number(form.units), patient: form.patient.trim(), hospital: form.hospital.trim(), area: form.area.trim(), urgency: form.urgency });
      if (!r.ok) { toast({ type: "error", title: "Couldn't post request", message: r.error }); return; }
      toast({ type: "success", title: "Request posted", message: `${form.group} request is now visible to donors.` });
      navigate("/blood");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell activeKey="blood" title="Request Blood">
      <div className="mx-auto max-w-xl">
        <button onClick={() => navigate("/blood")} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
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
              <label className="text-base font-semibold text-ink-2">Urgency</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {["Urgent", "Today", "This week"].map((u) => {
                  const active = form.urgency === u;
                  return <button type="button" key={u} onClick={() => set("urgency", u)} className={`rounded-md border px-3 py-2 text-base font-semibold transition-colors ${active ? "border-danger bg-danger-bg text-danger" : "border-brd bg-surface text-ink-2 hover:bg-surface-2"}`}>{u}</button>;
                })}
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md bg-surface-2 px-3 py-2.5 text-xs text-ink-3">
              <Icon name="Lock" size={14} className="mt-0.5 shrink-0 text-ink-3" /> Donors who respond get your WhatsApp to coordinate — your contact stays private until then.
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
    <button onClick={() => navigate("/blood")} className="group flex w-full items-center gap-4 rounded-md border border-brd bg-surface p-5 text-left shadow-sm transition-colors hover:border-danger hover:bg-danger-bg">
      <AccentTile icon="Droplet" tone="red" size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-ink">Blood Donation</p>
        <p className="truncate text-xs text-ink-3">{urgent > 0 ? `${urgent} urgent request${urgent === 1 ? "" : "s"} need donors` : "Browse requests and donors"}</p>
      </div>
      <Icon name="ArrowRight" size={18} className="text-ink-3 group-hover:text-danger" />
    </button>
  );
}
