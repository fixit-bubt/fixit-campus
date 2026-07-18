import React, { useState, useMemo } from "react";
import { Search, PackageCheck, Lock, Plus, Check, Sparkles, MapPin } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { Card, Button, Field, Input, Textarea, Select, FileUpload, Spinner, Badge } from "../../components/ui.jsx";
import { ITEM_CATEGORIES, todayISO, findItemMatches, fmtDate } from "../../lib/helpers.js";

const TYPE_OPTIONS = [
  { v: "Lost", Icon: Search, desc: "I lost this" },
  { v: "Found", Icon: PackageCheck, desc: "I found this" },
];

// Shared by "Post an Item" (create) and "Edit Item" (edit).
export function ItemForm({ initial, mode = "create", onSubmit, onCancel }) {
  const { items = [], currentUser } = useApp();
  const [form, setForm] = useState(
    initial || { type: "Found", title: "", category: "", description: "", location: "", date: todayISO(), photo: null }
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Live "is it already here?" matches — opposite type, same category, ranked
  // by keyword overlap. Only while creating, once there's enough to match on.
  const matches = useMemo(() => {
    if (mode !== "create" || !form.category || form.title.trim().length < 3) return [];
    return findItemMatches(form, items, { excludePosterId: currentUser?.id });
  }, [mode, form.type, form.category, form.title, form.description, items, currentUser?.id]);

  function validate() {
    const er = {};
    if (!form.title.trim()) er.title = "Give the item a short title.";
    if (!form.category) er.category = "Choose a category.";
    if (!form.description.trim()) er.description = "Add a description.";
    if (!form.location.trim()) er.location = "Where was it lost or found?";
    if (!form.date) er.date = "Pick a date.";
    else if (form.date > todayISO()) er.date = "Date can't be in the future.";
    return er;
  }

  async function submit(e) {
    e.preventDefault();
    const er = validate();
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card className="space-y-5 p-6">
        {/* Type toggle */}
        <div>
          <label className="text-base font-semibold text-ink-2">Type</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.map((opt) => {
              const active = form.type === opt.v;
              const tone = opt.v === "Lost" ? "red" : "emerald";
              const OptIcon = opt.Icon;
              return (
                <button
                  type="button"
                  key={opt.v}
                  onClick={() => set("type", opt.v)}
                  className={`flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                    active
                      ? tone === "red" ? "border-danger bg-danger-bg" : "border-success bg-success-bg"
                      : "border-brd bg-surface hover:bg-surface-2"
                  }`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-md ${active ? (tone === "red" ? "bg-danger-bg text-danger" : "bg-success-bg text-success") : "bg-surface-3 text-ink-3"}`}>
                    <OptIcon size={18} />
                  </span>
                  <div>
                    <p className={`text-base font-semibold ${active ? "text-ink" : "text-ink-2"}`}>{opt.v}</p>
                    <p className="text-xs text-ink-3">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Title" htmlFor="if-title" required error={errors.title}>
          <Input id="if-title" placeholder="e.g. Black framed eyeglasses" value={form.title} error={!!errors.title} onChange={(e) => set("title", e.target.value)} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" htmlFor="if-cat" required error={errors.category}>
            <Select id="if-cat" value={form.category} error={!!errors.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">Select a category</option>
              {ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Date" htmlFor="if-date" required error={errors.date}>
            <Input id="if-date" type="date" value={form.date} max={todayISO()} error={!!errors.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
        </div>

        <Field label="Location" htmlFor="if-loc" required error={errors.location}>
          <Input id="if-loc" placeholder="e.g. Building A, Room 210" value={form.location} error={!!errors.location} onChange={(e) => set("location", e.target.value)} />
        </Field>

        <Field label="Description" htmlFor="if-desc" required error={errors.description} hint="Distinctive details help verify the real owner.">
          <Textarea id="if-desc" rows={4} placeholder="Describe the item — color, brand, marks, contents…" value={form.description} error={!!errors.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        <Field label="Photo" htmlFor="if-photo" hint="Optional, but a photo makes items much easier to recognize.">
          <FileUpload
            id="if-photo"
            value={form.photo}
            onChange={(url, file) => setForm((f) => ({ ...f, photo: url, photoFile: file }))}
          />
        </Field>

        <div className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2.5 text-xs text-ink-3">
          <Lock size={14} className="shrink-0 text-ink-3" />
          Your contact details stay private — they're shared only after you approve a claim on this item.
        </div>
      </Card>

      {/* Possible matches already on the board */}
      {matches.length > 0 && (
        <Card className="space-y-3 border-brand bg-brand-50 p-5">
          <p className="inline-flex items-center gap-2 text-base font-bold text-ink">
            <Sparkles size={16} className="text-brand" />
            {form.type === "Lost"
              ? "Someone may have already found this — check before posting"
              : "Someone may be looking for this — check before posting"}
          </p>
          <div className="grid gap-2">
            {matches.map(({ item: m }) => (
              <a
                key={m.id}
                href={`#/lost-found/${m.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-md border border-brd bg-surface px-3 py-2.5 hover:bg-surface-2"
              >
                <Badge tone={m.type === "Lost" ? "red" : "emerald"}>{m.type}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-ink">{m.title}</span>
                  <span className="block truncate text-xs text-ink-3">
                    <MapPin size={11} className="mr-0.5 inline" />
                    {m.location} · {fmtDate(m.date)}
                  </span>
                </span>
              </a>
            ))}
          </div>
          <p className="text-xs text-ink-3">Opens in a new tab — your draft here stays as it is.</p>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" icon={mode === "create" ? Plus : Check} disabled={saving}>
          {saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : mode === "create" ? "Post Item" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
