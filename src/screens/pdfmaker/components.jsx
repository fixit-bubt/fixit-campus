import React, { useRef, useState } from "react";
import {
  Upload, X, RotateCw, ChevronLeft, ChevronRight, ChevronsLeft,
  Download, RefreshCw, FileText, Image as ImageIcon, TriangleAlert, Info,
} from "lucide-react";
import { Button, Card } from "../../components/ui.jsx";
import { fmtBytes } from "../../lib/download.js";

// ============================================================================
// Shared building blocks for the four PDF Maker tools.
// ============================================================================

// ---------------------------------------------------------------------------
// DropZone — click or drag-and-drop file picker.
// The app's <FileUpload> is image-only with a hard 5MB cap, so the tools use
// this instead (same pattern as the raw file inputs in Jobs/Routines).
// ---------------------------------------------------------------------------
export function DropZone({ accept, multiple = false, onFiles, title, hint, capture }) {
  const [over, setOver] = useState(false);

  const take = (list) => {
    const files = Array.from(list || []);
    if (files.length) onFiles(files);
  };

  // A <label> wrapping the input, NOT a div with onClick={() => input.click()}:
  // the programmatic click bubbles back to that same handler and re-enters the
  // picker, whereas the label opens it natively exactly once.
  //
  // Drag & drop needs three things that are easy to miss:
  //   1. BOTH dragenter and dragover must be cancelled or the browser refuses
  //      the drop and just opens the file in the tab.
  //   2. dropEffect must say "copy", otherwise the cursor shows "no entry".
  //   3. The children must be pointer-events-none. Without it the icon and text
  //      become their own drag targets, so dragleave fires the moment the
  //      cursor crosses onto them and the drop can land on a child instead of
  //      here — which is exactly why dropping did nothing.
  return (
    <label
      onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (!over) setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        // brand/warn/danger are var() tokens, which Tailwind can't alpha-modify
        // (bg-brand/10 silently produces nothing) — stick to solid tokens.
        over ? "border-brand bg-brand-50 dark:bg-surface-3" : "border-brd bg-surface-2 hover:border-brand hover:bg-surface-3"
      }`}
    >
      <span className="pointer-events-none flex flex-col items-center gap-2">
        <Upload size={26} className="text-ink-3" />
        <span className="text-lg font-bold text-ink">{title}</span>
        {hint && <span className="max-w-sm text-base text-ink-2">{hint}</span>}
      </span>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        capture={capture}
        className="hidden"
        onChange={(e) => { take(e.target.files); e.target.value = ""; }}
      />
    </label>
  );
}

// A plain "add more" button wrapping a hidden input.
export function AddFilesButton({ accept, multiple = true, onFiles, capture, children, variant = "secondary", icon = "Plus" }) {
  const inputRef = useRef(null);
  return (
    <>
      <Button variant={variant} icon={icon} onClick={() => inputRef.current?.click()}>{children}</Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        capture={capture}
        className="hidden"
        onChange={(e) => { const f = Array.from(e.target.files || []); if (f.length) onFiles(f); e.target.value = ""; }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// ThumbCard / ThumbGrid — reorderable tiles.
// Arrow buttons rather than drag-and-drop: HTML5 drag doesn't work on touch
// without a polyfill, and most students are on phones.
// ---------------------------------------------------------------------------
export function ThumbGrid({ children }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{children}</div>
  );
}

export function ThumbCard({
  src, label, caption, index, total, rotate = 0,
  onFirst, onPrev, onNext, onRotate, onRemove, selected, onToggle, dimmed,
}) {
  return (
    // min-w-0 on the GRID ITEM (not just the inner div): without it the card's
    // min-content width can push the whole page wider than a phone screen.
    <Card className={`flex min-w-0 flex-col overflow-hidden p-0 ${dimmed ? "opacity-40" : ""}`}>
      <div className="relative flex h-36 items-center justify-center bg-surface-3">
        {src ? (
          // The image sits in a SQUARE box: anything that fits a square still
          // fits it after a 90° turn, so rotated previews don't get clipped.
          <span className="flex aspect-square h-full items-center justify-center">
            <img
              src={src}
              alt={label}
              className="max-h-full max-w-full object-contain transition-transform"
              style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined }}
            />
          </span>
        ) : (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink-3 border-r-transparent" />
        )}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/65 px-2 py-0.5 text-xs font-bold text-white">
          {index + 1}
        </span>
        {onRemove && (
          <button
            onClick={onRemove}
            aria-label="Remove"
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white hover:bg-danger"
          >
            <X size={14} />
          </button>
        )}
        {onToggle && (
          <button
            onClick={onToggle}
            aria-label={selected ? "Keep page" : "Delete page"}
            className={`absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-white ${
              selected ? "bg-black/65 hover:bg-danger" : "bg-danger"
            }`}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="min-w-0 border-t border-brd px-2 py-1.5">
        {label && <p className="truncate text-sm font-semibold text-ink">{label}</p>}
        {caption && <p className="truncate text-xs text-ink-3">{caption}</p>}
        <div className="mt-1 flex items-center gap-0.5">
          <TileBtn onClick={onFirst} disabled={index === 0} label="Move to front"><ChevronsLeft size={15} /></TileBtn>
          <TileBtn onClick={onPrev} disabled={index === 0} label="Move back"><ChevronLeft size={15} /></TileBtn>
          <TileBtn onClick={onNext} disabled={index === total - 1} label="Move forward"><ChevronRight size={15} /></TileBtn>
          {onRotate && <TileBtn onClick={onRotate} label="Rotate"><RotateCw size={15} /></TileBtn>}
        </div>
      </div>
    </Card>
  );
}

function TileBtn({ onClick, disabled, label, children }) {
  if (!onClick) return null;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// FileRow — list row for the merge tool (files, not pages).
// ---------------------------------------------------------------------------
export function FileRow({ file, index, total, onFirst, onPrev, onNext, onRemove, note }) {
  const isPdf = file.kind === "pdf";
  return (
    <Card className="flex min-w-0 items-center gap-3 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-ink-2">
        {isPdf ? <FileText size={18} /> : <ImageIcon size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-ink">{file.name}</p>
        <p className="truncate text-sm text-ink-3">
          {fmtBytes(file.size)}
          {note ? ` · ${note}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <TileBtn onClick={onFirst} disabled={index === 0} label="Move to top"><ChevronsLeft size={16} /></TileBtn>
        <TileBtn onClick={onPrev} disabled={index === 0} label="Move up"><ChevronLeft size={16} /></TileBtn>
        <TileBtn onClick={onNext} disabled={index === total - 1} label="Move down"><ChevronRight size={16} /></TileBtn>
        <TileBtn onClick={onRemove} label="Remove"><X size={16} /></TileBtn>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Status panels
// ---------------------------------------------------------------------------
export function ProgressPanel({ label, done, total, onCancel }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-base font-bold text-ink">{label}</p>
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      {total > 0 && <p className="text-sm text-ink-3">{done} of {total}</p>}
    </Card>
  );
}

export function ResultPanel({ title, bytesBefore, bytesAfter, pages, warning, onDownload, onReset }) {
  const saved = bytesBefore && bytesAfter ? Math.round((1 - bytesAfter / bytesBefore) * 100) : 0;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <p className="text-xl font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-base text-ink-2">
          {pages != null && `${pages} page${pages === 1 ? "" : "s"} · `}
          {bytesBefore != null ? (
            <>
              {fmtBytes(bytesBefore)} → <span className="font-bold text-ink">{fmtBytes(bytesAfter)}</span>
              {saved > 0 && <span className="text-success"> ({saved}% smaller)</span>}
            </>
          ) : (
            fmtBytes(bytesAfter)
          )}
        </p>
      </div>
      {warning && <Notice tone="warn">{warning}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button icon={Download} onClick={onDownload}>Download PDF</Button>
        <Button variant="secondary" icon={RefreshCw} onClick={onReset}>Start over</Button>
      </div>
    </Card>
  );
}

// Inline notice used for tips, warnings and errors inside a tool.
export function Notice({ tone = "warn", children }) {
  const tones = {
    warn: "border-brd bg-warn-bg text-warn",
    danger: "border-brd bg-danger-bg text-danger",
    info: "border-brd bg-info-bg text-info",
  };
  // A warning triangle next to a neutral tip reads as "something is wrong",
  // so the info tone gets its own icon.
  const Ico = tone === "info" ? Info : TriangleAlert;
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-base ${tones[tone] || tones.warn}`}>
      <Ico size={17} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// Small "runs on your device" reassurance, shown on every tool.
export function PrivacyNote() {
  return (
    <p className="text-sm text-ink-3">
      Everything runs inside your browser — your files are never uploaded to any server.
    </p>
  );
}

// ---------------------------------------------------------------------------
// Reorder helpers, shared by every tool's list/grid.
// ---------------------------------------------------------------------------
export function moveItem(list, from, to) {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
