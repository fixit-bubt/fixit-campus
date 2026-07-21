import React from "react";
import { CircleHelp, UserCheck, ThumbsUp } from "lucide-react";
import { Card, Button, StatusBadge, Avatar } from "./ui.jsx";
import { useApp } from "../data/store.jsx";
import { CATEGORY_ICON, fmtDate } from "../lib/helpers.js";

// Reports table with a per-row Assign/Reassign action (admin).
export function ReportsTable({ rows = [], onAssign, onOpen }) {
  const { userById, reportVoteCounts = {} } = useApp();
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-base">
          <thead>
            <tr className="border-b border-brd bg-surface-2 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">
              <th className="px-4 py-3 font-medium">Report</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Me too</th>
              <th className="px-4 py-3 font-medium">Assigned</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brd">
            {rows.map((r) => {
              const staff = r.assignedStaffId ? userById(r.assignedStaffId) : null;
              const terminal = r.status === "Rejected" || r.status === "Closed";
              const CatIcon = CATEGORY_ICON[r.category] || CircleHelp;
              return (
                <tr key={r.id} className="hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <button onClick={() => onOpen(r)} className="flex items-center gap-3 text-left">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-3 text-ink-3">
                        <CatIcon size={16} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink">{r.category}</span>
                        <span className="block font-mono text-xs text-ink-3">{r.id}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-ink-2 whitespace-nowrap">
                    {r.building}
                    {r.room ? `, ${r.room}` : ""}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(reportVoteCounts[r.uuid] || 0) > 0 ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-ink-2">
                        <ThumbsUp size={14} className="text-brand" />
                        {reportVoteCounts[r.uuid]}
                      </span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {staff ? (
                      <span className="inline-flex items-center gap-2">
                        <Avatar name={staff.name} size={22} />
                        <span className="text-ink-2">{staff.name}</span>
                      </span>
                    ) : (
                      <span className="text-ink-3">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-3 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {terminal ? (
                      <Button size="sm" variant="ghost" onClick={() => onOpen(r)}>View</Button>
                    ) : (
                      <Button size="sm" variant={r.assignedStaffId ? "ghost" : "secondary"} icon={UserCheck} onClick={() => onAssign(r)}>
                        {r.assignedStaffId ? "Reassign" : "Assign"}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
