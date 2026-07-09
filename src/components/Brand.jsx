import React from "react";
import { Wrench } from "lucide-react";

// Brand mark — wrench glyph in a brand rounded square + wordmark
export function Logo({ size = "md", onDark = false, withWord = true }) {
  const dims = { sm: 30, md: 36, lg: 44 };
  const d = dims[size] || 36;
  const word = { sm: "text-xl", md: "text-2xl", lg: "text-3xl" }[size] || "text-2xl";
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex items-center justify-center rounded-md bg-brand text-white" style={{ width: d, height: d }}>
        <Wrench size={d * 0.55} />
      </span>
      {withWord && (
        <span className={`font-extrabold tracking-tight ${word} ${onDark ? "text-white" : "text-ink"}`}>FixIt</span>
      )}
    </span>
  );
}
