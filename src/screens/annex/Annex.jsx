import React, { useState } from "react";
import { ExternalLink } from "lucide-react";
import { AppShell } from "../../components/AppShell.jsx";
import { Card, Spinner } from "../../components/ui.jsx";

const ANNEX_URL = "https://annex.bubt.edu.bd";

// Embeds BUBT's official student portal (results/routine/attendance) in-app,
// same reason mobile wraps it in a WebView — it's a real third-party site the
// app never touches credentials for, just frames. Unlike mobile, the site
// doesn't send X-Frame-Options/CSP frame-ancestors (checked directly), so a
// plain iframe works here without needing a proxy.
export default function Annex() {
  const [loaded, setLoaded] = useState(false);

  return (
    <AppShell activeKey="annex" title="Annex Portal">
      <Card className="flex flex-col h-[calc(100vh-8.5rem)] sm:h-[calc(100vh-11rem)] overflow-hidden p-0">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-brd px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-bold text-ink">Annex Portal</p>
            <p className="truncate text-xs text-ink-3">BUBT results, routine &amp; attendance — sign in with your own portal account.</p>
          </div>
          <a
            href={ANNEX_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-brd px-3 py-1.5 text-sm font-semibold text-ink-2 hover:bg-surface-2"
          >
            <ExternalLink size={14} /> Open in new tab
          </a>
        </div>
        <div className="relative flex-1">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface">
              <Spinner size={26} />
            </div>
          )}
          <iframe
            title="BUBT Annex Portal"
            src={ANNEX_URL}
            onLoad={() => setLoaded(true)}
            className="h-full w-full border-0"
          />
        </div>
      </Card>
    </AppShell>
  );
}
