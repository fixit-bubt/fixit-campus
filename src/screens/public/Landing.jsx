import React from "react";
import { ArrowRight, GraduationCap, ClipboardList, Search, CalendarDays, Store, Stethoscope, Bus, Droplet } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { Button, Badge, Card } from "../../components/ui.jsx";
import { Logo } from "../../components/Brand.jsx";
import { ThemeToggle } from "../../components/ThemeToggle.jsx";
import { ACCENT_TILE } from "../../components/featureKit.jsx";

// Landing cards reuse the in-app sector accents so each feature keeps its
// signature color from the first impression on.
const FEATURES = [
  { Icon: ClipboardList, tone: "reports", title: "Report campus issues", body: "Flag a broken light, a leaking tap, or dead Wi-Fi in seconds — then track it from Open to Resolved." },
  { Icon: Search, tone: "lostfound", title: "Lost & Found", body: "Post what you've lost or found, browse the board, and claim items — contact stays private until the poster approves." },
  { Icon: GraduationCap, tone: "faculty", title: "Faculty directory", body: "Browse 400+ BUBT teachers across all 13 departments, find a supervisor by research area, and save the ones you need." },
  { Icon: CalendarDays, tone: "events", title: "Campus life", body: "Live bus schedules, daily prayer times, upcoming events, and official announcements — all in one place." },
  { Icon: Store, tone: "market", title: "Student community", body: "Buy and sell in the marketplace, share rides, find blood donors, and connect with your classmates." },
  { Icon: Stethoscope, tone: "medical", title: "Medical center", body: "Browse the campus doctor directory — see who's available, their specialties, and visiting hours at a glance." },
];

const STATS = [
  { value: "400+", label: "Faculty profiles" },
  { value: "13", label: "Departments" },
  { value: "12+", label: "Campus tools" },
];

export default function Landing() {
  const { currentUser, dashboardPath } = useApp();

  return (
    <div className="min-h-screen bg-surface">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-brd topbar-blur backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6">
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
      <section className="hero-glow relative overflow-hidden">
        {/* Decorative app-preview cards fill the side space on wide screens. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden xl:block">
          <Card className="absolute top-[22%] xl:left-10 2xl:left-[9%] w-60 -rotate-3 p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${ACCENT_TILE.reports}`}>
                <ClipboardList size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-ink">Broken projector</p>
                <p className="truncate text-sm text-ink-3">Room 2412 · Reports</p>
              </div>
            </div>
            <Badge tone="emerald" className="mt-3">Resolved</Badge>
          </Card>
          <Card className="absolute bottom-[16%] xl:left-16 2xl:left-[13%] w-56 rotate-2 p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${ACCENT_TILE.bus}`}>
                <Bus size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-ink">Route 3 · Mirpur 10</p>
                <p className="truncate text-sm text-ink-3">Leaves 5:40 PM</p>
              </div>
            </div>
          </Card>
          <Card className="absolute top-[20%] xl:right-10 2xl:right-[9%] w-60 rotate-3 p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${ACCENT_TILE.blood}`}>
                <Droplet size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-ink">B+ donor request</p>
                <p className="truncate text-sm text-ink-3">Emergency · 3 matches</p>
              </div>
            </div>
            <Badge tone="red" className="mt-3">Urgent</Badge>
          </Card>
          <Card className="absolute bottom-[18%] xl:right-16 2xl:right-[13%] w-56 -rotate-2 p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${ACCENT_TILE.lostfound}`}>
                <Search size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-ink">Blue ID card found</p>
                <p className="truncate text-sm text-ink-3">Cafeteria · today</p>
              </div>
            </div>
          </Card>
        </div>
        <div className="mx-auto max-w-7xl px-6 2xl:max-w-[96rem] pt-20 pb-16 sm:pt-24 sm:pb-20">
          <div className="mx-auto max-w-2xl text-center">
            <Badge tone="blue" icon={GraduationCap} className="mb-6">BUBT Campus</Badge>
            <h1 className="text-[40px] leading-[1.08] font-extrabold tracking-tight text-ink sm:text-[54px]">
              Your whole campus,
              <br />
              <span className="bg-gradient-to-r from-brand to-sector-clubs bg-clip-text text-transparent">
                in one app.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-xl leading-relaxed text-ink-2">
              FixIt is the single place for the BUBT community — report issues, browse faculty,
              catch the bus, buy and sell, find blood donors, and much more.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="md" className="px-6" onClick={() => navigate("/register")} iconRight={ArrowRight}>
                Get started
              </Button>
            </div>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-3xl font-extrabold text-ink">{s.value}</div>
                  <div className="mt-0.5 text-sm font-medium text-ink-3">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-brd bg-bg">
        <div className="mx-auto max-w-7xl px-6 2xl:max-w-[96rem] py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand">Everything on campus</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              One login. Every campus service.
            </h2>
            <p className="mt-3 text-lg leading-relaxed text-ink-2">
              A quick look at what's inside — each tool built around how BUBT actually runs.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3 lg:gap-8">
            {FEATURES.map((f) => {
              const FeatureIcon = f.Icon;
              return (
                <Card
                  key={f.title}
                  className="p-6 transition-all duration-200 hover:-translate-y-1 hover:border-brd-2 hover:shadow-lg"
                >
                  <span className={`flex h-11 w-11 items-center justify-center rounded-md ${ACCENT_TILE[f.tone]}`}>
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

      {/* CTA band */}
      <section className="border-t border-brd bg-bg">
        <div className="mx-auto max-w-7xl px-6 2xl:max-w-[96rem] pb-16 sm:pb-20">
          {/* Fixed brand hues (not tokens) so white text keeps contrast in both themes. */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2b5be3] to-[#1f47c4] px-6 py-12 text-center sm:py-14">
            <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-20 -left-12 h-64 w-64 rounded-full bg-white/5" />
            <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Ready to get started?
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-lg leading-relaxed text-white/80">
              Create an account and get your whole campus in one place — issues, faculty, buses, market, and more.
            </p>
            <button
              onClick={() => navigate("/register")}
              className="relative mt-7 inline-flex h-11 items-center gap-2 rounded-md bg-white px-6 text-base font-bold text-[#1f47c4] transition-colors hover:bg-white/90"
            >
              Create your account
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brd bg-surface">
        <div className="flex flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <Logo size="sm" />
          <p className="text-base text-ink-3">© 2026 FixIt · Bangladesh University of Business &amp; Technology</p>
        </div>
      </footer>
    </div>
  );
}
