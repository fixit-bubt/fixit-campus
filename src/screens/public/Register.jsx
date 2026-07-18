import React, { useState } from "react";
import { Info } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { Button, Field, Input, Spinner, useToast } from "../../components/ui.jsx";
import { AuthShell } from "./AuthShell.jsx";
import { PENDING_VERIFY_KEY } from "./VerifyEmail.jsx";

export default function Register() {
  const { register, dashboardPath } = useApp();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate() {
    const er = {};
    if (!form.name.trim()) er.name = "Enter your full name.";
    if (!form.email.trim()) er.email = "Enter your email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) er.email = "Enter a valid email address.";
    if (!form.password) er.password = "Choose a password.";
    else if (form.password.length < 8) er.password = "Password must be at least 8 characters.";
    if (form.confirm !== form.password) er.confirm = "Passwords don't match.";
    return er;
  }

  async function submit(e) {
    e.preventDefault();
    if (loading) return;
    const er = validate();
    setErrors(er);
    if (Object.keys(er).length) return;
    setLoading(true);
    try {
      const res = await register({ name: form.name, email: form.email, password: form.password });
      if (!res.ok) {
        setErrors({ email: res.error });
        return;
      }
      if (res.needsConfirm) {
        // Confirm-email is ON: no session yet — collect the 6-digit code.
        try { sessionStorage.setItem(PENDING_VERIFY_KEY, form.email.trim()); } catch { /* fine */ }
        toast({ type: "info", title: "Check your email", message: "We sent a 6-digit code to verify your account." });
        navigate("/verify-email");
        return;
      }
      toast({ type: "success", title: "Account created", message: "You're signed in as a Student." });
      // res.user can be null if the profile row wasn't readable yet; the session
      // effect will route once it loads. Default to the student dashboard.
      navigate(dashboardPath(res.user?.role || "Student"));
    } catch {
      setErrors({ email: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join FixIt to report issues and use Lost & Found."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand hover:text-brand-700">Log in</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="reg-name" required error={errors.name}>
          <Input id="reg-name" placeholder="e.g. Tahmid Rahman" value={form.name} error={!!errors.name} onChange={set("name")} />
        </Field>
        <Field label="Email" htmlFor="reg-email" required error={errors.email}>
          <Input id="reg-email" type="email" placeholder="you@bubt.edu.bd" value={form.email} error={!!errors.email} onChange={set("email")} />
        </Field>
        <Field label="Password" htmlFor="reg-pw" required error={errors.password} hint="At least 8 characters.">
          <Input id="reg-pw" type="password" placeholder="••••••••" value={form.password} error={!!errors.password} onChange={set("password")} />
        </Field>
        <Field label="Confirm password" htmlFor="reg-confirm" required error={errors.confirm}>
          <Input id="reg-confirm" type="password" placeholder="••••••••" value={form.confirm} error={!!errors.confirm} onChange={set("confirm")} />
        </Field>
        <div className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2.5 text-xs text-ink-3">
          <Info size={14} className="shrink-0" />
          New accounts start with the <span className="font-semibold text-ink-2">Student</span> role. Staff &amp; Admin accounts are created by an administrator.
        </div>
        <Button type="submit" full disabled={loading}>
          {loading ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Create Account"}
        </Button>
      </form>
    </AuthShell>
  );
}
