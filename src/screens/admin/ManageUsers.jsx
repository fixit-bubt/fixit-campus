import React, { useState, useMemo } from "react";
import { Search, GraduationCap, Crown, UserX, UserPlus } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { Card, Button, Select, Modal, Badge, Avatar, Field, Input, EmptyState, Spinner, useToast } from "../../components/ui.jsx";
import { AppShell, PageHeader, ROLE_TONE } from "../../components/AppShell.jsx";
import { FilterTabs } from "../../components/FilterTabs.jsx";
import { fmtDate } from "../../lib/helpers.js";

const EMPTY_NEW = { name: "", email: "", password: "", role: "Staff", dept: "", expertise: "" };

export default function ManageUsers() {
  const {
    users, currentUser, createUser,
    studySections = [], studyIntakes = [], departments = [], clubs = [],
    assignSectionCR, assignClubPresident,
  } = useApp();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  // Assign-position modal state
  const [crFor, setCrFor] = useState(null);          // user getting a CR role
  const [crSection, setCrSection] = useState("");
  const [presFor, setPresFor] = useState(null);      // user becoming a club president
  const [presClub, setPresClub] = useState("");
  const [busy, setBusy] = useState(false);

  // Create-account modal state
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_NEW);
  const [formErr, setFormErr] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Section options labelled "Department · Intake N · Section M".
  const sectionOptions = useMemo(() => {
    const deptName = (id) => departments.find((d) => d.id === id)?.name || "Department";
    const intakeById = Object.fromEntries(studyIntakes.map((i) => [i.id, i]));
    return studySections
      .map((s) => {
        const intake = intakeById[s.intakeId];
        const dept = intake ? deptName(intake.deptId).replace(/^Department of\s*/i, "") : "—";
        return { id: s.id, label: `${dept} · Intake ${intake?.number ?? "?"} · Section ${s.number}` };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [studySections, studyIntakes, departments]);

  const clubOptions = useMemo(
    () => clubs.filter((c) => c.isActive !== false).map((c) => ({ id: c.id, label: c.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [clubs]
  );

  const roles = ["All", "Student", "Staff", "Admin"];
  const filtered = users
    .filter((u) => roleFilter === "All" || u.role === roleFilter)
    .filter((u) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (u.name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  function openCr(u) { setCrFor(u); setCrSection(""); }
  function openPres(u) { setPresFor(u); setPresClub(""); }

  async function assignCr() {
    if (busy || !crSection) return;
    setBusy(true);
    try {
      const res = await assignSectionCR(crSection, crFor.id);
      if (res && res.ok === false) toast({ type: "error", title: "Couldn't assign CR", message: res.error });
      else toast({ type: "success", title: "CR assigned", message: `${crFor.name} is now the CR of the selected section.` });
      if (!res || res.ok !== false) setCrFor(null);
    } finally { setBusy(false); }
  }

  async function assignPres() {
    if (busy || !presClub) return;
    setBusy(true);
    try {
      const res = await assignClubPresident(presClub, presFor.id);
      if (res && res.ok === false) toast({ type: "error", title: "Couldn't set president", message: res.error });
      else toast({ type: "success", title: "President assigned", message: `${presFor.name} is now the president of the selected club.` });
      if (!res || res.ok !== false) setPresFor(null);
    } finally { setBusy(false); }
  }

  function openAdd() {
    setForm(EMPTY_NEW);
    setFormErr({});
    setAddOpen(true);
  }

  async function submitAdd() {
    const er = {};
    if (!form.name.trim()) er.name = "Enter a full name.";
    if (!form.email.trim()) er.email = "Enter an email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) er.email = "Enter a valid email address.";
    if (!form.password || form.password.length < 8) er.password = "Password must be at least 8 characters.";
    setFormErr(er);
    if (Object.keys(er).length) return;

    setSaving(true);
    try {
      const res = await createUser({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        dept: form.role === "Staff" ? form.dept : "",
        expertise: form.role === "Staff" ? form.expertise : "",
      });
      if (!res.ok) {
        setFormErr({ email: res.error });
        return;
      }
      toast({ type: "success", title: `${form.role} account created`, message: `${form.name.trim()} can now log in with the password you set.` });
      setAddOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell activeKey="users" title="Manage Users">
      <PageHeader
        title="Manage Users"
        subtitle={`${users.length} people in the FixIt directory.`}
        action={<Button icon={UserPlus} onClick={openAdd}>Add account</Button>}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search users"
            placeholder="Search by name or email…"
            className="h-10 w-full rounded-md border border-brd bg-surface pl-9 pr-3 text-base placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <FilterTabs options={roles} value={roleFilter} onChange={setRoleFilter} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-base">
            <thead>
              <tr className="border-b border-brd bg-surface-2 text-xs uppercase tracking-wide text-ink-3">
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Account</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold text-right">Assign position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brd">
              {filtered.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-semibold text-ink">
                            {u.name}
                            {isSelf && <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold text-ink-3">You</span>}
                          </p>
                          <p className="truncate text-xs text-ink-3">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge></td>
                    <td className="px-4 py-3 text-ink-3 whitespace-nowrap">{fmtDate(u.joined)}</td>
                    <td className="px-4 py-3">
                      {u.role === "Student" ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="secondary" icon={GraduationCap} onClick={() => openCr(u)}>Make CR</Button>
                          <Button size="sm" variant="secondary" icon={Crown} onClick={() => openPres(u)}>Make President</Button>
                        </div>
                      ) : (
                        <p className="text-right text-xs text-ink-3">Positions apply to students</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-6">
            <EmptyState icon={UserX} title="No matching users" message="Try a different search or role filter." />
          </div>
        )}
      </Card>

      {/* Assign CR */}
      <Modal
        open={!!crFor}
        onClose={() => !busy && setCrFor(null)}
        icon={GraduationCap}
        tone="blue"
        title="Make Class Representative"
        description={crFor ? `Choose the section ${crFor.name} will be CR of. They keep their Student account — this adds the CR role for that section.` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCrFor(null)} disabled={busy}>Cancel</Button>
            <Button onClick={assignCr} disabled={busy || !crSection}>{busy ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Assign CR"}</Button>
          </>
        }
      >
        {sectionOptions.length === 0 ? (
          <p className="text-base text-ink-3">No sections exist yet. Create sections in Manage Study Hub first.</p>
        ) : (
          <Field label="Section" htmlFor="cr-sec">
            <Select id="cr-sec" value={crSection} onChange={(e) => setCrSection(e.target.value)}>
              <option value="">Select a section…</option>
              {sectionOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </Field>
        )}
      </Modal>

      {/* Assign Club President */}
      <Modal
        open={!!presFor}
        onClose={() => !busy && setPresFor(null)}
        icon={Crown}
        tone="amber"
        title="Make Club President"
        description={presFor ? `Choose the club ${presFor.name} will lead. The current president (if any) is stepped down automatically.` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPresFor(null)} disabled={busy}>Cancel</Button>
            <Button onClick={assignPres} disabled={busy || !presClub}>{busy ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Assign president"}</Button>
          </>
        }
      >
        {clubOptions.length === 0 ? (
          <p className="text-base text-ink-3">No active clubs exist yet. Create a club in Clubs first.</p>
        ) : (
          <Field label="Club" htmlFor="pres-club">
            <Select id="pres-club" value={presClub} onChange={(e) => setPresClub(e.target.value)}>
              <option value="">Select a club…</option>
              {clubOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
        )}
      </Modal>

      {/* Create Staff / Admin account */}
      <Modal
        open={addOpen}
        onClose={() => !saving && setAddOpen(false)}
        icon={UserPlus}
        tone="blue"
        title="Create an account"
        description="Add a Staff or Admin account. Share the password with them — they can change it after logging in."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={submitAdd} disabled={saving}>
              {saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Create account"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Full name" htmlFor="nu-name" required error={formErr.name}>
            <Input id="nu-name" placeholder="e.g. Rahim Uddin" value={form.name} error={!!formErr.name} onChange={set("name")} />
          </Field>
          <Field label="Email" htmlFor="nu-email" required error={formErr.email}>
            <Input id="nu-email" type="email" placeholder="name@bubt.edu.bd" value={form.email} error={!!formErr.email} onChange={set("email")} />
          </Field>
          <Field label="Temporary password" htmlFor="nu-pw" required error={formErr.password} hint="At least 8 characters.">
            <Input id="nu-pw" type="text" placeholder="Set an initial password" value={form.password} error={!!formErr.password} onChange={set("password")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role" htmlFor="nu-role">
              <Select id="nu-role" value={form.role} onChange={set("role")}>
                <option value="Staff">Staff</option>
                <option value="Admin">Admin</option>
              </Select>
            </Field>
            {form.role === "Staff" && (
              <Field label="Department" htmlFor="nu-dept" hint="Optional">
                <Input id="nu-dept" placeholder="e.g. Electrical & IT" value={form.dept} onChange={set("dept")} />
              </Field>
            )}
          </div>
          {form.role === "Staff" && (
            <Field label="Expertise" htmlFor="nu-expertise" hint="Optional — area of specialisation.">
              <Input id="nu-expertise" placeholder="e.g. Network Administration, Lab Support" value={form.expertise} onChange={set("expertise")} />
            </Field>
          )}
        </div>
      </Modal>
    </AppShell>
  );
}
