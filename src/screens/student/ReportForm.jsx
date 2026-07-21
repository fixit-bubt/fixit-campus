import React, { useState } from "react";
import { Send, Check } from "lucide-react";
import { Card, Button, Field, Input, Textarea, Select, FileUpload, Spinner } from "../../components/ui.jsx";
import { CATEGORIES } from "../../lib/helpers.js";

// Shared by "Report an Issue" (create) and "Edit Report" (edit).
export function ReportForm({ initial, mode = "create", onSubmit, onCancel }) {
  const [form, setForm] = useState(
    initial || { category: "", description: "", building: "", room: "", photo: null, showOnBoard: true }
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

  async function submit(e) {
    e.preventDefault();
    const er = validate();
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      // Safety / Security reports are never shown on the Campus Issues board,
      // whatever the checkbox held before the category was chosen.
      const boardable = form.category !== "Safety / Security";
      await onSubmit({ ...form, showOnBoard: boardable && form.showOnBoard !== false });
    } finally {
      setSaving(false);
    }
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
            maxLength={1000}
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
          <FileUpload
            id="rf-photo"
            value={form.photo}
            onChange={(url, file) => setForm((f) => ({ ...f, photo: url, photoFile: file }))}
          />
        </Field>

        {/* Campus Issues board opt-in — Safety / Security is always private. */}
        {form.category === "Safety / Security" ? (
          <p className="rounded-md border border-brd bg-surface-2 p-3 text-xs text-ink-3">
            Safety &amp; Security reports are always private — they are never shown on the Campus Issues board.
          </p>
        ) : (
          <label htmlFor="rf-board" className="flex cursor-pointer items-start gap-3 rounded-md border border-brd bg-surface-2 p-3">
            <input
              id="rf-board"
              type="checkbox"
              checked={form.showOnBoard !== false}
              onChange={(e) => set("showOnBoard", e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
            />
            <span className="text-base text-ink-2">
              <span className="font-semibold text-ink">Show this on the Campus Issues board</span>
              <span className="mt-0.5 block text-xs text-ink-3">
                Lets other students see the issue and add a “Me too” instead of reporting it again. Your name is never shown.
              </span>
            </span>
          </label>
        )}
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
