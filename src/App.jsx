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
function RequireStudent({ children }) {
  const { currentUser, dashboardPath } = useApp();
  useEffect(() => {
    if (!currentUser) navigate("/login");
    else if (currentUser.role !== "Student") navigate(dashboardPath(currentUser.role));
  }, [currentUser]);
  if (!currentUser || currentUser.role !== "Student") return null;
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
  if (path === "/dashboard") return <RequireAuth><StudentDashboard /></RequireAuth>;
  if (path === "/reports") return <RequireAuth><MyReports /></RequireAuth>;
  if (path === "/reports/new") return <RequireAuth><ReportIssue /></RequireAuth>;
  let m;
  if ((m = matchRoute("/reports/:id/edit", path))) return <RequireAuth><EditReport id={m.id} /></RequireAuth>;
  if ((m = matchRoute("/reports/:id", path))) return <RequireAuth><ReportDetail id={m.id} /></RequireAuth>;

  // ---- Staff routes ----
  if (path === "/staff") return <RequireAuth><StaffDashboard /></RequireAuth>;
  if (path === "/staff/assigned") return <RequireAuth><AssignedToMe /></RequireAuth>;

  // ---- Admin routes ----
  if (path === "/admin") return <RequireAuth><AdminDashboard /></RequireAuth>;
  if (path === "/admin/reports") return <RequireAuth><AllReports /></RequireAuth>;
  if (path === "/admin/users") return <RequireAuth><ManageUsers /></RequireAuth>;

  // ---- Lost & Found (students only) ----
  if (path === "/lost-found") return <RequireStudent><LostFoundBrowse /></RequireStudent>;
  if (path === "/lost-found/new") return <RequireStudent><PostItem /></RequireStudent>;
  if ((m = matchRoute("/lost-found/:id/edit", path))) return <RequireStudent><EditItem id={m.id} /></RequireStudent>;
  if ((m = matchRoute("/lost-found/:id", path))) return <RequireStudent><ItemDetail id={m.id} /></RequireStudent>;

  // ---- 404 ----
  return <NotFound />;
}
