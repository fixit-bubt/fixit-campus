import React, { useState, useEffect } from "react";
import { Search, SearchX, Mail, MessageCircle, EyeOff, UserPlus, Check, X, Clock, Users } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { Avatar, Badge, EmptyState, Loading, Modal, Button, useToast } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";

// Read-only label like "Intake 49 · Section 5"
function metaLine(s, full = false) {
  return (
    [
      s.intake && `Intake ${s.intake}`,
      s.section && `${full ? "Section" : "Sec"} ${s.section}`,
      full ? s.department : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Student"
  );
}

function StatusBadge({ status }) {
  if (status === "accepted") return <Badge tone="emerald" icon={Check}>Connected</Badge>;
  if (status === "pending_outgoing") return <Badge tone="amber" icon={Clock}>Requested</Badge>;
  if (status === "pending_incoming") return <Badge tone="blue" icon={UserPlus}>Wants to connect</Badge>;
  return null;
}

export default function StudentDirectory() {
  const { currentUser, getStudentDirectory, sendConnectionRequest, respondConnection, cancelConnectionRequest } = useApp();
  const toast = useToast();
  const hidden = currentUser.directoryVisible === false;
  const [list, setList] = useState(null); // null = still loading
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (hidden) { setList([]); return; }
    getStudentDirectory().then((rows) => { if (active) setList(rows); });
    return () => { active = false; };
  }, [hidden]);

  async function refresh() {
    const rows = await getStudentDirectory();
    setList(rows);
    setSelected((sel) => (sel ? rows.find((r) => r.id === sel.id) || null : null));
  }

  async function connect(s) {
    if (busy) return;
    setBusy(true);
    const res = await sendConnectionRequest(s.id);
    if (res.ok) toast({ type: "success", title: "Request sent", message: `${s.name} will see your connection request.` });
    else toast({ type: "error", title: "Couldn't send request", message: res.error });
    await refresh();
    setBusy(false);
  }

  async function respond(s, accept) {
    if (busy) return;
    setBusy(true);
    const res = await respondConnection(s.id, accept);
    if (res.ok) {
      toast({
        type: "success",
        title: accept ? "Connected" : "Request declined",
        message: accept ? `You and ${s.name} can now see each other's contact.` : "",
      });
    } else {
      toast({ type: "error", title: "Couldn't update", message: res.error });
    }
    await refresh();
    setBusy(false);
  }

  async function cancel(s) {
    if (busy) return;
    setBusy(true);
    const res = await cancelConnectionRequest(s.id);
    if (!res.ok) toast({ type: "error", title: "Couldn't cancel", message: res.error });
    await refresh();
    setBusy(false);
  }

  const all = list || [];
  const incoming = all.filter((s) => s.status === "pending_incoming");
  const filtered = all.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [s.name, s.intake, s.section, s.department].filter(Boolean).some((v) => v.toLowerCase().includes(q));
  });

  return (
    <AppShell activeKey="directory" title="Students">
      <PageHeader title="Student Directory" subtitle="Find classmates, seniors and juniors — connect to share contact details." />

      {hidden ? (
        <EmptyState
          icon={EyeOff}
          title="Your profile is hidden"
          message="You've turned off 'Show me in the Student Directory', so you can't browse other students. Turn it back on in your profile to use the directory."
          action={<Button onClick={() => navigate("/profile")}>Go to My Profile</Button>}
        />
      ) : list === null ? (
        <Loading />
      ) : (
        <>
          {/* Incoming connection requests */}
          {incoming.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Connection requests</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {incoming.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
                    <button onClick={() => setSelected(s)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <Avatar name={s.name} src={s.avatar} size={40} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{s.name}</p>
                        <p className="truncate text-xs text-slate-500">{metaLine(s)}</p>
                      </div>
                    </button>
                    <div className="flex shrink-0 gap-1.5">
                      <Button size="sm" variant="secondary" icon={X} className="text-red-600" disabled={busy} onClick={() => respond(s, false)}>Decline</Button>
                      <Button size="sm" icon={Check} disabled={busy} onClick={() => respond(s, true)}>Accept</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="relative mb-5 w-full sm:max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, intake, section…"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={query ? SearchX : Users}
              title={query ? "No students found" : "No students yet"}
              message={query ? "Try a different search." : "No other students are visible in the directory yet."}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <Avatar name={s.name} src={s.avatar} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{s.name}</p>
                    <p className="truncate text-xs text-slate-500">{metaLine(s)}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Student detail + connection actions */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name || "Student"} size="sm">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={selected.name} src={selected.avatar} size={56} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{selected.name}</p>
                <p className="truncate text-xs text-slate-500">{metaLine(selected, true)}</p>
              </div>
            </div>

            {selected.status === "accepted" ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <Check size={14} /> You're connected — contact unlocked
                </p>
                {selected.email && (
                  <a href={`mailto:${selected.email}`} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-blue-600 hover:bg-slate-100">
                    <Mail size={15} className="shrink-0" /> <span className="truncate">{selected.email}</span>
                  </a>
                )}
                {selected.whatsapp ? (
                  <a href={`https://wa.me/${selected.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-emerald-600 hover:bg-slate-100">
                    <MessageCircle size={15} className="shrink-0" /> <span className="truncate">{selected.whatsapp}</span>
                  </a>
                ) : (
                  <p className="text-xs text-slate-400">This student hasn't shared a WhatsApp number.</p>
                )}
              </div>
            ) : selected.status === "pending_incoming" ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">{selected.name} wants to connect with you. Accept to share contact details with each other.</p>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" icon={X} className="text-red-600" disabled={busy} onClick={() => respond(selected, false)}>Decline</Button>
                  <Button icon={Check} disabled={busy} onClick={() => respond(selected, true)}>Accept</Button>
                </div>
              </div>
            ) : selected.status === "pending_outgoing" ? (
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-sm text-amber-700"><Clock size={15} /> Request sent — waiting for {selected.name} to accept.</p>
                <div className="flex justify-end">
                  <Button variant="secondary" disabled={busy} onClick={() => cancel(selected)}>Cancel request</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">Send a connection request to share contact details. {selected.name} will need to accept first.</p>
                <div className="flex justify-end">
                  <Button icon={UserPlus} disabled={busy} onClick={() => connect(selected)}>Connect</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
