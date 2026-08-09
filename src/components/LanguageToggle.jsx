import React from "react";
import { useApp } from "../data/store.jsx";

// EN / বাং text toggle — same icon-button footprint as ThemeToggle so the two
// sit together in a topbar cleanly.
export function LanguageToggle({ className = "" }) {
  const { lang, toggleLang } = useApp();
  const isEn = lang === "en";
  return (
    <button
      type="button"
      onClick={toggleLang}
      title={isEn ? "বাংলায় দেখুন" : "Switch to English"}
      aria-label={isEn ? "Switch to Bengali" : "Switch to English"}
      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-bold text-ink-3 hover:bg-surface-2 hover:text-ink-2 transition-colors ${className}`}
    >
      {isEn ? "বাং" : "EN"}
    </button>
  );
}
