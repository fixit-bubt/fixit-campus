import React, { useEffect } from "react";
import { useHashRoute, matchRoute, navigate } from "./lib/router.jsx";
import { useApp } from "./data/store.jsx";

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
import ClaimQueue from "./screens/admin/ClaimQueue.jsx";

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

export default function App() {
  const path = useHashRoute();
  const { currentUser, dashboardPath } = useApp();

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
  if (path === "/admin/claims") return <RequireAuth><ClaimQueue /></RequireAuth>;
  if (path === "/admin/users") return <RequireAuth><ManageUsers /></RequireAuth>;

  // ---- Lost & Found (shared) ----
  if (path === "/lost-found") return <RequireAuth><LostFoundBrowse /></RequireAuth>;
  if (path === "/lost-found/new") return <RequireAuth><PostItem /></RequireAuth>;
  if ((m = matchRoute("/lost-found/:id/edit", path))) return <RequireAuth><EditItem id={m.id} /></RequireAuth>;
  if ((m = matchRoute("/lost-found/:id", path))) return <RequireAuth><ItemDetail id={m.id} /></RequireAuth>;

  // ---- 404 ----
  return <NotFound />;
}
