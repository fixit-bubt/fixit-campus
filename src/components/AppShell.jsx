import React, { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  CirclePlus,
  PackageSearch,
  ClipboardCheck,
  Users,
  CircleUser,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useApp } from "../data/store.jsx";
import { navigate, Link } from "../lib/router.jsx";
import { Avatar, Badge } from "./ui.jsx";
import { Logo } from "./Brand.jsx";

// ============================================================================
// AppShell — sidebar + top bar + content area for all logged-in screens.
// Role-aware nav. Mobile: sidebar collapses into a slide-in drawer.
// ============================================================================

const NAV_BY_ROLE = {
  Student: [
    { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard, path: "/dashboard" },
    { key: "reports", label: "My Reports", Icon: FileText, path: "/reports" },
    { key: "report-new", label: "Report an Issue", Icon: CirclePlus, path: "/reports/new" },
    { key: "lost-found", label: "Lost & Found", Icon: PackageSearch, path: "/lost-found" },
    { key: "directory", label: "Students", Icon: Users, path: "/students" },
    { key: "profile", label: "My Profile", Icon: CircleUser, path: "/profile" },
  ],
  Staff: [
    { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard, path: "/staff" },
    { key: "assigned", label: "Assigned to Me", Icon: ClipboardCheck, path: "/staff/assigned" },
    { key: "profile", label: "My Profile", Icon: CircleUser, path: "/profile" },
  ],
  Admin: [
    { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard, path: "/admin" },
    { key: "all-reports", label: "All Reports", Icon: FileText, path: "/admin/reports" },
    { key: "users", label: "Manage Users", Icon: Users, path: "/admin/users" },
    { key: "profile", label: "My Profile", Icon: CircleUser, path: "/profile" },
  ],
};

export const ROLE_TONE = { Student: "blue", Staff: "amber", Admin: "emerald" };

function SidebarContent({ nav, activeKey, onNavigate, onLogout }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link to="/"><Logo /></Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map((item) => {
          const active = item.key === activeKey;
          const ItemIcon = item.Icon;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.path)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <ItemIcon size={18} className={active ? "text-blue-600" : "text-slate-400"} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut size={18} className="text-slate-400" />
          Log out
        </button>
      </div>
    </div>
  );
}

export function AppShell({ activeKey, title, actions, children }) {
  const { currentUser, logout } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  if (!currentUser) return null;
  const nav = NAV_BY_ROLE[currentUser.role] || [];

  function go(path) {
    setDrawerOpen(false);
    navigate(path);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-slate-200 bg-white lg:block">
        <SidebarContent nav={nav} activeKey={activeKey} onNavigate={go} onLogout={logout} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
            <SidebarContent nav={nav} activeKey={activeKey} onNavigate={go} onLogout={logout} />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0 flex-1">
            {title && <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{title}</h1>}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {actions}
            <button
              onClick={() => navigate("/profile")}
              title="My profile"
              className="hidden items-center gap-2.5 rounded-lg p-1 pr-1.5 hover:bg-slate-100 sm:flex"
            >
              <div className="text-right">
                <p className="text-sm font-medium leading-tight text-slate-900">{currentUser.name}</p>
                <p className="text-xs leading-tight text-slate-400">{currentUser.email}</p>
              </div>
              <Avatar name={currentUser.name} src={currentUser.avatar} />
            </button>
            <button onClick={() => navigate("/profile")} title="My profile" className="sm:hidden">
              <Avatar name={currentUser.name} src={currentUser.avatar} size={32} />
            </button>
            <Badge tone={ROLE_TONE[currentUser.role]} className="hidden sm:inline-flex">{currentUser.role}</Badge>
            <button
              onClick={logout}
              title="Log out"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

// PageHeader — title + subtitle + optional action, used at top of content
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  );
}
