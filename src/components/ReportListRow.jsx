import React from "react";
import { ChevronRight, CircleHelp } from "lucide-react";
import { StatusBadge } from "./ui.jsx";
import { CATEGORY_ICON, relativeDate } from "../lib/helpers.js";

// A single report row used in dashboards and assigned-work lists.
export function ReportListRow({ report, onOpen }) {
  const CatIcon = CATEGORY_ICON[report.category] || CircleHelp;
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-slate-50">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <CatIcon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{report.category}</p>
        <p className="truncate text-xs text-slate-500">
          {report.building}
          {report.room ? ` · ${report.room}` : ""}
        </p>
      </div>
      <div className="hidden text-right sm:block">
        <p className="text-xs text-slate-400">{relativeDate(report.createdAt)}</p>
        <p className="font-mono text-[11px] text-slate-300">{report.id}</p>
      </div>
      <StatusBadge status={report.status} />
      <ChevronRight size={16} className="hidden text-slate-300 sm:block" />
    </button>
  );
}
