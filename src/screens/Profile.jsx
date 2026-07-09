import React, { useState } from "react";
import { Save, Mail, Check, Lock } from "lucide-react";
import { useApp } from "../data/store.jsx";
import { Card, Button, Field, Input, Select, FileUpload, Avatar, Badge, Spinner, useToast } from "../components/ui.jsx";
import { AppShell, PageHeader, ROLE_TONE } from "../components/AppShell.jsx";
import { Icon } from "../components/Icon.jsx";

// Small on/off switch.
function Toggle({ checked, onChange, label, hint }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-start justify-between gap-3 text-left">
      <span className="min-w-0">
        <span className="block text-base font-semibold text-ink-2">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-ink-3">{hint}</span>}
      </span>
      <span className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-brand" : "bg-brd-2"}`}>
        <span className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

export default function Profile() {
  const { currentUser, updateProfile, changePassword } = useApp();
  const toast = useToast();
  // Change-password form state
  const [pwForm, setPwForm] = useState({ newPw: "", confirmPw: "" });
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  async function submitPassword(e) {
    e.preventDefault();
    if (pwSaving) return;
    if (pwForm.newPw.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    if (pwForm.newPw !== pwForm.confirmPw) { setPwError("Passwords don't match."); return; }
    setPwError("");
    setPwSaving(true);
    try {
      const res = await changePassword(pwForm.newPw);
      if (!res.ok) { setPwError(res.error); return; }
      toast({ type: "success", title: "Password changed", message: "Your new password is active." });
      setPwForm({ newPw: "", confirmPw: "" });
    } finally {
      setPwSaving(false);
    }
  }

  const [form, setForm] = useState({
    name: currentUser?.name || "",
    whatsapp: currentUser?.whatsapp || "",
    phone: currentUser?.phone || "",
    bloodGroup: currentUser?.bloodGroup || "",
    address: currentUser?.address || "",
    intake: currentUser?.intake || "",
    section: currentUser?.section || "",
    studentId: currentUser?.studentId || "",
    program: currentUser?.program || "",
    avatar: currentUser?.avatar || null,
    avatarFile: null,
    directoryVisible: currentUser?.directoryVisible !== false,
    showWhatsapp: currentUser?.showWhatsapp === true,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!currentUser) return null;
  const isStudent = currentUser.role === "Student";
  const set = (k) => (e) => { setSaved(false); setForm((f) => ({ ...f, [k]: e.target.value })); };
  const setToggle = (k) => (v) => { setSaved(false); setForm((f) => ({ ...f, [k]: v })); };

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    const er = {};
    if (!form.name.trim()) er.name = "Enter your name.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const res = await updateProfile(form);
      if (!res.ok) {
        toast({ type: "error", title: "Couldn't save profile", message: res.error });
        return;
      }
      toast({ type: "success", title: "Profile saved" });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
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
                <p className="truncate text-xl font-semibold text-ink">{form.name || "Your name"}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <Badge tone={ROLE_TONE[currentUser.role]}>{currentUser.role}</Badge>
                  {currentUser.dept && <span className="text-xs text-ink-3">{currentUser.dept}</span>}
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
              <div className="flex h-10 items-center gap-2 rounded-md border border-brd bg-surface-2 px-3 text-base text-ink-3">
                <Mail size={15} className="text-ink-3" />
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

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Phone" htmlFor="pf-phone" hint="Optional — a call number for your profile.">
                <Input id="pf-phone" type="tel" placeholder="e.g. 01XXXXXXXXX" value={form.phone} onChange={set("phone")} />
              </Field>
              <Field label="Blood group" htmlFor="pf-blood" hint={isStudent ? "Shown in the Student Directory." : "Optional."}>
                <Select id="pf-blood" value={form.bloodGroup} onChange={set("bloodGroup")}>
                  <option value="">Select…</option>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Address" htmlFor="pf-address" hint="Optional — your home/hostel address.">
              <Input id="pf-address" placeholder="e.g. Mirpur, Dhaka" value={form.address} onChange={set("address")} />
            </Field>

            {isStudent && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Student ID" htmlFor="pf-sid" hint="e.g. 20214103001">
                  <Input id="pf-sid" placeholder="Student ID" value={form.studentId} onChange={set("studentId")} />
                </Field>
                <Field label="Program" htmlFor="pf-program" hint="e.g. B.Sc. in CSE">
                  <Input id="pf-program" placeholder="Program" value={form.program} onChange={set("program")} />
                </Field>
                <Field label="Intake" htmlFor="pf-intake" hint="e.g. 49">
                  <Input id="pf-intake" placeholder="Intake" value={form.intake} onChange={set("intake")} />
                </Field>
                <Field label="Section" htmlFor="pf-section" hint="e.g. 5 / B">
                  <Input id="pf-section" placeholder="Section" value={form.section} onChange={set("section")} />
                </Field>
              </div>
            )}

            {isStudent && (
              <div className="space-y-4 border-t border-brd pt-5">
                <p className="text-base font-semibold text-ink">Student Directory</p>
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
              <span className="text-base font-semibold text-success">Changes saved</span>
            )}
            <Button type="submit" variant={saved ? "secondary" : "primary"} icon={saved ? Check : Save} disabled={saving}>
              {saving ? <Spinner size={16} className="border-white/40 border-t-white" /> : saved ? "Saved" : "Save changes"}
            </Button>
          </div>
        </form>

        {/* Change password */}
        <form onSubmit={submitPassword} className="mt-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <Icon name="Lock" size={18} className="text-ink-3" />
              <h3 className="text-xl font-semibold text-ink">Change Password</h3>
            </div>
            <div className="space-y-4">
              <Field label="New password" htmlFor="pw-new" hint="Minimum 8 characters.">
                <Input id="pw-new" type="password" placeholder="Enter new password" value={pwForm.newPw}
                  onChange={(e) => { setPwError(""); setPwForm((f) => ({ ...f, newPw: e.target.value })); }} />
              </Field>
              <Field label="Confirm new password" htmlFor="pw-confirm" error={pwError || undefined}>
                <Input id="pw-confirm" type="password" placeholder="Repeat new password" value={pwForm.confirmPw} error={!!pwError}
                  onChange={(e) => { setPwError(""); setPwForm((f) => ({ ...f, confirmPw: e.target.value })); }} />
              </Field>
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="submit" icon={Lock} disabled={pwSaving || !pwForm.newPw}>
                {pwSaving ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Change password"}
              </Button>
            </div>
          </Card>
        </form>
      </div>
    </AppShell>
  );
}
