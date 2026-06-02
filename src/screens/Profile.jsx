import React, { useState } from "react";
import { Save, Mail, ShieldCheck } from "lucide-react";
import { useApp } from "../data/store.jsx";
import { Card, Button, Field, Input, FileUpload, Avatar, Badge, Spinner, useToast } from "../components/ui.jsx";
import { AppShell, PageHeader, ROLE_TONE } from "../components/AppShell.jsx";

export default function Profile() {
  const { currentUser, updateProfile } = useApp();
  const toast = useToast();
  const isStudent = currentUser.role === "Student";

  const [form, setForm] = useState({
    name: currentUser.name || "",
    whatsapp: currentUser.whatsapp || "",
    intake: currentUser.intake || "",
    section: currentUser.section || "",
    avatar: currentUser.avatar || null,
    avatarFile: null,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!form.name.trim()) er.name = "Enter your name.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    const res = await updateProfile(form);
    setSaving(false);
    if (!res.ok) {
      toast({ type: "error", title: "Couldn't save profile", message: res.error });
      return;
    }
    toast({ type: "success", title: "Profile saved" });
  }

  return (
    <AppShell activeKey="profile" title="My Profile">
      <div className="mx-auto max-w-2xl">
        <PageHeader title="My Profile" subtitle="Update your photo and contact details." />

        <form onSubmit={submit} className="space-y-6">
          <Card className="space-y-5 p-6">
            {/* Identity header */}
            <div className="flex items-center gap-4">
              <Avatar name={form.name} src={form.avatar} size={56} />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">{form.name || "Your name"}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <Badge tone={ROLE_TONE[currentUser.role]}>{currentUser.role}</Badge>
                  {currentUser.dept && <span className="text-xs text-slate-400">{currentUser.dept}</span>}
                </div>
              </div>
            </div>

            <Field label="Profile photo" htmlFor="pf-photo" hint="Optional — shown on your account and across the app.">
              <FileUpload
                id="pf-photo"
                value={form.avatar}
                onChange={(url, file) => setForm((f) => ({ ...f, avatar: url, avatarFile: file }))}
              />
            </Field>

            <Field label="Full name" htmlFor="pf-name" required error={errors.name}>
              <Input id="pf-name" value={form.name} error={!!errors.name} onChange={set("name")} />
            </Field>

            <Field label="Email" htmlFor="pf-email" hint="Your login email can't be changed here.">
              <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                <Mail size={15} className="text-slate-400" />
                {currentUser.email}
              </div>
            </Field>

            <Field label="WhatsApp number" htmlFor="pf-wa" hint="Shared with the other person only after a Lost & Found claim is approved.">
              <Input id="pf-wa" type="tel" placeholder="e.g. +8801XXXXXXXXX" value={form.whatsapp} onChange={set("whatsapp")} />
            </Field>

            {isStudent && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Intake" htmlFor="pf-intake" hint="e.g. 49">
                  <Input id="pf-intake" placeholder="Intake" value={form.intake} onChange={set("intake")} />
                </Field>
                <Field label="Section" htmlFor="pf-section" hint="e.g. 5 / B">
                  <Input id="pf-section" placeholder="Section" value={form.section} onChange={set("section")} />
                </Field>
              </div>
            )}
          </Card>

          <div className="flex justify-end">
            <Button type="submit" icon={Save} disabled={saving}>
              {saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
