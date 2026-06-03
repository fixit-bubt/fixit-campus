import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { Button, Field, Input, Spinner, useToast } from "../../components/ui.jsx";
import { AuthShell } from "./AuthShell.jsx";

export default function Login() {
  const { login, dashboardPath } = useApp();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await login(email, password);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast({ type: "success", title: `Welcome back, ${(res.user.name || "").split(" ")[0]}` });
      navigate(dashboardPath(res.user.role));
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Log in to FixIt"
      subtitle="Welcome back — pick up where you left off."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700">Create one</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Field label="Email" htmlFor="login-email">
          <Input id="login-email" type="email" placeholder="you@bubt.edu.bd" value={email} autoComplete="username" error={!!error} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="login-pw">
          <Input id="login-pw" type="password" placeholder="••••••••" value={password} autoComplete="current-password" error={!!error} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" full disabled={loading}>
          {loading ? <Spinner size={16} className="border-white/40 border-t-white" /> : "Log In"}
        </Button>
      </form>
    </AuthShell>
  );
}
