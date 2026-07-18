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
  if (isNaN(d.getTime())) return ""; // don't render "Invalid Date"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function relativeDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return "";
  // Compare by calendar day (local), so "today" vs "yesterday" doesn't depend
  // on the exact hours between the two timestamps.
  const startOfDay = (t) => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return fmtDate(iso);
}

// Local calendar date (YYYY-MM-DD) — not UTC, so it matches <input type="date">.
export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// Force a real download of a (possibly cross-origin) file with a given name.
// The <a download> attribute is ignored cross-origin, so fetch the bytes and
// download a blob URL instead. Falls back to opening the file in a new tab.
export async function downloadFile(url, filename) {
  if (!url) return false;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
    return true;
  } catch {
    window.open(url, "_blank", "noopener");
    return false;
  }
}

// ---------------------------------------------------------------------------
// Lost & Found match finder — candidates are OPPOSITE-type, same-category,
// open items by other people, ranked by keyword overlap (title tokens count
// double) then recency. Used by the post form ("already found?") and the
// item detail's "possible matches" panel; the DB trigger (0075) mirrors the
// category/type/date rule for notifications.
// ---------------------------------------------------------------------------
const MATCH_STOPWORDS = new Set([
  "the", "and", "with", "for", "near", "from", "this", "that", "was", "one",
  "has", "have", "its", "her", "his", "our", "your", "colour", "color",
]);

function matchTokens(text) {
  return new Set(
    (text || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !MATCH_STOPWORDS.has(t))
  );
}

export function findItemMatches(target, items, { excludePosterId, limit = 4 } = {}) {
  if (!target?.type || !target?.category) return [];
  const titleTokens = matchTokens(target.title);
  const descTokens = matchTokens(target.description);
  const candidates = items.filter(
    (i) =>
      i.type !== target.type &&
      i.category === target.category &&
      i.status === "Open" &&
      i.id !== target.id &&
      (!excludePosterId || i.posterId !== excludePosterId)
  );
  return candidates
    .map((i) => {
      const iTitle = matchTokens(i.title);
      const iAll = new Set([...iTitle, ...matchTokens(i.description)]);
      let score = 0;
      for (const t of titleTokens) { if (iTitle.has(t)) score += 2; else if (iAll.has(t)) score += 1; }
      for (const t of descTokens) if (iAll.has(t)) score += 1;
      return { item: i, score };
    })
    .sort((a, b) => b.score - a.score || (b.item.createdAt || "").localeCompare(a.item.createdAt || ""))
    .slice(0, limit);
}
