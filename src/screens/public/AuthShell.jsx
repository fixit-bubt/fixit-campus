import React from "react";
import { Link } from "../../lib/router.jsx";
import { Card } from "../../components/ui.jsx";
import { Logo } from "../../components/Brand.jsx";
import { ThemeToggle } from "../../components/ThemeToggle.jsx";

// Shared centered layout for Login / Register (public, no app shell).
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/"><Logo /></Link>
        <ThemeToggle />
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
