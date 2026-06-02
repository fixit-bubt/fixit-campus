import React from "react";
import { useHashRoute } from "./lib/router.jsx";

import Landing from "./screens/public/Landing.jsx";
import NotFound from "./screens/NotFound.jsx";

// Routes are added here one feature at a time as the app grows.
export default function App() {
  const path = useHashRoute();

  // ---- Public routes ----
  if (path === "/" || path === "") return <Landing />;

  // ---- 404 ----
  return <NotFound />;
}
