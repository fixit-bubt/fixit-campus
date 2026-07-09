import React, { useState } from "react";
import { AlertCircle, MailCheck } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { Button, Field, Input, useToast } from "../../components/ui.jsx";
import { AuthShell } from "./AuthShell.jsx";

// Password reset via emailed 6-digit code:
//   1) resetPasswordForEmail sends the code
//   2) verifyOtp(type:'recovery') + updateUser({ password }) on one screen —
//      the successful verify opens a session, so the user ends up signed in.
export default function ForgotPassword() {
  const { requestPasswordReset, resetPasswordWithCode } = useApp();
  const toast = useToast();
  const [step, setStep] = useState(1); // 1 = email, 2 = code + new password
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendCode(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Enter a valid email address."); return; }
    setLoading(true);
    try {
      const r = await requestPasswordReset(email);
      if (!r.ok) { setError(r.error); return; }
      toast({ type: "info", title: "Code sent", message: `Check ${email.trim()} for a 6-digit code.` });
      setStep(2);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    if (code.trim().length !== 6) { setError("Enter the 6-digit code from the email."); return; }
    if (password.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (confirm !== password) { setError("Passwords don't match."); return; }
    setLoading(true);
    try {
      const r = await resetPasswordWithCode(email, code, password);
      if (!r.ok) { setError(r.error); return; }
      toast({ type: "success", title: "Password updated", message: "You're signed in with your new password." });
      // Verify opened a session; /login redirects to the right dashboard
      // once the profile finishes loading.
      navigate("/login");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={step === 1 ? "Reset your password" : "Check your email"}
      subtitle={step === 1
        ? "We'll email you a 6-digit code to reset it."
        : `Enter the code sent to ${email.trim()} and choose a new password.`}
      footer={
        <>
          Remembered it?{" "}
          <Link to="/login" className="font-semibold text-brand hover:text-brand-700">Back to log in</Link>
        </>
      }
    >
      {step === 1 ? (
        <form onSubmit={sendCode} className="space-y-4" noValidate>
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-bg p-3 text-base text-danger">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Field label="Email" htmlFor="fp-email">
            <Input id="fp-email" type="email" placeholder="you@bubt.edu.bd" value={email} autoComplete="username" error={!!error} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          <Button type="submit" full loading={loading}>Send code</Button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="space-y-4" noValidate>
          <div className="flex items-start gap-2 rounded-md bg-surface-2 p-3 text-xs text-ink-3">
            <MailCheck size={15} className="mt-0.5 shrink-0" />
            The code expires after a short while — request a new one if it stops working.
          </div>
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-bg p-3 text-base text-danger">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Field label="6-digit code" htmlFor="fp-code">
            <Input id="fp-code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6}
              value={code} error={!!error} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus
              className="text-center font-mono tracking-[0.4em]" />
          </Field>
          <Field label="New password" htmlFor="fp-pw" hint="At least 8 characters.">
            <Input id="fp-pw" type="password" placeholder="••••••••" value={password} autoComplete="new-password" error={!!error} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm new password" htmlFor="fp-confirm">
            <Input id="fp-confirm" type="password" placeholder="••••••••" value={confirm} autoComplete="new-password" error={!!error} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button type="submit" full loading={loading}>Reset password</Button>
          <button type="button" onClick={sendCode} disabled={loading}
            className="w-full text-center text-base font-semibold text-brand hover:text-brand-700 disabled:opacity-50">
            Resend code
          </button>
        </form>
      )}
    </AuthShell>
  );
}
