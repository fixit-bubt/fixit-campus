import React, { useState } from "react";
import { AlertCircle, MailCheck } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { Button, Field, Input, useToast } from "../../components/ui.jsx";
import { AuthShell } from "./AuthShell.jsx";

// Where Register/Login stash the address awaiting verification (hash router
// has no navigation state; survives a refresh of this screen).
export const PENDING_VERIFY_KEY = "fixit-pending-verify-email";

// Signup email verification (only reached when the project has confirm-email
// ON — signUp returned no session, or login failed with "Email not confirmed").
// verifyOtp(type:'signup') opens a session; App then routes to onboarding or
// the dashboard.
export default function VerifyEmail() {
  const { verifySignupCode, resendSignupCode } = useApp();
  const toast = useToast();
  const [email, setEmail] = useState(() => {
    try { return sessionStorage.getItem(PENDING_VERIFY_KEY) || ""; } catch { return ""; }
  });
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Enter the email you signed up with."); return; }
    if (code.trim().length !== 6) { setError("Enter the 6-digit code from the email."); return; }
    setLoading(true);
    try {
      const r = await verifySignupCode(email, code);
      if (!r.ok) { setError(r.error); return; }
      try { sessionStorage.removeItem(PENDING_VERIFY_KEY); } catch { /* fine */ }
      toast({ type: "success", title: "Email verified", message: "Welcome to FixIt!" });
      // A session is now open; /login redirects onward once the profile loads
      // (new students land on onboarding first).
      navigate("/login");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (resending) return;
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Enter the email you signed up with."); return; }
    setResending(true);
    try {
      const r = await resendSignupCode(email);
      if (!r.ok) { setError(r.error); return; }
      toast({ type: "info", title: "Code sent", message: `A new code is on its way to ${email.trim()}.` });
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell
      title="Verify your email"
      subtitle="We emailed you a 6-digit code to activate your account."
      footer={
        <>
          Wrong account?{" "}
          <Link to="/register" className="font-semibold text-brand hover:text-brand-700">Sign up again</Link>
          {" · "}
          <Link to="/login" className="font-semibold text-brand hover:text-brand-700">Log in</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="flex items-start gap-2 rounded-md bg-surface-2 p-3 text-xs text-ink-3">
          <MailCheck size={15} className="mt-0.5 shrink-0" />
          Can't find it? Check spam, or resend the code below.
        </div>
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-bg p-3 text-base text-danger">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Field label="Email" htmlFor="ve-email">
          <Input id="ve-email" type="email" placeholder="you@bubt.edu.bd" value={email} autoComplete="username" error={!!error} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="6-digit code" htmlFor="ve-code">
          <Input id="ve-code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6}
            value={code} error={!!error} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus
            className="text-center font-mono tracking-[0.4em]" />
        </Field>
        <Button type="submit" full loading={loading}>Verify &amp; continue</Button>
        <button type="button" onClick={resend} disabled={resending}
          className="w-full text-center text-base font-semibold text-brand hover:text-brand-700 disabled:opacity-50">
          {resending ? "Sending…" : "Resend code"}
        </button>
      </form>
    </AuthShell>
  );
}
