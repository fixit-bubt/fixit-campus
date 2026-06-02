import React from "react";
import { ArrowRight, GraduationCap, ClipboardList, Search, ShieldCheck } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { Button, Badge, Card } from "../../components/ui.jsx";
import { Logo } from "../../components/Brand.jsx";

const FEATURES = [
  { Icon: ClipboardList, title: "Report campus issues", body: "Flag a broken light, a leaking tap, or dead Wi-Fi in seconds — then track it from Open to Resolved." },
  { Icon: Search, title: "Lost & Found", body: "Post what you've lost or found, browse the board, and claim items — contact details stay private until verified." },
  { Icon: ShieldCheck, title: "Handled by the right people", body: "Reports route to campus staff and admins, so the people who can fix it actually see it." },
];

export default function Landing() {
  const { currentUser, dashboardPath } = useApp();

  return (
    <div className="min-h-screen bg-white">
      {/* Top nav */}
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-2">
            {currentUser ? (
              <Button onClick={() => navigate(dashboardPath(currentUser.role))} iconRight={ArrowRight}>
                Go to dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate("/login")}>Log In</Button>
                <Button onClick={() => navigate("/register")}>Sign Up</Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="blue" icon={GraduationCap} className="mb-6">BUBT Campus</Badge>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Report campus issues.
            <br />
            Find what&apos;s lost.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            FixIt is the single place for the BUBT community to report maintenance problems and reunite
            with lost belongings — tracked end to end, handled by the right staff.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="md" className="h-11 px-6 text-base" onClick={() => navigate("/register")} iconRight={ArrowRight}>
              Get started
            </Button>
            <Button size="md" variant="secondary" className="h-11 px-6 text-base" onClick={() => navigate("/login")}>
              Log In
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="grid gap-6 md:grid-cols-3">
            {FEATURES.map((f) => {
              const FeatureIcon = f.Icon;
              return (
                <Card key={f.title} className="p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <FeatureIcon size={22} />
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <Logo size="sm" />
          <p className="text-sm text-slate-400">© 2026 FixIt · Bangladesh University of Business &amp; Technology</p>
        </div>
      </footer>
    </div>
  );
}
