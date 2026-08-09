import React from "react";
import { Link } from "../../lib/router.jsx";
import { Card } from "../../components/ui.jsx";
import { Logo } from "../../components/Brand.jsx";
import { ThemeToggle } from "../../components/ThemeToggle.jsx";
import { LanguageToggle } from "../../components/LanguageToggle.jsx";
import { useT } from "../../i18n/index.js";

// Google's official "G" mark — not in lucide-react, so it's a static inline SVG.
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
    </svg>
  );
}

// Shared "Continue with Google" button — Login/Register both redirect out via
// loginWithGoogle() from the store, so this stays a dumb click handler.
export function GoogleButton({ onClick, loading, label = "Continue with Google" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-brd bg-surface text-base font-semibold text-ink-2 shadow-sm transition-colors hover:bg-surface-2 disabled:opacity-50 disabled:pointer-events-none"
    >
      {loading ? (
        <span className="inline-block h-[18px] w-[18px] animate-spin rounded-full border-2 border-current border-r-transparent opacity-70" />
      ) : (
        <GoogleMark />
      )}
      {label}
    </button>
  );
}

export function OrDivider() {
  const t = useT();
  return (
    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-ink-3">
      <div className="h-px flex-1 bg-brd" />
      {t.common.or}
      <div className="h-px flex-1 bg-brd" />
    </div>
  );
}

// Shared centered layout for Login / Register (public, no app shell).
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/"><Logo /></Link>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-7 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-ink">{title}</h1>
            {subtitle && <p className="mt-1.5 text-base text-ink-2">{subtitle}</p>}
          </div>
          <Card className="p-6">{children}</Card>
          {footer && <div className="mt-5 text-center text-base text-ink-3">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
