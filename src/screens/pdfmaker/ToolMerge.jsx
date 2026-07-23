import React, { useCallback, useRef, useState } from "react";
import { FileOutput } from "lucide-react";
import { Button, useToast } from "../../components/ui.jsx";
import { downloadBlob, baseName } from "../../lib/download.js";
import {
  DropZone, AddFilesButton, FileRow, ProgressPanel, ResultPanel,
  Notice, PrivacyNote, moveItem,
} from "./components.jsx";
import { usePdfWorker } from "./usePdfWorker.js";
import { IMAGE_PRESETS, DEFAULT_PRESET, LIMITS, errorText, isHeic, isImage, isPdf } from "./presets.js";

// ============================================================================
// Merge — PDFs and photos into one file, in the order the student arranges.
// PDF pages are COPIED (lossless: text stays selectable, nothing re-encoded);
// photos are rasterised onto A4 pages like the Photos-to-PDF tool.
// ============================================================================

let seq = 0;

export default function ToolMerge() {
  const toast = useToast();
  const { run, cancel } = usePdfWorker();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);
  // Mirrors `items` so the cap check doesn't need `items` in the callback deps.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const addFiles = useCallback((files) => {
    const accepted = [];
    let badType = 0;
    let tooBig = 0;
    let heic = 0;

    for (const file of files) {
      if (isHeic(file)) { heic++; continue; }
      const pdf = isPdf(file);
      if (!pdf && !isImage(file)) { badType++; continue; }
      if (file.size > LIMITS.merge.maxBytes) { tooBig++; continue; }
      accepted.push({ id: ++seq, file, name: file.name, size: file.size, kind: pdf ? "pdf" : "image" });
    }

    if (heic) toast({ type: "error", title: "HEIC photos not supported", message: errorText("heic") });
    else if (badType) toast({ type: "error", title: "Unsupported file", message: "Only PDFs and images can be merged." });
    if (tooBig) toast({ type: "error", title: "File too large", message: `${tooBig} file${tooBig === 1 ? " was" : "s were"} skipped — over 50 MB each.` });

    // Toasts stay out of the state updater — StrictMode invokes updaters twice
    // in development and would fire every message a second time.
    const room = LIMITS.merge.maxFiles - itemsRef.current.length;
    if (room <= 0) {
      toast({ type: "error", title: "Too many files", message: `You can merge up to ${LIMITS.merge.maxFiles} files at once.` });
      return;
    }
    if (accepted.length > room) {
      toast({ type: "error", title: "Some files skipped", message: `Only the first ${room} were added (limit ${LIMITS.merge.maxFiles}).` });
    }
    const added = accepted.slice(0, room);
    if (!added.length) return;
    setItems((prev) => prev.concat(added));
    setResult(null);
  }, [toast]);

  const update = (fn) => { setItems(fn); setResult(null); };
  const moveTo = (from, to) => update((prev) => moveItem(prev, from, to));
  const removeAt = (i) => update((prev) => prev.filter((_, n) => n !== i));
  const reset = () => { setItems([]); setResult(null); };

  async function merge() {
    if (items.length < 2) {
      toast({ type: "error", title: "Add another file", message: "Pick at least two files to merge." });
      return;
    }
    setBusy(true);
    setResult(null);
    setProgress({ done: 0, total: items.length });
    try {
      const files = [];
      const transfer = [];
      for (const it of items) {
        const buf = await it.file.arrayBuffer();
        files.push({ buf, kind: it.kind, mime: it.file.type, name: it.name, rotate: 0 });
        transfer.push(buf);
      }
      const out = await run(
        "merge",
        { files, preset: IMAGE_PRESETS[DEFAULT_PRESET] },
        { transfer, onProgress: (p) => setProgress({ done: p.done, total: p.total }) }
      );
      setResult({ blob: out.blob, bytes: out.bytes, pages: out.pages });
    } catch (err) {
      if (err?.code === "cancelled") return;
      // The worker names the file it choked on — much more useful than a
      // generic failure when you've queued up ten of them.
      toast({
        type: "error",
        title: err?.detail ? `Couldn't read ${err.detail}` : "Couldn't merge",
        message: errorText(err?.code),
      });
    } finally {
      setBusy(false);
    }
  }

  const download = () => {
    downloadBlob(`${baseName(items[0]?.name) || "merged"}-merged.pdf`, result.blob);
    toast({ type: "success", title: "PDF saved" });
  };

  if (!items.length) {
    return (
      <div className="flex flex-col gap-3">
        <DropZone
          accept="application/pdf,image/*"
          multiple
          onFiles={addFiles}
          title="Add PDFs to merge"
          hint="Tap to choose files, or drag them here. You can mix in photos — they'll become A4 pages."
        />
        <PrivacyNote />
      </div>
    );
  }

  const totalBytes = items.reduce((n, it) => n + it.size, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <AddFilesButton accept="application/pdf,image/*" onFiles={addFiles}>Add more</AddFilesButton>
        <Button variant="ghost" onClick={reset}>Clear all</Button>
        <span className="ml-auto text-base text-ink-2">{items.length} file{items.length === 1 ? "" : "s"}</span>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((it, i) => (
          <FileRow
            key={it.id}
            file={it}
            index={i}
            total={items.length}
            note={it.kind === "image" ? "becomes an A4 page" : null}
            onFirst={() => moveTo(i, 0)}
            onPrev={() => moveTo(i, i - 1)}
            onNext={() => moveTo(i, i + 1)}
            onRemove={() => removeAt(i)}
          />
        ))}
      </div>

      <Notice tone="info">
        Files are joined top to bottom in the order above. PDF pages are copied as-is, so their text stays selectable.
      </Notice>

      {busy && <ProgressPanel label="Merging…" done={progress.done} total={progress.total} onCancel={cancel} />}

      {result ? (
        <ResultPanel
          title="Merged PDF ready"
          bytesBefore={totalBytes}
          bytesAfter={result.bytes}
          pages={result.pages}
          onDownload={download}
          onReset={reset}
        />
      ) : (
        !busy && (
          <div>
            <Button icon={FileOutput} onClick={merge}>Merge {items.length} files</Button>
          </div>
        )
      )}
      <PrivacyNote />
    </div>
  );
}
