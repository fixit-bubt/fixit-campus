import React from "react";
import { CircleHelp, UserCheck } from "lucide-react";
import { Card, Button, StatusBadge, Avatar } from "./ui.jsx";
import { useApp } from "../data/store.jsx";
import { CATEGORY_ICON, fmtDate } from "../lib/helpers.js";

// Reports table with a per-row Assign/Reassign action (admin).
export function ReportsTable({ rows, onAssign, onOpen }) {
  const { userById } = useApp();
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-medium">Report</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Assigned</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const staff = r.assignedStaffId ? userById(r.assignedStaffId) : null;
              const terminal = r.status === "Rejected" || r.status === "Closed";
              const CatIcon = CATEGORY_ICON[r.category] || CircleHelp;
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button onClick={() => onOpen(r)} className="flex items-center gap-3 text-left">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <CatIcon size={16} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900">{r.category}</span>
                        <span className="block font-mono text-xs text-slate-400">{r.id}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {r.building}
                    {r.room ? `, ${r.room}` : ""}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {staff ? (
                      <span className="inline-flex items-center gap-2">
                        <Avatar name={staff.name} size={22} />
                        <span className="text-slate-700">{staff.name}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
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
