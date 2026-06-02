import React, { useEffect } from "react";
import { useHashRoute, navigate } from "./lib/router.jsx";
import { useApp } from "./data/store.jsx";

import Landing from "./screens/public/Landing.jsx";
import Login from "./screens/public/Login.jsx";
import Register from "./screens/public/Register.jsx";

import StudentDashboard from "./screens/student/StudentDashboard.jsx";

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

// Routes are added here one feature at a time as the app grows.
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

  // ---- 404 ----
  return <NotFound />;
}
