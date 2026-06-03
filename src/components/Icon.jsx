import React from "react";
import * as Lucide from "lucide-react";

// ============================================================================
// Icon — resolves a lucide-react icon by name.
// The original three features import icon components directly (e.g. <Plus/>).
// The campus features pass icon NAMES as strings (e.g. <Icon name="Bus" />),
// which this resolves against lucide-react. `resolveIcon` lets the shared UI
// components accept either a name string or a component.
// To shrink the bundle, you can replace `import * as Lucide` with explicit
// named imports of just the icons you use.
// ============================================================================

export function resolveIcon(name) {
  if (typeof name !== "string") return name; // already a component
  return Lucide[name] || Lucide.Square;
}

export function Icon({ name, size = 20, strokeWidth = 2, className = "", ...rest }) {
  const Cmp = resolveIcon(name);
  if (!Cmp) return null;
  return <Cmp size={size} strokeWidth={strokeWidth} className={className} {...rest} />;
}
