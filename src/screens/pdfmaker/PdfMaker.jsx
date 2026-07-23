import React from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { navigate, Link } from "../../lib/router.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { Card } from "../../components/ui.jsx";
import { AccentTile } from "../../components/featureKit.jsx";
import { Notice } from "./components.jsx";
import { isBrowserSupported } from "./pdfRender.js";
import { errorText } from "./presets.js";
import ToolImages from "./ToolImages.jsx";
import ToolMerge from "./ToolMerge.jsx";
import ToolOrganize from "./ToolOrganize.jsx";
import ToolCompress from "./ToolCompress.jsx";

// ============================================================================
// PDF Maker — four client-side PDF tools for assignment submission.
//
// The whole screen is code-split (React.lazy in App.jsx) because pdf-lib and
// pdf.js together are ~500KB gzipped; nothing here loads until a student opens
// the feature. No database, no Supabase, no uploads — same shape as the CGPA
// calculator: it's a pure browser utility.
// ============================================================================

const TOOLS = {
  images: {
    key: "images",
    label: "Photos to PDF",
    icon: "Images",
    blurb: "Turn photos of handwritten pages into one A4 PDF.",
    Component: ToolImages,
  },
  merge: {
    key: "merge",
    label: "Merge PDFs",
    icon: "FileStack",
    blurb: "Combine several PDFs (and photos) into a single file.",
    Component: ToolMerge,
  },
  organize: {
    key: "organize",
    label: "Organize pages",
    icon: "LayoutGrid",
    blurb: "Reorder, rotate, delete or extract pages from a PDF.",
    Component: ToolOrganize,
  },
  compress: {
    key: "compress",
    label: "Compress PDF",
    icon: "FileArchive",
    blurb: "Shrink a scanned PDF to fit an upload size limit.",
    Component: ToolCompress,
  },
};
const TOOL_ORDER = ["images", "merge", "organize", "compress"];

export default function PdfMaker({ tool }) {
  const active = tool ? TOOLS[tool] : null;
  const supported = isBrowserSupported();

  return (
    <AppShell activeKey="pdf-maker" title="PDF Maker">
      {active ? (
        <Link to="/pdf-maker" className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
          <ArrowLeft size={16} /> PDF Maker
        </Link>
      ) : (
        <button onClick={() => navigate("/dashboard")} className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-ink-3 hover:text-ink-2">
          <ArrowLeft size={16} /> Dashboard
        </button>
      )}

      {!supported ? (
        <>
          <PageHeader title="PDF Maker" />
          <Notice tone="danger">{errorText("browser-unsupported")}</Notice>
        </>
      ) : active ? (
        <>
          <PageHeader title={active.label} subtitle={active.blurb} />
          <active.Component />
        </>
      ) : (
        <Landing />
      )}
    </AppShell>
  );
}

function Landing() {
  return (
    <>
      <PageHeader
        title="PDF Maker"
        subtitle="Prepare assignment submissions without leaving FixIt — everything runs in your browser, so your files never leave your device."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {TOOL_ORDER.map((key) => {
          const t = TOOLS[key];
          return (
            <Link key={key} to={`/pdf-maker/${key}`} className="block">
              <Card className="flex min-w-0 items-center gap-3 p-4 transition-colors hover:bg-surface-2">
                <AccentTile icon={t.icon} tone="pdfmaker" size={44} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-ink">{t.label}</p>
                  <p className="text-base text-ink-2">{t.blurb}</p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-ink-3" />
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
