import React, { useState } from "react";
import { Save, Mail, Check } from "lucide-react";
import { useApp } from "../data/store.jsx";
import { Card, Button, Field, Input, FileUpload, Avatar, Badge, Spinner, useToast } from "../components/ui.jsx";
import { AppShell, PageHeader, ROLE_TONE } from "../components/AppShell.jsx";

// Small on/off switch.
function Toggle({ checked, onChange, label, hint }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-start justify-between gap-3 text-left">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>}
      </span>
      <span className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-slate-300"}`}>
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

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
    directoryVisible: currentUser.directoryVisible !== false,
    showWhatsapp: currentUser.showWhatsapp === true,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => { setSaved(false); setForm((f) => ({ ...f, [k]: e.target.value })); };
  const setToggle = (k) => (v) => { setSaved(false); setForm((f) => ({ ...f, [k]: v })); };

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
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
                onChange={(url, file) => { setSaved(false); setForm((f) => ({ ...f, avatar: url, avatarFile: file })); }}
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

            <Field
              label="WhatsApp number"
              htmlFor="pf-wa"
              hint={
                isStudent
                  ? "Shared with a matched person after a Lost & Found claim is approved — and with other students only if you turn on sharing below."
                  : "Optional — an extra contact number for your profile."
              }
            >
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

            {isStudent && (
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <p className="text-sm font-semibold text-slate-900">Student Directory</p>
                <Toggle
                  checked={form.directoryVisible}
                  onChange={setToggle("directoryVisible")}
                  label="Show me in the Student Directory"
                  hint="Let other students find you. If you turn this off you're hidden — and you won't be able to browse others either."
                />
                <Toggle
                  checked={form.showWhatsapp}
                  onChange={setToggle("showWhatsapp")}
                  label="Show my WhatsApp to other students"
                  hint="Lets classmates message you on WhatsApp from your directory profile."
                />
              </div>
            )}
          </Card>

          <div className="flex items-center justify-end gap-3">
            {saved && !saving && (
              <span className="text-sm font-medium text-emerald-600">Changes saved</span>
            )}
            <Button type="submit" variant={saved ? "secondary" : "primary"} icon={saved ? Check : Save} disabled={saving}>
              {saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : saved ? "Saved" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
