import React from "react";

// Segmented filter tabs with optional per-option counts.
export function FilterTabs({ options, value, onChange, counts }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-base font-semibold transition-colors ${
              active ? "bg-ink text-surface" : "bg-surface text-ink-2 border border-brd hover:bg-surface-2"
            }`}
          >
            {opt}
            {counts && counts[opt] != null && (
              <span className={`rounded-full px-1.5 text-xs ${active ? "bg-white/20 dark:bg-black/15" : "bg-surface-3 text-ink-3"}`}>
                {counts[opt]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
