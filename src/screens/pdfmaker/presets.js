// ============================================================================
// PDF Maker — shared constants.
// Imported by BOTH the React screens and the pdf worker, so this file must stay
// dependency-free (importing anything here would drag it into the worker chunk).
// ============================================================================

// A4 in PDF points (72dpi). pdf-lib measures pages in points.
export const A4 = { w: 595.28, h: 841.89 };
export const PAGE_MARGIN = 24; // pt of white space around an embedded photo

// Image quality presets for Images -> PDF. maxDim caps the LONG edge in pixels.
// 1754px ~= A4 height at 150dpi, 2480px ~= A4 width at 300dpi.
export const IMAGE_PRESETS = {
  high: { key: "high", label: "High", hint: "Best for printing", maxDim: 2480, quality: 0.87 },
  balanced: { key: "balanced", label: "Balanced", hint: "Recommended", maxDim: 1754, quality: 0.78 },
  compact: { key: "compact", label: "Compact", hint: "Smallest file", maxDim: 1240, quality: 0.62 },
};
export const DEFAULT_PRESET = "balanced";

// Compress targets. `quality`/`scale` are the STARTING point; the worker walks
// them down over up to MAX_COMPRESS_PASSES attempts to reach `bytes`.
export const COMPRESS_TARGETS = {
  "2mb": { key: "2mb", label: "≤ 2 MB", bytes: 2 * 1024 * 1024, quality: 0.65 },
  "5mb": { key: "5mb", label: "≤ 5 MB", bytes: 5 * 1024 * 1024, quality: 0.75 },
};
export const MAX_COMPRESS_PASSES = 3;
export const COMPRESS_DPI_SCALE = 1754; // long edge px at the default render density
export const MIN_LONG_EDGE = 1000; // never render below this, however small the target
export const MIN_QUALITY = 0.35;

// Limits. These exist to protect low-end phones: every cap below is a point
// where an uncapped run could exhaust tab memory and kill the whole app.
export const LIMITS = {
  images: { maxFiles: 40, maxBytes: 25 * 1024 * 1024 },
  merge: { maxFiles: 10, maxBytes: 50 * 1024 * 1024, maxPages: 500 },
  organize: { maxBytes: 50 * 1024 * 1024, maxPages: 200 },
  compress: { maxBytes: 50 * 1024 * 1024, maxPages: 150 },
};

export const THUMB_MAX_DIM = 160;

// A PDF is treated as "text-heavy" (bad compress candidate — see ToolCompress)
// when sampled pages average more than this many characters of real text.
export const TEXT_HEAVY_CHARS_PER_PAGE = 200;
export const TEXT_SAMPLE_PAGES = 5;

// Worker/loader error codes -> user-facing copy. Keep these in one place so the
// worker can return a bare code and every screen phrases it identically.
export const ERROR_TEXT = {
  encrypted: "This PDF is password-protected. Remove the password first, then try again.",
  corrupt: "This file couldn't be read — it may be damaged or not a real PDF.",
  "unsupported-image": "This image format isn't supported. If it's an iPhone photo (HEIC), set your camera to \"Most Compatible\" to save JPEGs.",
  heic: "iPhone HEIC photos aren't supported yet. On your iPhone: Settings → Camera → Formats → \"Most Compatible\", then retake or screenshot the photo.",
  "too-large": "This file is too big to process in the browser.",
  "too-many-pages": "This PDF has too many pages to process in the browser.",
  "already-optimized": "This PDF is already well optimized — compressing it would make it bigger, so nothing was changed.",
  "cant-hit-target": "Couldn't reach the target size.",
  "browser-unsupported": "Your browser is too old for this tool. Try an up-to-date Chrome, Edge, Safari or Firefox.",
  cancelled: "Cancelled.",
  unknown: "Something went wrong while processing this file.",
};

export function errorText(code) {
  return ERROR_TEXT[code] || ERROR_TEXT.unknown;
}

// HEIC/HEIF gets its own message because it's common (every default iPhone
// photo) and the fix is a phone setting, not something we can do for them.
export function isHeic(file) {
  const t = (file.type || "").toLowerCase();
  const n = (file.name || "").toLowerCase();
  return t.includes("heic") || t.includes("heif") || /\.(heic|heif)$/.test(n);
}

export function isPdf(file) {
  return (file.type || "").toLowerCase() === "application/pdf" || /\.pdf$/i.test(file.name || "");
}

export function isImage(file) {
  return (file.type || "").toLowerCase().startsWith("image/");
}
