import React, { useState } from "react";
import { Send, Check } from "lucide-react";
import { Card, Button, Field, Input, Textarea, Select, FileUpload, Spinner } from "../../components/ui.jsx";
import { CATEGORIES } from "../../lib/helpers.js";

// Shared by "Report an Issue" (create) and "Edit Report" (edit).
export function ReportForm({ initial, mode = "create", onSubmit, onCancel }) {
  const [form, setForm] = useState(
    initial || { category: "", description: "", building: "", room: "", photo: null }
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function validate() {
    const er = {};
    if (!form.category) er.category = "Choose a category.";
    if (!form.description.trim()) er.description = "Describe the issue.";
    else if (form.description.trim().length < 12) er.description = "Add a bit more detail (at least 12 characters).";
    if (!form.building.trim()) er.building = "Enter the building.";
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
        <Field label="Category" htmlFor="rf-cat" required error={errors.category}>
          <Select id="rf-cat" value={form.category} error={!!errors.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>

        <Field label="Description" htmlFor="rf-desc" required error={errors.description} hint="What's wrong, where exactly, and since when.">
          <Textarea
            id="rf-desc"
            rows={5}
            placeholder="e.g. The projector in Room 402 won't connect over HDMI…"
            value={form.description}
            error={!!errors.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Building" htmlFor="rf-building" required error={errors.building}>
            <Input id="rf-building" placeholder="e.g. Building B" value={form.building} error={!!errors.building} onChange={(e) => set("building", e.target.value)} />
          </Field>
          <Field label="Room / area" htmlFor="rf-room" hint="Optional">
            <Input id="rf-room" placeholder="e.g. 402" value={form.room} onChange={(e) => set("room", e.target.value)} />
          </Field>
        </div>

        <Field label="Photo" htmlFor="rf-photo" hint="Optional — a photo helps staff find and fix it faster.">
          <FileUpload id="rf-photo" value={form.photo} onChange={(url) => set("photo", url)} />
        </Field>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" icon={mode === "create" ? Send : Check} disabled={saving}>
          {saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : mode === "create" ? "Submit Report" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
