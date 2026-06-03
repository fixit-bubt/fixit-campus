import React from "react";
import { Compass, ArrowLeft, LayoutDashboard, House } from "lucide-react";
import { useApp } from "../data/store.jsx";
import { navigate, Link } from "../lib/router.jsx";
import { Button } from "../components/ui.jsx";
import { Logo } from "../components/Brand.jsx";

export default function NotFound() {
  const { currentUser, dashboardPath } = useApp();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="px-6 py-5">
        <Link to="/"><Logo /></Link>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
          <Compass size={28} />
        </span>
        <p className="mt-6 text-5xl font-bold tracking-tight text-slate-900">404</p>
        <h1 className="mt-2 text-lg font-semibold text-slate-900">Page not found</h1>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <div className="mt-6 flex gap-2">
          <Button variant="secondary" icon={ArrowLeft} onClick={() => (window.history.length > 1 ? window.history.back() : navigate("/"))}>Go back</Button>
          {currentUser ? (
            <Button icon={LayoutDashboard} onClick={() => navigate(dashboardPath(currentUser.role))}>My dashboard</Button>
          ) : (
            <Button icon={House} onClick={() => navigate("/")}>Back to FixIt</Button>
          )}
        </div>
      </div>
    </div>
  );
}
