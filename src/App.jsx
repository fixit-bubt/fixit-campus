import React, { useEffect } from "react";
import { useHashRoute, matchRoute, navigate } from "./lib/router.jsx";
import { useApp } from "./data/store.jsx";
import { Spinner } from "./components/ui.jsx";

import Landing from "./screens/public/Landing.jsx";
import Login from "./screens/public/Login.jsx";
import Register from "./screens/public/Register.jsx";

import StudentDashboard from "./screens/student/StudentDashboard.jsx";
import MyReports from "./screens/student/MyReports.jsx";
import ReportIssue from "./screens/student/ReportIssue.jsx";
import EditReport from "./screens/student/EditReport.jsx";
import ReportDetail from "./screens/ReportDetail.jsx";

import StaffDashboard from "./screens/staff/StaffDashboard.jsx";
import AssignedToMe from "./screens/staff/AssignedToMe.jsx";

import AdminDashboard from "./screens/admin/AdminDashboard.jsx";
import AllReports from "./screens/admin/AllReports.jsx";
import ManageUsers from "./screens/admin/ManageUsers.jsx";

import LostFoundBrowse from "./screens/lostfound/LostFoundBrowse.jsx";
import PostItem from "./screens/lostfound/PostItem.jsx";
import EditItem from "./screens/lostfound/EditItem.jsx";
import ItemDetail from "./screens/lostfound/ItemDetail.jsx";

import Profile from "./screens/Profile.jsx";
import NotFound from "./screens/NotFound.jsx";

// Redirect to /login if there's no signed-in user.
function RequireAuth({ children }) {
  const { currentUser } = useApp();
  useEffect(() => {
    if (!currentUser) navigate("/login");
  }, [currentUser]);
  if (!currentUser) return null;
  return children;
}

// Lost & Found is students-only; send staff/admins to their own dashboard.
// Restrict a route to a single role; others are redirected to their own dashboard.
function RequireRole({ role, children }) {
  const { currentUser, dashboardPath } = useApp();
  useEffect(() => {
    if (!currentUser) navigate("/login");
    else if (currentUser.role !== role) navigate(dashboardPath(currentUser.role));
  }, [currentUser]);
  if (!currentUser || currentUser.role !== role) return null;
  return children;
}

export default function App() {
  const path = useHashRoute();
  const { currentUser, dashboardPath, loading } = useApp();

  // While we check for an existing session, hold off routing (avoids a flash
  // of the login page on refresh when the user is actually signed in).
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner size={28} />
      </div>
    );
  }

  // ---- Public routes ----
  if (path === "/" || path === "") return <Landing />;
  if (path === "/login") {
    if (currentUser) { navigate(dashboardPath(currentUser.role)); return null; }
    return <Login />;
  }
  if (path === "/register") {
    if (currentUser) { navigate(dashboardPath(currentUser.role)); return null; }
    return <Register />;
  }

  // ---- Student routes ----
  if (path === "/dashboard") return <RequireRole role="Student"><StudentDashboard /></RequireRole>;
  if (path === "/reports") return <RequireRole role="Student"><MyReports /></RequireRole>;
  if (path === "/reports/new") return <RequireRole role="Student"><ReportIssue /></RequireRole>;
  let m;
  if ((m = matchRoute("/reports/:id/edit", path))) return <RequireRole role="Student"><EditReport id={m.id} /></RequireRole>;
  // Report Detail is shared by the reporter (student), the assigned staff, and admins.
  if ((m = matchRoute("/reports/:id", path))) return <RequireAuth><ReportDetail id={m.id} /></RequireAuth>;

  // ---- Staff routes ----
  if (path === "/staff") return <RequireRole role="Staff"><StaffDashboard /></RequireRole>;
  if (path === "/staff/assigned") return <RequireRole role="Staff"><AssignedToMe /></RequireRole>;

  // ---- Admin routes ----
  if (path === "/admin") return <RequireRole role="Admin"><AdminDashboard /></RequireRole>;
  if (path === "/admin/reports") return <RequireRole role="Admin"><AllReports /></RequireRole>;
  if (path === "/admin/users") return <RequireRole role="Admin"><ManageUsers /></RequireRole>;

  // ---- Profile (any signed-in user) ----
  if (path === "/profile") return <RequireAuth><Profile /></RequireAuth>;

  // ---- Lost & Found (students only) ----
  if (path === "/lost-found") return <RequireRole role="Student"><LostFoundBrowse /></RequireRole>;
  if (path === "/lost-found/new") return <RequireRole role="Student"><PostItem /></RequireRole>;
  if ((m = matchRoute("/lost-found/:id/edit", path))) return <RequireRole role="Student"><EditItem id={m.id} /></RequireRole>;
  if ((m = matchRoute("/lost-found/:id", path))) return <RequireRole role="Student"><ItemDetail id={m.id} /></RequireRole>;

  // ---- 404 ----
  return <NotFound />;
}
