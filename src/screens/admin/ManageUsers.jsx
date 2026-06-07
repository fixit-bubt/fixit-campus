import React, { useState } from "react";
import { Search, ShieldCheck, TriangleAlert, UserX, UserPlus } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { Card, Button, Select, Modal, Badge, Avatar, Field, Input, EmptyState, Spinner, useToast } from "../../components/ui.jsx";
import { AppShell, PageHeader, ROLE_TONE } from "../../components/AppShell.jsx";
import { FilterTabs } from "../../components/FilterTabs.jsx";
import { fmtDate } from "../../lib/helpers.js";

const EMPTY_NEW = { name: "", email: "", password: "", role: "Staff", dept: "", expertise: "" };

export default function ManageUsers() {
  const { users, currentUser, setRole, createUser } = useApp();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [pending, setPending] = useState(null); // { user, newRole }
  const [changing, setChanging] = useState(false);

  const adminCount = users.filter((u) => u.role === "Admin").length;
  const blockedLastAdmin =
    pending && pending.user.role === "Admin" && pending.newRole !== "Admin" && adminCount <= 1;

  // Create-account modal state
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_NEW);
  const [formErr, setFormErr] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const roles = ["All", "Student", "Staff", "Admin"];
  const filtered = users
    .filter((u) => roleFilter === "All" || u.role === roleFilter)
    .filter((u) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (u.name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  async function applyChange() {
    if (changing) return;
    setChanging(true);
    try {
      const res = await setRole(pending.user.id, pending.newRole);
      if (res && res.ok === false) {
        toast({ type: "error", title: "Couldn't update role", message: res.error });
      } else {
        toast({ type: "success", title: "Role updated", message: `${pending.user.name} is now ${pending.newRole}.` });
      }
    } finally {
      setChanging(false);
      setPending(null);
    }
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
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search users"
            placeholder="Search by name or email…"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          />
        </div>
        <FilterTabs options={roles} value={roleFilter} onChange={setRoleFilter} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium text-right">Change role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-medium text-slate-900">
                            {u.name}
                            {isSelf && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">You</span>}
                          </p>
                          <p className="truncate text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge></td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(u.joined)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex w-40">
                        <Select value={u.role} onChange={(e) => setPending({ user: u, newRole: e.target.value })}>
                          <option value="Student">Student</option>
                          <option value="Staff">Staff</option>
                          {u.role !== "Student" && <option value="Admin">Admin</option>}
                        </Select>
                      </div>
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

      {/* Change role confirmation */}
      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        icon={pending && pending.user.role === "Admin" && pending.newRole !== "Admin" ? TriangleAlert : ShieldCheck}
        tone={pending && pending.user.role === "Admin" && pending.newRole !== "Admin" ? "amber" : "blue"}
        title="Change this user's role?"
        description={pending ? `${pending.user.name} will change from ${pending.user.role} to ${pending.newRole}. This updates what they can see and do across FixIt.` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)} disabled={changing}>Cancel</Button>
            <Button onClick={applyChange} disabled={changing || blockedLastAdmin}>Change to {pending?.newRole}</Button>
          </>
        }
      >
        {blockedLastAdmin ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>This is the last admin — promote another admin first, or you'll lock everyone out of admin tools.</span>
          </div>
        ) : pending && pending.user.id === currentUser.id && pending.newRole !== "Admin" ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>You're changing your own role — you'll lose admin access immediately.</span>
          </div>
        ) : null}
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
