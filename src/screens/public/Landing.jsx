import React from "react";
import { ArrowRight, GraduationCap, ClipboardList, Search, CalendarDays, Store, Stethoscope } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { Button, Badge, Card } from "../../components/ui.jsx";
import { Logo } from "../../components/Brand.jsx";
import { ThemeToggle } from "../../components/ThemeToggle.jsx";

const FEATURES = [
  { Icon: ClipboardList, title: "Report campus issues", body: "Flag a broken light, a leaking tap, or dead Wi-Fi in seconds — then track it from Open to Resolved." },
  { Icon: Search, title: "Lost & Found", body: "Post what you've lost or found, browse the board, and claim items — contact stays private until the poster approves." },
  { Icon: GraduationCap, title: "Faculty directory", body: "Browse 400+ BUBT teachers across all 13 departments, find a supervisor by research area, and save the ones you need." },
  { Icon: CalendarDays, title: "Campus life", body: "Live bus schedules, daily prayer times, upcoming events, and official announcements — all in one place." },
  { Icon: Store, title: "Student community", body: "Buy and sell in the marketplace, share rides, find blood donors, and connect with your classmates." },
  { Icon: Stethoscope, title: "Medical center", body: "Book a doctor's appointment, get a queue token, and manage your visits without standing in line." },
];

export default function Landing() {
  const { currentUser, dashboardPath } = useApp();

  return (
    <div className="min-h-screen bg-surface">
      {/* Top nav */}
      <header className="border-b border-brd">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
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
          <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Your whole campus,
            <br />
            in one app.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-2xl leading-relaxed text-ink-2">
            FixIt is the single place for the BUBT community — report issues, browse faculty, catch the
            bus, buy and sell, donate blood, and book the medical center, all tracked end to end.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="md" className="px-6" onClick={() => navigate("/register")} iconRight={ArrowRight}>
              Get started
            </Button>
            <Button size="md" variant="secondary" className="px-6" onClick={() => navigate("/login")}>
              Log In
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-brd bg-bg">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="grid gap-6 md:grid-cols-3">
            {FEATURES.map((f) => {
              const FeatureIcon = f.Icon;
              return (
                <Card key={f.title} className="p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-100 text-brand-700">
                    <FeatureIcon size={22} />
                  </span>
                  <h3 className="mt-5 text-xl font-bold text-ink">{f.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-ink-2">{f.body}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brd bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <Logo size="sm" />
          <p className="text-base text-ink-3">© 2026 FixIt · Bangladesh University of Business &amp; Technology</p>
        </div>
      </footer>
    </div>
  );
}
