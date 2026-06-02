import React from "react";
import { Wrench } from "lucide-react";

// Brand mark — wrench glyph in a blue rounded square + wordmark
export function Logo({ size = "md", onDark = false, withWord = true }) {
  const dims = { sm: 30, md: 36, lg: 44 };
  const d = dims[size] || 36;
  const word = { sm: "text-base", md: "text-lg", lg: "text-xl" }[size] || "text-lg";
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex items-center justify-center rounded-lg bg-blue-600 text-white" style={{ width: d, height: d }}>
        <Wrench size={d * 0.55} />
      </span>
      {withWord && (
        <span className={`font-bold tracking-tight ${word} ${onDark ? "text-white" : "text-slate-900"}`}>FixIt</span>
      )}
    </span>
  );
}
