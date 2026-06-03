import React, { useState, useEffect } from "react";
import { Search, SearchX, Mail, MessageCircle, EyeOff } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { Avatar, EmptyState, Loading, Modal, Button } from "../../components/ui.jsx";
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

export default function StudentDirectory() {
  const { currentUser, getStudentDirectory } = useApp();
  const hidden = currentUser.directoryVisible === false;
  const [list, setList] = useState(null); // null = still loading
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    if (hidden) { setList([]); return; }
    getStudentDirectory().then((rows) => { if (active) setList(rows); });
    return () => { active = false; };
  }, [hidden]);

  const filtered = (list || []).filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [s.name, s.intake, s.section, s.department]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(q));
  });

  return (
    <AppShell activeKey="directory" title="Students">
      <PageHeader title="Student Directory" subtitle="Find classmates, seniors and juniors to connect with." />

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
              icon={SearchX}
              title="No students found"
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
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{s.name}</p>
                    <p className="truncate text-xs text-slate-500">{metaLine(s)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Student detail */}
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
            <div className="space-y-2">
              {selected.email && (
                <a
                  href={`mailto:${selected.email}`}
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-blue-600 hover:bg-slate-100"
                >
                  <Mail size={15} className="shrink-0" /> <span className="truncate">{selected.email}</span>
                </a>
              )}
              {selected.whatsapp ? (
                <a
                  href={`https://wa.me/${selected.whatsapp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-emerald-600 hover:bg-slate-100"
                >
                  <MessageCircle size={15} className="shrink-0" /> <span className="truncate">{selected.whatsapp}</span>
                </a>
              ) : (
                <p className="text-xs text-slate-400">This student hasn't shared a WhatsApp number.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
