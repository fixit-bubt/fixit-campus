import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, FileOutput } from "lucide-react";
import { Button, useToast } from "../../components/ui.jsx";
import { SegmentToggle } from "../../components/featureKit.jsx";
import { downloadBlob, baseName } from "../../lib/download.js";
import {
  DropZone, AddFilesButton, ThumbGrid, ThumbCard, ProgressPanel, ResultPanel,
  Notice, PrivacyNote, moveItem,
} from "./components.jsx";
import { usePdfWorker } from "./usePdfWorker.js";
import { IMAGE_PRESETS, DEFAULT_PRESET, LIMITS, errorText, isHeic, isImage } from "./presets.js";

// ============================================================================
// Photos -> PDF. The core student workflow: snap the pages of a handwritten
// assignment, order them, get one A4 PDF.
// ============================================================================

let seq = 0;

export default function ToolImages() {
  const toast = useToast();
  const { run, cancel } = usePdfWorker();
  const [items, setItems] = useState([]);
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);
  const urlsRef = useRef(new Set());
  // Mirrors `items` so addFiles can check the cap without depending on state
  // (which would make the callback stale between renders).
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const trackUrl = (url) => { urlsRef.current.add(url); return url; };
  const dropUrl = (url) => { URL.revokeObjectURL(url); urlsRef.current.delete(url); };

  // Revoke every preview URL when the tool unmounts, otherwise 40 full-size
  // photos stay pinned in memory for the rest of the session.
  useEffect(() => () => { urlsRef.current.forEach((u) => URL.revokeObjectURL(u)); urlsRef.current.clear(); }, []);

  // Validation and object-URL creation happen OUTSIDE the state updater:
  // React StrictMode runs updaters twice in development, which would otherwise
  // double every toast and leak a duplicate preview URL per photo.
  const addFiles = useCallback((files) => {
    const accepted = [];
    let rejectedHeic = 0;
    let rejectedType = 0;
    let rejectedSize = 0;

    for (const file of files) {
      if (isHeic(file)) { rejectedHeic++; continue; }
      if (!isImage(file)) { rejectedType++; continue; }
      if (file.size > LIMITS.images.maxBytes) { rejectedSize++; continue; }
      accepted.push(file);
    }

    if (rejectedHeic) toast({ type: "error", title: "HEIC photos not supported", message: errorText("heic") });
    else if (rejectedType) toast({ type: "error", title: "Images only", message: "Only image files can be added here." });
    if (rejectedSize) {
      toast({ type: "error", title: "Photo too large", message: `${rejectedSize} photo${rejectedSize === 1 ? " was" : "s were"} skipped — over 25 MB each.` });
    }

    const room = LIMITS.images.maxFiles - itemsRef.current.length;
    if (room <= 0) {
      toast({ type: "error", title: "Too many photos", message: `You can add up to ${LIMITS.images.maxFiles} at a time.` });
      return;
    }
    if (accepted.length > room) {
      toast({ type: "error", title: "Some photos skipped", message: `Only the first ${room} were added (limit ${LIMITS.images.maxFiles}).` });
    }

    const added = accepted.slice(0, room).map((file) => ({
      id: ++seq, file, url: trackUrl(URL.createObjectURL(file)), rotate: 0,
    }));
    if (!added.length) return;
    setItems((prev) => prev.concat(added));
    setResult(null);
  }, [toast]);

  const update = (fn) => { setItems(fn); setResult(null); };
  // Revoke outside the state updater: React StrictMode invokes updaters twice
  // in development, and side effects don't belong in them.
  const removeAt = (i) => {
    const gone = items[i];
    if (gone) dropUrl(gone.url);
    update((prev) => prev.filter((_, n) => n !== i));
  };
  const rotateAt = (i) => update((prev) => prev.map((it, n) => (n === i ? { ...it, rotate: (it.rotate + 90) % 360 } : it)));
  const moveTo = (from, to) => update((prev) => moveItem(prev, from, to));

  const reset = () => {
    items.forEach((it) => dropUrl(it.url));
    setItems([]);
    setResult(null);
  };

  async function generate() {
    if (!items.length) return;
    setBusy(true);
    setResult(null);
    setProgress({ done: 0, total: items.length });
    try {
      // Read the files fresh here: the buffers are TRANSFERRED to the worker
      // (detached), so they can't be cached across runs.
      const images = [];
      const transfer = [];
      for (const it of items) {
        const buf = await it.file.arrayBuffer();
        images.push({ buf, mime: it.file.type, rotate: it.rotate });
        transfer.push(buf);
      }
      const out = await run(
        "images-to-pdf",
        { images, preset: IMAGE_PRESETS[preset] },
        { transfer, onProgress: (p) => setProgress({ done: p.done, total: p.total }) }
      );
      setResult({ blob: out.blob, bytes: out.bytes, pages: out.pages });
    } catch (err) {
      if (err?.code !== "cancelled") toast({ type: "error", title: "Couldn't create the PDF", message: errorText(err?.code) });
    } finally {
      setBusy(false);
    }
  }

  const download = () => {
    downloadBlob(`${baseName(items[0]?.file?.name) || "photos"}.pdf`, result.blob);
    toast({ type: "success", title: "PDF saved" });
  };

  if (!items.length) {
    return (
      <div className="flex flex-col gap-3">
        <DropZone
          accept="image/*"
          multiple
          onFiles={addFiles}
          title="Add photos"
          hint="Tap to choose photos, or drag them here. JPG, PNG or WebP — up to 40 at once."
        />
        <div className="flex flex-wrap gap-2">
          <AddFilesButton accept="image/*" capture="environment" onFiles={addFiles} icon={Camera} multiple={false}>
            Use camera
          </AddFilesButton>
        </div>
        <Notice tone="info">
          Photos are placed one per A4 page, scaled to fit. Take shots straight-on in good light for the cleanest result.
        </Notice>
        <PrivacyNote />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <AddFilesButton accept="image/*" onFiles={addFiles}>Add more</AddFilesButton>
        <AddFilesButton accept="image/*" capture="environment" onFiles={addFiles} icon={Camera} multiple={false}>
          Camera
        </AddFilesButton>
        <Button variant="ghost" onClick={reset}>Clear all</Button>
        <span className="ml-auto text-base text-ink-2">{items.length} photo{items.length === 1 ? "" : "s"}</span>
      </div>

      <div>
        <p className="mb-1.5 text-base font-bold text-ink">Quality</p>
        <SegmentToggle
          value={preset}
          onChange={(v) => { setPreset(v); setResult(null); }}
          options={Object.values(IMAGE_PRESETS).map((p) => ({ value: p.key, label: p.label }))}
        />
        <p className="mt-1.5 text-sm text-ink-3">{IMAGE_PRESETS[preset].hint} · smaller files upload faster on mobile data.</p>
      </div>

      <ThumbGrid>
        {items.map((it, i) => (
          <ThumbCard
            key={it.id}
            src={it.url}
            index={i}
            total={items.length}
            rotate={it.rotate}
            caption={it.file.name}
            onFirst={() => moveTo(i, 0)}
            onPrev={() => moveTo(i, i - 1)}
            onNext={() => moveTo(i, i + 1)}
            onRotate={() => rotateAt(i)}
            onRemove={() => removeAt(i)}
          />
        ))}
      </ThumbGrid>

      {busy && <ProgressPanel label="Building your PDF…" done={progress.done} total={progress.total} onCancel={cancel} />}

      {result ? (
        <ResultPanel
          title="PDF ready"
          bytesAfter={result.bytes}
          pages={result.pages}
          onDownload={download}
          onReset={reset}
        />
      ) : (
        !busy && (
          <div>
            <Button icon={FileOutput} onClick={generate}>Create PDF</Button>
          </div>
        )
      )}
      <PrivacyNote />
    </div>
  );
}
