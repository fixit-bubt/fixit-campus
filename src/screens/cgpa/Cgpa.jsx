import React, { useMemo, useRef, useState } from "react";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { navigate } from "../../lib/router.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { Card, Button } from "../../components/ui.jsx";
import { GRADE_POINTS, computeGpa } from "../../components/featureKit.jsx";

// Authed CGPA calculator — same grade scale + calc as the public
// /explore/cgpa preview (see featureKit.jsx), just wrapped in AppShell for
// signed-in students. Client-only: nothing is saved or sent.
export default function Cgpa() {
  return (
    <AppShell activeKey="cgpa" title="CGPA Calculator">
      <button onClick={() => navigate("/dashboard")} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
        <ArrowLeft size={16} /> Dashboard
      </button>
      <PageHeader title="CGPA Calculator" subtitle="Add your courses, credits, and grades to get your GPA — BUBT grading scale." />
      <CgpaBody />
    </AppShell>
  );
}

// Also rendered by the public /explore/cgpa route (no login) — same form,
// same calc, just a different sticky offset since the public nav capsule and
// the authed AppShell capsule aren't the same height (see `stickyClass`).
export function CgpaBody({ stickyClass = "lg:sticky lg:top-24 lg:self-start" }) {
  const [rows, setRows] = useState([
    { id: 1, name: "", credit: "3", grade: "A" },
    { id: 2, name: "", credit: "3", grade: "A" },
    { id: 3, name: "", credit: "3", grade: "A" },
  ]);
  const nextId = useRef(4);

  const addRow = () => setRows((r) => [...r, { id: nextId.current++, name: "", credit: "3", grade: "A" }]);
  const removeRow = (id) => setRows((r) => (r.length > 1 ? r.filter((x) => x.id !== id) : r));
  const update = (id, patch) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const { gpa, totalCredits } = useMemo(() => computeGpa(rows), [rows]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card className="p-5">
        <div className="hidden gap-3 px-1 pb-2 text-sm font-bold text-ink-3 sm:grid sm:grid-cols-[1fr_90px_110px_40px]">
          <span>Course (optional)</span><span>Credit</span><span>Grade</span><span></span>
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[1fr_70px_90px_40px] gap-2 sm:grid-cols-[1fr_90px_110px_40px]">
              <input
                value={r.name}
                onChange={(e) => update(r.id, { name: e.target.value })}
                placeholder="e.g. CSE 101"
                className="h-11 rounded-md border border-brd bg-surface px-3 text-base text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
              />
              <input
                value={r.credit}
                onChange={(e) => update(r.id, { credit: e.target.value })}
                inputMode="decimal"
                className="h-11 rounded-md border border-brd bg-surface px-3 text-base text-ink focus:border-brand focus:outline-none"
              />
              <select
                value={r.grade}
                onChange={(e) => update(r.id, { grade: e.target.value })}
                className="h-11 rounded-md border border-brd bg-surface px-2 text-base text-ink focus:border-brand focus:outline-none"
              >
                {GRADE_POINTS.map(([g, p]) => <option key={g} value={g}>{g} ({p.toFixed(2)})</option>)}
              </select>
              <button
                onClick={() => removeRow(r.id)}
                aria-label="Remove course"
                className="inline-flex h-11 w-10 items-center justify-center rounded-md border border-brd text-ink-3 hover:bg-surface-2 hover:text-danger"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <Button variant="secondary" icon={Plus} onClick={addRow} className="mt-4">Add course</Button>
      </Card>

      <div className={stickyClass}>
        <Card className="p-6 text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-ink-3">Your GPA</p>
          <p className="mt-2 text-5xl font-extrabold tabular-nums text-brand">{gpa.toFixed(2)}</p>
          <p className="mt-2 text-base text-ink-2">{totalCredits} credit{totalCredits === 1 ? "" : "s"} across {rows.length} course{rows.length === 1 ? "" : "s"}</p>
          <p className="mt-4 text-xs leading-relaxed text-ink-3">
            Weighted by credit hours on the BUBT scale (A+ = 4.00). Calculated in your browser — nothing is saved or sent.
          </p>
        </Card>
      </div>
    </div>
  );
}
