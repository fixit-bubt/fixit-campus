import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase.js";
import { Card, Button, Field, Input, Select, Modal, useToast } from "../components/ui.jsx";
import { Icon } from "../components/Icon.jsx";
import { ACCENT_TILE } from "../components/featureKit.jsx";
import { useT } from "../i18n/index.js";

// Mirrors CampusOne's ProfileScreen.tsx computedBadges: real activity counts,
// not a DB table — thresholds match mobile exactly (reporter@5, helper@3,
// active@5, studious@10) so a student's badge state is identical cross-app.
const BADGES = [
  { id: "reporter", icon: "ClipboardList", tone: "blue", threshold: 5, source: (c) => c.reports },
  { id: "helper", icon: "Search", tone: "emerald", threshold: 3, source: (c) => c.lostfound },
  { id: "active", icon: "Users", tone: "amber", threshold: 5, source: (c) => c.clubs + c.events },
  { id: "studious", icon: "BookMarked", tone: "purple", threshold: 10, source: (c) => c.study },
];

const CATS = [
  { id: "award", icon: "Award", tone: "amber" },
  { id: "cert", icon: "Layers", tone: "blue" },
  { id: "project", icon: "FolderKanban", tone: "purple" },
  { id: "volunteer", icon: "HeartHandshake", tone: "emerald" },
  { id: "leadership", icon: "Users", tone: "teal" },
  { id: "research", icon: "FlaskConical", tone: "fuchsia" },
];
const CAT_BY_ID = Object.fromEntries(CATS.map((c) => [c.id, c]));

function AddAccomplishmentModal({ open, onClose, onAdd }) {
  const t = useT();
  const [cat, setCat] = useState("award");
  const [title, setTitle] = useState("");
  const [org, setOrg] = useState("");
  const [year, setYear] = useState("");
  const [saving, setSaving] = useState(false);
  const ok = title.trim().length > 0;

  async function submit(e) {
    e.preventDefault();
    if (!ok || saving) return;
    setSaving(true);
    try {
      await onAdd({ category: cat, title: title.trim(), org: org.trim(), year: year.trim() });
      setCat("award"); setTitle(""); setOrg(""); setYear("");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t.profile.addAccomplishment} icon="Trophy" tone="amber">
      <form onSubmit={submit} className="space-y-4">
        <Field label={t.profile.fieldType} htmlFor="acc-cat">
          <Select id="acc-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
            {CATS.map((c) => (
              <option key={c.id} value={c.id}>{t.profile[`cat${c.id.charAt(0).toUpperCase()}${c.id.slice(1)}`]}</option>
            ))}
          </Select>
        </Field>
        <Field label={t.profile.fieldTitle} htmlFor="acc-title" required>
          <Input id="acc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dean's List — Spring 2026" />
        </Field>
        <Field label={t.profile.fieldOrgDetail} htmlFor="acc-org">
          <Input id="acc-org" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="e.g. Coursera" />
        </Field>
        <Field label={t.profile.fieldYear} htmlFor="acc-year">
          <Input id="acc-year" value={year} onChange={(e) => setYear(e.target.value)} placeholder={t.profile.yearPlaceholder} />
        </Field>
        <Button type="submit" full icon="Check" disabled={!ok || saving}>{t.profile.addToProfile}</Button>
      </form>
    </Modal>
  );
}

export function ProfileGamification({ userId }) {
  const t = useT();
  const toast = useToast();
  const [contrib, setContrib] = useState(null);
  const [accomplishments, setAccomplishments] = useState([]);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const head = { count: "exact", head: true };
    Promise.all([
      supabase.from("reports").select("*", head).eq("reporter_id", userId).is("deleted_at", null),
      supabase.from("club_members").select("*", head).eq("user_id", userId),
      supabase.from("event_rsvps").select("*", head).eq("user_id", userId),
      supabase.from("lost_found_items").select("*", head).eq("poster_id", userId).is("deleted_at", null),
      supabase.from("study_materials").select("*", head).eq("uploaded_by", userId),
      supabase.from("study_question_bank").select("*", head).eq("uploaded_by", userId),
      supabase.from("study_books").select("*", head).eq("added_by", userId),
    ]).then(([rep, clb, evt, lf, mat, qb, book]) => {
      if (!active) return;
      setContrib({
        reports: rep.count ?? 0,
        clubs: clb.count ?? 0,
        events: evt.count ?? 0,
        lostfound: lf.count ?? 0,
        study: (mat.count ?? 0) + (qb.count ?? 0) + (book.count ?? 0),
      });
    });
    supabase.from("accomplishments").select("*").eq("user_id", userId).order("created_at", { ascending: false })
      .then(({ data }) => { if (active && data) setAccomplishments(data); });
    return () => { active = false; };
  }, [userId]);

  const badges = useMemo(() => {
    if (!contrib) return [];
    return BADGES.map((b) => {
      const cur = b.source(contrib);
      return { ...b, cur, earned: cur >= b.threshold };
    });
  }, [contrib]);

  async function addAccomplishment({ category, title, org, year }) {
    const { data, error } = await supabase
      .from("accomplishments")
      .insert({ user_id: userId, category, title, org: org || null, year: year || null })
      .select().single();
    if (error || !data) {
      toast({ type: "error", title: "Couldn't add accomplishment", message: error?.message });
      return;
    }
    setAccomplishments((prev) => [data, ...prev]);
  }

  async function deleteAccomplishment(id) {
    const prev = accomplishments;
    setAccomplishments((list) => list.filter((a) => a.id !== id)); // optimistic
    const { error } = await supabase.from("accomplishments").delete().eq("id", id);
    if (error) {
      setAccomplishments(prev);
      toast({ type: "error", title: "Couldn't remove accomplishment", message: error.message });
    }
  }

  const contribRows = contrib
    ? [
        { key: "reports", label: t.profile.contribReports, value: contrib.reports },
        { key: "clubs", label: t.profile.contribClubs, value: contrib.clubs },
        { key: "events", label: t.profile.contribEvents, value: contrib.events },
        { key: "lostfound", label: t.profile.contribLostfound, value: contrib.lostfound },
        { key: "study", label: t.profile.contribStudy, value: contrib.study },
      ]
    : [];

  return (
    <>
      <Card className="space-y-5 p-6">
        <div>
          <p className="mb-3 text-base font-semibold text-ink">{t.profile.badges}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {badges.map((b) => (
              <div key={b.id} className={`flex flex-col items-center gap-2 rounded-lg border border-brd p-3 text-center ${b.earned ? "" : "opacity-50"}`}>
                <span className={`flex h-11 w-11 items-center justify-center rounded-full ${ACCENT_TILE[b.tone]}`}>
                  <Icon name={b.icon} size={20} />
                </span>
                <span className="text-sm font-semibold text-ink-2">{t.profile[`badge${b.id.charAt(0).toUpperCase()}${b.id.slice(1)}`]}</span>
                <span className="text-xs text-ink-3">{b.earned ? "✓" : `${b.cur}/${b.threshold}`}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-brd pt-5">
          <p className="mb-3 text-base font-semibold text-ink">{t.profile.contributions}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {contribRows.map((r) => (
              <div key={r.key} className="rounded-lg bg-surface-2 p-3">
                <p className="text-2xl font-extrabold text-ink">{r.value}</p>
                <p className="text-xs text-ink-3">{r.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-base font-semibold text-ink">{t.profile.accomplishments}</p>
          <Button size="sm" variant="secondary" icon="Plus" onClick={() => setAddOpen(true)}>{t.profile.addAccomplishment}</Button>
        </div>
        {accomplishments.length === 0 ? (
          <p className="text-sm text-ink-3">{t.profile.noAccomplishments}</p>
        ) : (
          <div className="space-y-2">
            {accomplishments.map((a) => {
              const c = CAT_BY_ID[a.category] || CATS[0];
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-brd p-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${ACCENT_TILE[c.tone]}`}>
                    <Icon name={c.icon} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{a.title}</p>
                    <p className="truncate text-xs text-ink-3">
                      {[a.org, a.year].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteAccomplishment(a.id)}
                    aria-label={t.profile.remove}
                    className="shrink-0 rounded-md p-1.5 text-ink-3 hover:bg-danger-bg hover:text-danger"
                  >
                    <Icon name="Trash2" size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <AddAccomplishmentModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={addAccomplishment} />
    </>
  );
}
