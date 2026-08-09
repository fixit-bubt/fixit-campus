import React, { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { Spinner } from "../../components/ui.jsx";
import { AuthShell } from "./AuthShell.jsx";

// Landing pad for the Google OAuth redirect (see loginWithGoogle in store.jsx).
// supabase-js exchanges the ?code= param for a session automatically on load
// (detectSessionInUrl), which lands as a normal sessionUserId update — this
// screen just waits for that and then routes on, same as Login/Register do
// after a password sign-in. The App-level onboarding gate (App.jsx) still
// applies above this: a new student with no studentId sees Onboarding first,
// this screen never gets a second render.
export default function AuthCallback() {
  const { currentUser, sessionUserId, profileError, dashboardPath } = useApp();
  const [oauthError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("error_description") || params.get("error") || "";
  });

  useEffect(() => {
    if (currentUser) navigate(dashboardPath(currentUser.role));
  }, [currentUser, dashboardPath]);

  if (oauthError) {
    return (
      <AuthShell title="Couldn't sign you in" subtitle="Google sign-in was cancelled or failed.">
        <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-bg p-3 text-base text-danger">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{oauthError}</span>
        </div>
        <Link to="/login" className="mt-4 block text-center font-semibold text-brand hover:text-brand-700">
          Back to log in
        </Link>
      </AuthShell>
    );
  }

  if (sessionUserId && profileError) {
    return (
      <AuthShell title="Couldn't load your profile" subtitle="Signed in, but something went wrong fetching your account.">
        <Link to="/login" className="block text-center font-semibold text-brand hover:text-brand-700">
          Back to log in
        </Link>
      </AuthShell>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <Spinner size={28} />
    </div>
  );
}
