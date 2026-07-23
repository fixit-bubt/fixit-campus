import React, { useEffect, useRef, useState } from "react";
import { FileArchive, FileText } from "lucide-react";
import { Button, Card, useToast } from "../../components/ui.jsx";
import { SegmentToggle } from "../../components/featureKit.jsx";
import { downloadBlob, baseName, fmtBytes } from "../../lib/download.js";
import { DropZone, ProgressPanel, ResultPanel, Notice, PrivacyNote } from "./components.jsx";
import { usePdfWorker } from "./usePdfWorker.js";
import {
  COMPRESS_TARGETS, COMPRESS_DPI_SCALE, MAX_COMPRESS_PASSES, MIN_QUALITY, MIN_LONG_EDGE,
  LIMITS, TEXT_HEAVY_CHARS_PER_PAGE, TEXT_SAMPLE_PAGES, errorText, isPdf,
} from "./presets.js";
import { loadPdf, renderPageToJpeg, sampleTextiness, yieldToUi } from "./pdfRender.js";

// ============================================================================
// Compress — rebuild a PDF with every page re-encoded as a JPEG.
//
// Honest about the trade-off: this is a RASTER compressor. It works well on
// scans (whose pages are already images) and badly on text documents, where
// server tools like iLovePDF win by keeping text as vectors. Two guards keep
// that from becoming a nasty surprise:
//   1. a text-heavy PDF triggers a warning before anything runs, and
//   2. a result that isn't actually smaller is discarded rather than offered.
// ============================================================================

const MODE_QUALITY = "quality";

export default function ToolCompress() {
  const toast = useToast();
  const { run } = usePdfWorker();
  const [file, setFile] = useState(null);
  const [doc, setDoc] = useState(null); // { pdf, pages, texty }
  const [mode, setMode] = useState("2mb");
  const [quality, setQuality] = useState(0.6);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, pass: 1 });
  const [result, setResult] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const cancelRef = useRef(false);
  const docRef = useRef(null);

  // pdf.js holds decoded page data; destroy the document when we're done with it.
  useEffect(() => () => { docRef.current?.destroy?.(); docRef.current = null; }, []);

  async function open(files) {
    const picked = files[0];
    if (!picked) return;
    if (!isPdf(picked)) {
      toast({ type: "error", title: "PDFs only", message: "Pick a PDF file to compress." });
      return;
    }
    if (picked.size > LIMITS.compress.maxBytes) {
      toast({ type: "error", title: "File too large", message: "PDFs up to 50 MB can be compressed in the browser." });
      return;
    }

    clear();
    try {
      const buf = await picked.arrayBuffer();
      const pdf = await loadPdf(buf);
      if (pdf.numPages > LIMITS.compress.maxPages) {
        toast({ type: "error", title: "Too many pages", message: `Up to ${LIMITS.compress.maxPages} pages can be compressed at once.` });
        pdf.destroy();
        return;
      }
      const chars = await sampleTextiness(pdf, TEXT_SAMPLE_PAGES);
      docRef.current = pdf;
      setDoc({ pdf, pages: pdf.numPages, texty: chars > TEXT_HEAVY_CHARS_PER_PAGE });
      setFile(picked);
    } catch (err) {
      toast({ type: "error", title: "Couldn't open this PDF", message: errorText(err?.code) });
    }
  }

  function clear() {
    docRef.current?.destroy?.();
    docRef.current = null;
    setDoc(null);
    setFile(null);
    setResult(null);
    setAcknowledged(false);
    cancelRef.current = false;
  }

  // Render every page at (longEdge, quality) and assemble. Returns the built
  // PDF plus its size, or throws { code: "cancelled" }.
  async function onePass(pdf, longEdge, q, passNo) {
    const pages = [];
    const transfer = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      if (cancelRef.current) throw Object.assign(new Error("cancelled"), { code: "cancelled" });
      setProgress({ done: n - 1, total: pdf.numPages, pass: passNo });
      const { buf, wPt, hPt } = await renderPageToJpeg(pdf, n, { longEdge, quality: q });
      pages.push({ buf, wPt, hPt });
      transfer.push(buf);
      // Let the progress bar and Cancel button stay responsive between pages.
      await yieldToUi();
    }
    setProgress({ done: pdf.numPages, total: pdf.numPages, pass: passNo });
    return run("assemble-pages", { pages }, { transfer });
  }

  async function compress() {
    if (!doc) return;
    setBusy(true);
    setResult(null);
    cancelRef.current = false;

    const before = file.size;
    const target = COMPRESS_TARGETS[mode];

    try {
      let longEdge = COMPRESS_DPI_SCALE;
      let q = mode === MODE_QUALITY ? quality : target.quality;
      let best = null;

      const passes = mode === MODE_QUALITY ? 1 : MAX_COMPRESS_PASSES;
      for (let pass = 1; pass <= passes; pass++) {
        const out = await onePass(doc.pdf, longEdge, q, pass);
        if (!best || out.bytes < best.bytes) best = out;
        if (mode === MODE_QUALITY || out.bytes <= target.bytes) break;
        if (pass === passes) break;

        // Walk quality down toward the target, and start shrinking the raster
        // only once quality has bottomed out — dropping resolution hurts
        // legibility more than JPEG artefacts do.
        const ratio = target.bytes / out.bytes;
        const nextQ = Math.max(MIN_QUALITY, Math.min(q, q * Math.pow(ratio, 0.9)));
        if (nextQ <= MIN_QUALITY + 0.001 && q <= MIN_QUALITY + 0.001) {
          longEdge = Math.max(MIN_LONG_EDGE, Math.round(longEdge * Math.sqrt(ratio)));
        }
        q = nextQ;
      }

      // Guard: rasterising a text page costs far more than the vector text it
      // replaces, so "compressing" can inflate a file. Never hand that back.
      if (best.bytes >= before) {
        setResult({ noGain: true });
        toast({ type: "error", title: "Already optimized", message: errorText("already-optimized") });
        return;
      }

      const missed = mode !== MODE_QUALITY && best.bytes > target.bytes * 1.1;
      setResult({
        blob: best.blob,
        bytes: best.bytes,
        pages: best.pages,
        warning: missed
          ? `Couldn't get below ${target.label.replace("≤ ", "")} — this is the smallest usable result at ${fmtBytes(best.bytes)}.`
          : null,
      });
    } catch (err) {
      if (err?.code !== "cancelled") toast({ type: "error", title: "Couldn't compress", message: errorText(err?.code) });
    } finally {
      setBusy(false);
    }
  }

  const download = () => {
    downloadBlob(`${baseName(file?.name)}-compressed.pdf`, result.blob);
    toast({ type: "success", title: "PDF saved" });
  };

  if (!file || !doc) {
    return (
      <div className="flex flex-col gap-3">
        <DropZone accept="application/pdf" onFiles={open} title="Open a PDF" hint="Tap to choose a PDF, or drag it here. Up to 50 MB / 150 pages." />
        <Notice tone="info">
          Works best on scanned documents and photo-heavy PDFs. Text-only files are usually already as small as they can get.
        </Notice>
        <PrivacyNote />
      </div>
    );
  }

  const needsAck = doc.texty && !acknowledged;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex min-w-0 items-center gap-3 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-ink-2">
          <FileText size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-ink">{file.name}</p>
          <p className="text-sm text-ink-3">{fmtBytes(file.size)} · {doc.pages} page{doc.pages === 1 ? "" : "s"}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={clear}>Change</Button>
      </Card>

      {doc.texty && (
        <Notice tone="warn">
          <p className="font-bold">This PDF is mostly text, not scans.</p>
          <p className="mt-0.5">
            Compressing turns each page into an image: the text will look softer, stop being selectable or searchable, and the
            file may not shrink at all. If it's a Word or Google Docs export, it's probably already as small as it gets.
          </p>
          {needsAck && (
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => setAcknowledged(true)}>
              I understand — continue
            </Button>
          )}
        </Notice>
      )}

      <div>
        <p className="mb-1.5 text-base font-bold text-ink">Target size</p>
        <SegmentToggle
          value={mode}
          onChange={(v) => { setMode(v); setResult(null); }}
          options={[
            ...Object.values(COMPRESS_TARGETS).map((t) => ({ value: t.key, label: t.label })),
            { value: MODE_QUALITY, label: "Custom" },
          ]}
        />
        {mode === MODE_QUALITY && (
          <div className="mt-3 max-w-sm">
            <label htmlFor="pdf-quality" className="mb-1 block text-base text-ink-2">
              Image quality — {Math.round(quality * 100)}%
            </label>
            <input
              id="pdf-quality"
              type="range"
              min="30"
              max="90"
              step="5"
              value={Math.round(quality * 100)}
              onChange={(e) => { setQuality(Number(e.target.value) / 100); setResult(null); }}
              className="w-full accent-brand"
            />
            <p className="text-sm text-ink-3">Lower quality means a smaller file.</p>
          </div>
        )}
      </div>

      {!busy && !result && (
        <Notice tone="warn">
          Pages become images, so text in the compressed PDF can no longer be selected, copied or searched.
        </Notice>
      )}

      {busy && (
        <ProgressPanel
          label={progress.pass > 1 ? `Compressing… (attempt ${progress.pass})` : "Compressing…"}
          done={progress.done}
          total={progress.total}
          onCancel={() => { cancelRef.current = true; }}
        />
      )}

      {result?.noGain && (
        <Notice tone="warn">
          {errorText("already-optimized")}
        </Notice>
      )}

      {result && !result.noGain ? (
        <ResultPanel
          title="Compressed PDF ready"
          bytesBefore={file.size}
          bytesAfter={result.bytes}
          pages={result.pages}
          warning={result.warning}
          onDownload={download}
          onReset={clear}
        />
      ) : (
        !busy && (
          <div>
            <Button icon={FileArchive} onClick={compress} disabled={needsAck}>
              Compress PDF
            </Button>
          </div>
        )
      )}
      <PrivacyNote />
    </div>
  );
}
