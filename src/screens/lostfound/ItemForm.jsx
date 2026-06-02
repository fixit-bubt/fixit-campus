import React, { useState } from "react";
import { Search, PackageCheck, Lock, Plus, Check } from "lucide-react";
import { Card, Button, Field, Input, Textarea, Select, FileUpload, Spinner } from "../../components/ui.jsx";
import { ITEM_CATEGORIES, todayISO } from "../../lib/helpers.js";

const TYPE_OPTIONS = [
  { v: "Lost", Icon: Search, desc: "I lost this" },
  { v: "Found", Icon: PackageCheck, desc: "I found this" },
];

// Shared by "Post an Item" (create) and "Edit Item" (edit).
export function ItemForm({ initial, mode = "create", onSubmit, onCancel }) {
  const [form, setForm] = useState(
    initial || { type: "Found", title: "", category: "", description: "", location: "", date: todayISO(), photo: null }
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function validate() {
    const er = {};
    if (!form.title.trim()) er.title = "Give the item a short title.";
    if (!form.category) er.category = "Choose a category.";
    if (!form.description.trim()) er.description = "Add a description.";
    if (!form.location.trim()) er.location = "Where was it lost or found?";
    if (!form.date) er.date = "Pick a date.";
    return er;
  }

  function submit(e) {
    e.preventDefault();
    const er = validate();
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    setTimeout(() => onSubmit(form), 450);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card className="space-y-5 p-6">
        {/* Type toggle */}
        <div>
          <label className="text-sm font-medium text-slate-700">Type</label>
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
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    active
                      ? tone === "red" ? "border-red-300 bg-red-50" : "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? (tone === "red" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700") : "bg-slate-100 text-slate-500"}`}>
                    <OptIcon size={18} />
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${active ? "text-slate-900" : "text-slate-700"}`}>{opt.v}</p>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
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
          <FileUpload id="if-photo" value={form.photo} onChange={(url) => set("photo", url)} />
        </Field>

        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
          <Lock size={14} className="shrink-0 text-slate-400" />
          Your contact details stay private — they're shared only after an admin approves a claim.
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" icon={mode === "create" ? Plus : Check} disabled={saving}>
          {saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : mode === "create" ? "Post Item" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
