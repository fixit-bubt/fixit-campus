import React from "react";
import { CirclePlus } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { Button } from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { FilterTabs } from "../../components/FilterTabs.jsx";
import { MyReportsPanel } from "./MyReports.jsx";
import { CampusIssuesPanel } from "./CampusIssues.jsx";

// ============================================================================
// Reports — one page for the whole report loop, in tabs:
//   My Reports    (/reports)        — the reports you filed, and their progress
//   Campus Board  (/campus-issues)  — anonymous board of shared reports
// and "Report an Issue" as the page's primary action (/reports/new).
//
// These were three separate sidebar rows in two different nav groups, which
// meant the duplicate-check ("has someone already reported this?") lived two
// rows away from the button that files a new report. Same loop, one page.
//
// Each tab keeps its OWN route, so deep links, notifications and the browser
// back button all still work — the tab bar navigates rather than holding local
// state, and the route is what selects the panel.
// ============================================================================

// Tab labels match the wording used everywhere else in the app ("Campus Issues"
// board — see the toggle on a report card, its toasts, and ReportForm's opt-in
// checkbox). Renaming the tab would have orphaned all of that copy.
const MINE = "My Reports";
const BOARD = "Campus Issues";
const TABS = [
  { label: MINE, path: "/reports" },
  { label: BOARD, path: "/campus-issues" },
];

export default function Reports({ tab = "mine" }) {
  const { currentUser, reports, campusIssues } = useApp();
  if (!currentUser) return null;
  const active = tab === "board" ? BOARD : MINE;

  const mineCount = reports.filter((r) => r.studentId === currentUser.id).length;
  const counts = { [MINE]: mineCount, [BOARD]: campusIssues.length };

  return (
    <AppShell activeKey="reports" title="Reports">
      <PageHeader
        title="Reports"
        subtitle={
          active === MINE
            ? "Track the campus issues you've reported."
            : "Issues students reported across campus. Already affected? Add a “Me too” instead of filing a duplicate — no names are shown."
        }
        action={<Button icon={CirclePlus} onClick={() => navigate("/reports/new")}>Report an Issue</Button>}
      />

      <div className="mb-5">
        <FilterTabs
          options={TABS.map((t) => t.label)}
          value={active}
          onChange={(label) => navigate(TABS.find((t) => t.label === label).path)}
          counts={counts}
        />
      </div>

      {active === MINE ? <MyReportsPanel /> : <CampusIssuesPanel />}
    </AppShell>
  );
}
