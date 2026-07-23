import React, { useEffect, useRef, useState } from "react";
import { FileOutput, Scissors } from "lucide-react";
import { Button, Input, useToast } from "../../components/ui.jsx";
import { downloadBlob, baseName } from "../../lib/download.js";
import {
  DropZone, ThumbGrid, ThumbCard, ProgressPanel, ResultPanel,
  Notice, PrivacyNote, moveItem,
} from "./components.jsx";
import { usePdfWorker } from "./usePdfWorker.js";
import { LIMITS, THUMB_MAX_DIM, errorText, isPdf } from "./presets.js";
import { loadPdf, renderThumb, yieldToUi } from "./pdfRender.js";

// ============================================================================
// Organize — reorder, rotate, delete and extract pages.
// Every operation here is METADATA-level (pdf-lib copyPages + setRotation), so
// the output is lossless: text stays selectable and the file doesn't grow.
// ============================================================================

export default function ToolOrganize() {
  const toast = useToast();
  const { run } = usePdfWorker();
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]); // { orig, url, rotate, keep }
  const [loading, setLoading] = useState(null); // { done, total }
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [range, setRange] = useState("");
  const urlsRef = useRef(new Set());

  useEffect(() => () => { urlsRef.current.forEach((u) => URL.revokeObjectURL(u)); urlsRef.current.clear(); }, []);

  async function open(files) {
    const picked = files[0];
    if (!picked) return;
    if (!isPdf(picked)) {
      toast({ type: "error", title: "PDFs only", message: "Pick a PDF file to organize." });
      return;
    }
    if (picked.size > LIMITS.organize.maxBytes) {
      toast({ type: "error", title: "File too large", message: "PDFs up to 50 MB can be organized in the browser." });
      return;
    }

    reset();
    setFile(picked);
    setLoading({ done: 0, total: 0 });
    try {
      const buf = await picked.arrayBuffer();
      const pdf = await loadPdf(buf);
      if (pdf.numPages > LIMITS.organize.maxPages) {
        toast({ type: "error", title: "Too many pages", message: `Up to ${LIMITS.organize.maxPages} pages can be organized at once.` });
        setFile(null);
        setLoading(null);
        return;
      }

      setLoading({ done: 0, total: pdf.numPages });
      const next = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const { blob } = await renderThumb(pdf, n, THUMB_MAX_DIM);
        const url = URL.createObjectURL(blob);
        urlsRef.current.add(url);
        next.push({ orig: n - 1, url, rotate: 0, keep: true });
        // Paint each thumbnail as it lands instead of freezing until the last.
        setPages(next.slice());
        setLoading({ done: n, total: pdf.numPages });
        await yieldToUi();
      }
      pdf.destroy();
    } catch (err) {
      toast({ type: "error", title: "Couldn't open this PDF", message: errorText(err?.code) });
      setFile(null);
      setPages([]);
    } finally {
      setLoading(null);
    }
  }

  function reset() {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current.clear();
    setPages([]);
    setResult(null);
    setRange("");
    setFile(null);
  }

  const update = (fn) => { setPages(fn); setResult(null); };
  const moveTo = (from, to) => update((prev) => moveItem(prev, from, to));
  const rotateAt = (i) => update((prev) => prev.map((p, n) => (n === i ? { ...p, rotate: (p.rotate + 90) % 360 } : p)));
  const toggleAt = (i) => update((prev) => prev.map((p, n) => (n === i ? { ...p, keep: !p.keep } : p)));

  // "1-3,7" -> keep only those pages, numbered as in the ORIGINAL document —
  // which is what each tile's "Page N" caption shows, so reordering first
  // doesn't silently change what the range means.
  function applyRange() {
    const wanted = parseRanges(range, pages.length);
    if (!wanted) {
      toast({ type: "error", title: "Couldn't read that range", message: "Use page numbers like 1-3,7 — up to " + pages.length + "." });
      return;
    }
    update((prev) => prev.map((p) => ({ ...p, keep: wanted.has(p.orig + 1) })));
    toast({ type: "success", title: `Keeping ${wanted.size} page${wanted.size === 1 ? "" : "s"}` });
  }

  async function build() {
    const kept = pages.filter((p) => p.keep);
    if (!kept.length) {
      toast({ type: "error", title: "No pages left", message: "Keep at least one page." });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const order = kept.map((p) => p.orig);
      const rotates = {};
      kept.forEach((p) => { if (p.rotate) rotates[p.orig] = p.rotate; });
      const out = await run("organize", { buf, order, rotates }, { transfer: [buf] });
      setResult({ blob: out.blob, bytes: out.bytes, pages: out.pages });
    } catch (err) {
      if (err?.code !== "cancelled") toast({ type: "error", title: "Couldn't rebuild the PDF", message: errorText(err?.code) });
    } finally {
      setBusy(false);
    }
  }

  const download = () => {
    downloadBlob(`${baseName(file?.name)}-organized.pdf`, result.blob);
    toast({ type: "success", title: "PDF saved" });
  };

  if (!file) {
    return (
      <div className="flex flex-col gap-3">
        <DropZone accept="application/pdf" onFiles={open} title="Open a PDF" hint="Tap to choose a PDF, or drag it here. Up to 50 MB / 200 pages." />
        <PrivacyNote />
      </div>
    );
  }

  const keptCount = pages.filter((p) => p.keep).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={reset}>Choose another PDF</Button>
        <span className="ml-auto text-base text-ink-2">{keptCount} of {pages.length} page{pages.length === 1 ? "" : "s"} kept</span>
      </div>

      {loading && <ProgressPanel label="Reading pages…" done={loading.done} total={loading.total} />}

      {pages.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <label htmlFor="pdf-range" className="mb-1 block text-base font-bold text-ink">Keep only these pages</label>
            <Input
              id="pdf-range"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              placeholder="e.g. 1-3,7"
              inputMode="numeric"
            />
          </div>
          <Button variant="secondary" icon={Scissors} onClick={applyRange} disabled={!range.trim()}>Apply</Button>
        </div>
      )}

      <ThumbGrid>
        {pages.map((p, i) => (
          <ThumbCard
            key={p.orig}
            src={p.url}
            index={i}
            total={pages.length}
            rotate={p.rotate}
            caption={`Page ${p.orig + 1}${p.keep ? "" : " · removed"}`}
            dimmed={!p.keep}
            selected={p.keep}
            onToggle={() => toggleAt(i)}
            onFirst={() => moveTo(i, 0)}
            onPrev={() => moveTo(i, i - 1)}
            onNext={() => moveTo(i, i + 1)}
            onRotate={() => rotateAt(i)}
          />
        ))}
      </ThumbGrid>

      {pages.length > 0 && (
        <Notice tone="info">
          Rotating and reordering here doesn't re-encode anything — the text in your PDF stays selectable and the file size barely changes.
        </Notice>
      )}

      {busy && <ProgressPanel label="Rebuilding…" done={0} total={0} />}

      {result ? (
        <ResultPanel
          title="PDF ready"
          bytesAfter={result.bytes}
          pages={result.pages}
          onDownload={download}
          onReset={reset}
        />
      ) : (
        !busy && !loading && pages.length > 0 && (
          <div>
            <Button icon={FileOutput} onClick={build}>Save {keptCount} page{keptCount === 1 ? "" : "s"}</Button>
          </div>
        )
      )}
      <PrivacyNote />
    </div>
  );
}

// "1-3,7" -> Set{1,2,3,7}. Returns null if the text isn't a usable range.
function parseRanges(text, max) {
  const out = new Set();
  for (const chunk of String(text).split(",")) {
    const part = chunk.trim();
    if (!part) continue;
    const m = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(part);
    if (!m) return null;
    const from = parseInt(m[1], 10);
    const to = m[2] ? parseInt(m[2], 10) : from;
    if (!from || from > max || to > max || to < from) return null;
    for (let n = from; n <= to; n++) out.add(n);
  }
  return out.size ? out : null;
}
