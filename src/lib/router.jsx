import React, { useState, useEffect } from "react";

// ============================================================================
// Tiny hash router.
//   useHashRoute() -> current path string (no leading #)
//   navigate(path) -> set location
//   matchRoute(pattern, path) -> params object or null (supports :params)
//   <Link to="/x"> -> anchor that uses the hash router
// Swap this out for react-router-dom when wiring real navigation/SSR.
// ============================================================================

export function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash || "#/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash.replace(/^#/, "") || "/";
}

export function navigate(path) {
  if ("#" + path === window.location.hash) return;
  window.location.hash = path;
}

export function matchRoute(pattern, path) {
  const pp = pattern.split("/").filter(Boolean);
  const ph = path.split("/").filter(Boolean);
  if (pp.length !== ph.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(":")) {
      const key = pp[i].slice(1);
      // Don't let a malformed %-escape (e.g. "#/reports/%") crash the whole app.
      try { params[key] = decodeURIComponent(ph[i]); } catch { params[key] = ph[i]; }
    } else if (pp[i] !== ph[i]) return null;
  }
  return params;
}

export function Link({ to, className = "", children, ...rest }) {
  return (
    <a
      href={"#" + to}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
