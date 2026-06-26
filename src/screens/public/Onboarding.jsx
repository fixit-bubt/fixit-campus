import React, { useState } from "react";
import { ArrowRight, LogOut } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { Card, Button, Field, Input, Select, useToast } from "../../components/ui.jsx";
import { Logo } from "../../components/Brand.jsx";

// Post-login gate: a student can't reach the app until they've supplied a
// Student ID (mirrors CampusOne's mandatory onboarding). Other fields are
// optional here but encouraged — they populate the shared student directory.
export default function Onboarding() {
  const { currentUser, departments = [], updateProfile, logout } = useApp();
  const toast = useToast();
  const [form, setForm] = useState({
    studentId: currentUser?.studentId || "",
    program: currentUser?.program || currentUser?.dept || "",
    intake: currentUser?.intake || "",
    section: currentUser?.section || "",
    bloodGroup: currentUser?.bloodGroup || "",
    phone: currentUser?.phone || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => { setError(""); setForm((f) => ({ ...f, [k]: e.target.value })); };

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    if (!form.studentId.trim()) { setError("Your Student ID is required to continue."); return; }
    setSaving(true);
    try {
      // Pass a complete profile payload so updateProfile doesn't wipe existing
      // name / whatsapp / avatar / directory settings.
      const res = await updateProfile({
        name: currentUser.name,
        whatsapp: currentUser.whatsapp || "",
        phone: form.phone,
        bloodGroup: form.bloodGroup,
        address: currentUser.address || "",
        intake: form.intake,
        section: form.section,
        studentId: form.studentId,
        program: form.program,
        avatar: currentUser.avatar || null,
        avatarFile: null,
        directoryVisible: currentUser.directoryVisible !== false,
        showWhatsapp: currentUser.showWhatsapp === true,
      });
      if (!res.ok) { setError(res.error || "Couldn't save. Try again."); return; }
      toast({ type: "success", title: "You're all set!" });
      // currentUser.studentId is now set → App.jsx releases the gate automatically.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between px-6 py-5">
        <Logo />
        <button onClick={() => logout()} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <LogOut size={16} /> Sign out
        </button>
      </header>
      <div className="flex flex-1 items-start justify-center px-6 pb-16 pt-6">
        <div className="w-full max-w-lg">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Complete your profile</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Welcome{currentUser?.name ? `, ${currentUser.name.split(" ")[0]}` : ""}! Add your academic details to get started.
            </p>
          </div>
          <Card className="p-6">
            <form onSubmit={submit} className="space-y-4">
              <Field label="Student ID" htmlFor="ob-sid" required error={error && !form.studentId.trim() ? error : undefined}>
                <Input id="ob-sid" value={form.studentId} error={!!error && !form.studentId.trim()} onChange={set("studentId")} placeholder="e.g. 20214103001" autoFocus />
              </Field>
              <Field label="Program" htmlFor="ob-pr">
                <Select id="ob-pr" value={form.program} onChange={set("program")}>
                  <option value="">Select program…</option>
                  {form.program && !departments.some((d) => d.name === form.program) && <option value={form.program}>{form.program}</option>}
                  {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Intake" htmlFor="ob-in"><Input id="ob-in" value={form.intake} onChange={set("intake")} placeholder="e.g. 49" /></Field>
                <Field label="Section" htmlFor="ob-se"><Input id="ob-se" value={form.section} onChange={set("section")} placeholder="e.g. 5" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Blood group" htmlFor="ob-bg" hint="Optional">
                  <Select id="ob-bg" value={form.bloodGroup} onChange={set("bloodGroup")}>
                    <option value="">Select…</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => <option key={g} value={g}>{g}</option>)}
                  </Select>
                </Field>
                <Field label="Phone" htmlFor="ob-ph" hint="Optional"><Input id="ob-ph" type="tel" value={form.phone} onChange={set("phone")} placeholder="01XXXXXXXXX" /></Field>
              </div>
              {error && form.studentId.trim() && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" full iconRight={ArrowRight} loading={saving}>Continue to FixIt</Button>
            </form>
          </Card>
          <p className="mt-4 text-center text-xs text-slate-400">You can edit these anytime from My Profile.</p>
        </div>
      </div>
    </div>
  );
}
