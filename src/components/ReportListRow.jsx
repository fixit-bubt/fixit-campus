import React from "react";
import { ChevronRight, CircleHelp } from "lucide-react";
import { StatusBadge } from "./ui.jsx";
import { CATEGORY_ICON, relativeDate } from "../lib/helpers.js";

// A single report row used in dashboards and assigned-work lists.
export function ReportListRow({ report, onOpen }) {
  const CatIcon = CATEGORY_ICON[report.category] || CircleHelp;
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-surface-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-3 text-ink-3">
        <CatIcon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-ink">{report.category}</p>
        <p className="truncate text-xs text-ink-3">
          {report.building}
          {report.room ? ` · ${report.room}` : ""}
        </p>
      </div>
      <div className="hidden text-right sm:block">
        <p className="text-xs text-ink-3">{relativeDate(report.createdAt)}</p>
        <p className="font-mono text-[11px] text-ink-3 opacity-70">{report.id}</p>
      </div>
      <StatusBadge status={report.status} />
      <ChevronRight size={16} className="hidden text-ink-3 sm:block" />
    </button>
  );
}
