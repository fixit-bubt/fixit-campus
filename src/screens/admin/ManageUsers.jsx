import React, { useState } from "react";
import { Search, ShieldCheck, TriangleAlert, UserX } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { Card, Button, Select, Modal, Badge, Avatar, EmptyState, useToast } from "../../components/ui.jsx";
import { AppShell, PageHeader, ROLE_TONE } from "../../components/AppShell.jsx";
import { FilterTabs } from "../../components/FilterTabs.jsx";
import { fmtDate } from "../../lib/helpers.js";

export default function ManageUsers() {
  const { users, currentUser, setRole } = useApp();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [pending, setPending] = useState(null); // { user, newRole }

  const roles = ["All", "Student", "Staff", "Admin"];
  const filtered = users
    .filter((u) => roleFilter === "All" || u.role === roleFilter)
    .filter((u) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  function applyChange() {
    setRole(pending.user.id, pending.newRole);
    toast({ type: "success", title: "Role updated", message: `${pending.user.name} is now ${pending.newRole}.` });
    setPending(null);
  }

  return (
    <AppShell activeKey="users" title="Manage Users">
      <PageHeader title="Manage Users" subtitle={`${users.length} people in the FixIt directory.`} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
                const isSelf = u.id === currentUser.id;
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
                          <option value="Admin">Admin</option>
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

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        icon={ShieldCheck}
        tone="blue"
        title="Change this user's role?"
        description={pending ? `${pending.user.name} will change from ${pending.user.role} to ${pending.newRole}. This updates what they can see and do across FixIt.` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button>
            <Button onClick={applyChange}>Change to {pending?.newRole}</Button>
          </>
        }
      >
        {pending && pending.user.id === currentUser.id && pending.newRole !== "Admin" && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>You're changing your own role — you'll lose admin access immediately.</span>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
