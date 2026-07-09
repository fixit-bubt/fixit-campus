import React from "react";
import { Search, PackageCheck, MapPin, Calendar, Package } from "lucide-react";
import { Badge } from "./ui.jsx";
import { ITEM_CATEGORY_ICON, fmtDate } from "../lib/helpers.js";

// Photo (or category-icon placeholder) for a lost & found item.
export function ItemPhoto({ item, className = "" }) {
  if (item.photo) {
    return <img src={item.photo} alt={item.title} className={`object-cover ${className}`} />;
  }
  const PlaceholderIcon = ITEM_CATEGORY_ICON[item.category] || Package;
  return (
    <div className={`flex items-center justify-center bg-surface-2 text-ink-3 ${className}`}>
      <PlaceholderIcon size={40} strokeWidth={1.5} />
    </div>
  );
}

// Lost / Found type badge.
export function ItemTypeBadge({ type }) {
  return type === "Lost" ? (
    <Badge tone="red" icon={Search}>Lost</Badge>
  ) : (
    <Badge tone="emerald" icon={PackageCheck}>Found</Badge>
  );
}

// Card used in the Lost & Found browse grid.
export function ItemCard({ item, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-lg border border-brd bg-surface text-left shadow-sm transition-all hover:border-brd-2 hover:shadow-md"
    >
      <div className="relative h-40 w-full overflow-hidden">
        <ItemPhoto item={item} className="h-full w-full transition-transform group-hover:scale-105" />
        <div className="absolute left-3 top-3"><ItemTypeBadge type={item.type} /></div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold text-ink-3">{item.category}</p>
        <h3 className="mt-0.5 line-clamp-1 text-base font-bold text-ink">{item.title}</h3>
        <div className="mt-2 flex flex-col gap-1 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-ink-3" />{item.location}</span>
          <span className="inline-flex items-center gap-1.5"><Calendar size={13} className="text-ink-3" />{fmtDate(item.date)}</span>
        </div>
      </div>
    </button>
  );
}
