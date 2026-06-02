import {
  Zap,
  Droplets,
  Sparkles,
  Wifi,
  Armchair,
  ShieldAlert,
  CircleHelp,
  Backpack,
  Smartphone,
  FileBadge,
  Package,
} from "lucide-react";

// ============================================================================
// Shared constants + helpers.
// Icon maps resolve to lucide-react components (not strings), so call sites do:
//   const CatIcon = CATEGORY_ICON[category] || CircleHelp;
//   <CatIcon size={18} />
// ============================================================================

export const CATEGORIES = [
  "Electrical",
  "Plumbing",
  "Cleanliness",
  "IT / Network",
  "Furniture",
  "Safety / Security",
  "Other",
];

export const ITEM_CATEGORIES = ["Personal", "Electronics", "Documents", "Other"];

export const CATEGORY_ICON = {
  Electrical: Zap,
  Plumbing: Droplets,
  Cleanliness: Sparkles,
  "IT / Network": Wifi,
  Furniture: Armchair,
  "Safety / Security": ShieldAlert,
  Other: CircleHelp,
};

export const ITEM_CATEGORY_ICON = {
  Personal: Backpack,
  Electronics: Smartphone,
  Documents: FileBadge,
  Other: Package,
};

export function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function relativeDate(iso) {
  if (!iso) return "";
  const then = new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).getTime();
  const days = Math.round((Date.now() - then) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return fmtDate(iso);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
