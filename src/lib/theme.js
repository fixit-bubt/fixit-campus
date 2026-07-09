import { useState, useCallback } from "react";

// Dark mode = `class="dark"` on <html>. Persisted choice wins; otherwise the
// OS preference (prefers-color-scheme) decides on first load.
const KEY = "fixit-theme";

export function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    /* storage blocked — fall back to OS preference */
  }
  const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
}

export function isDark() {
  return document.documentElement.classList.contains("dark");
}

export function useTheme() {
  const [dark, setDark] = useState(isDark);
  const toggle = useCallback(() => {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      /* fine — theme just won't persist */
    }
    setDark(next);
  }, []);
  return { dark, toggle };
}
