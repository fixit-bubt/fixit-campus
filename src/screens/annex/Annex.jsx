import React from "react";
import { ExternalLink } from "lucide-react";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { Card, Button } from "../../components/ui.jsx";

const ANNEX_URL = "https://annex.bubt.edu.bd";

// Links out to BUBT's official student portal rather than embedding it.
// A <iframe> was tried first (the site sends no X-Frame-Options/CSP block,
// so it technically loads), but login silently fails inside it — Annex's
// session cookie isn't scoped for third-party/embedded use, and modern
// browsers block that outright; there's no page-side or app-side fix for
// that from a plain iframe. Mobile gets around the equivalent problem with
// two native-only WebView features (sharedCookiesEnabled for the cookie,
// injectedJavaScript to fix the page's forced-dark rendering) — neither has
// a browser equivalent, since a webpage is deliberately barred from reaching
// into a cross-origin frame's cookies or DOM. A new tab is a real browser
// tab, so neither problem exists there.
export default function Annex() {
  return (
    <AppShell activeKey="annex" title="Annex Portal">
      <div className="mx-auto max-w-lg">
        <PageHeader title="Annex Portal" subtitle="BUBT results, routine & attendance." />
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <ExternalLink size={26} />
          </span>
          <div>
            <p className="text-lg font-bold text-ink">Sign in with your own portal account</p>
            <p className="mt-1 text-md text-ink-3">
              Opens in a new tab — the portal's login only works reliably outside an embedded window, so this app never sees your Annex password.
            </p>
          </div>
          <Button icon={ExternalLink} onClick={() => window.open(ANNEX_URL, "_blank", "noopener,noreferrer")}>
            Open Annex Portal
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
