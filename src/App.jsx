import React from "react";
import { useHashRoute, navigate } from "./lib/router.jsx";
import { useApp } from "./data/store.jsx";

import Landing from "./screens/public/Landing.jsx";
import Login from "./screens/public/Login.jsx";
import Register from "./screens/public/Register.jsx";
import NotFound from "./screens/NotFound.jsx";

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

  // ---- 404 ----
  return <NotFound />;
}
