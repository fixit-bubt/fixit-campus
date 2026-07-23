// ============================================================================
// pdf.js access — page rendering, thumbnails and text sampling.
//
// This runs on the MAIN THREAD on purpose. pdf.js's display layer needs a DOM
// (its font loader calls `document.…`), so putting it in our own worker
// requires shimming a fake `ownerDocument` against library internals. pdf.js
// already offloads parsing/decoding to its OWN internal worker, so the costly
// half is off the UI thread regardless; what stays here is the canvas raster,
// and every loop below yields between pages so the page keeps painting.
//
// Everything that ASSEMBLES a PDF lives in pdfWorker.js (pdf-lib).
// ============================================================================

import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { MIN_LONG_EDGE } from "./presets.js";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Copied into dist/pdfjs by vite-plugin-static-copy (see vite.config.js).
// standard_fonts matters a lot: PDFs exported from Word/Docs reference the 14
// standard fonts without embedding them, and pdf.js renders them blank without
// this data — which for the compress tool would be baked into the output.
const ASSET_BASE = `${import.meta.env.BASE_URL}pdfjs/`;
const DOC_OPTS = {
  standardFontDataUrl: `${ASSET_BASE}standard_fonts/`,
  cMapUrl: `${ASSET_BASE}cmaps/`,
  cMapPacked: true,
};

export function isBrowserSupported() {
  return (
    typeof Worker !== "undefined" &&
    typeof createImageBitmap === "function" &&
    typeof Promise.allSettled === "function"
  );
}

// Let the browser paint (progress bars, cancel button) between heavy pages.
export const yieldToUi = () => new Promise((r) => setTimeout(r, 0));

export async function loadPdf(buf) {
  try {
    // CONSUMES `buf`: pdf.js transfers the ArrayBuffer to its own worker, which
    // detaches it here. (new Uint8Array(buf) is a view, not a copy — it does
    // NOT protect the caller.) Anyone needing the bytes again must re-read them
    // from the File, which is what ToolOrganize does before rebuilding.
    return await pdfjs.getDocument({ data: new Uint8Array(buf), ...DOC_OPTS }).promise;
  } catch (err) {
    const name = String(err?.name || "");
    if (name === "PasswordException") throw Object.assign(new Error("encrypted"), { code: "encrypted" });
    throw Object.assign(new Error("corrupt"), { code: "corrupt" });
  }
}

// Renders one page to a JPEG. `longEdge` caps the raster's long side in pixels.
// Returns the JPEG bytes plus the page's size in POINTS, taken from the
// viewport (not the MediaBox) so pages carrying /Rotate 90 keep the orientation
// the reader actually shows.
export async function renderPageToJpeg(pdf, pageNum, { longEdge, quality }) {
  const page = await pdf.getPage(pageNum);
  try {
    const base = page.getViewport({ scale: 1 });
    const cap = Math.max(longEdge, MIN_LONG_EDGE);
    const scale = Math.min(cap / Math.max(base.width, base.height), 3);
    const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });

    const width = Math.max(1, Math.floor(viewport.width));
    const height = Math.max(1, Math.floor(viewport.height));
    const { canvas, ctx, toBlob } = makeCanvas(width, height);

    // Flatten onto white: PDF pages are transparent, JPEG has no alpha.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await toBlob(quality);
    releaseCanvas(canvas);
    return {
      buf: await blob.arrayBuffer(),
      wPt: base.width,
      hPt: base.height,
      bytes: blob.size,
    };
  } finally {
    page.cleanup();
  }
}

export async function renderThumb(pdf, pageNum, maxDim) {
  const page = await pdf.getPage(pageNum);
  try {
    const base = page.getViewport({ scale: 1 });
    const scale = maxDim / Math.max(base.width, base.height);
    const viewport = page.getViewport({ scale: Math.max(scale, 0.05) });
    const width = Math.max(1, Math.floor(viewport.width));
    const height = Math.max(1, Math.floor(viewport.height));

    const { canvas, ctx, toBlob } = makeCanvas(width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await toBlob(0.6);
    releaseCanvas(canvas);
    return { blob, width, height, rotation: base.rotation || 0 };
  } finally {
    page.cleanup();
  }
}

// Average characters of extractable text per page, sampled across the document.
// Drives the "this PDF is mostly text" warning in the compress tool: rasterising
// a text page costs far more bytes than the vector text it replaces.
export async function sampleTextiness(pdf, samplePages) {
  const total = pdf.numPages;
  const step = Math.max(1, Math.floor(total / samplePages));
  let chars = 0;
  let sampled = 0;
  for (let n = 1; n <= total && sampled < samplePages; n += step) {
    const page = await pdf.getPage(n);
    try {
      const content = await page.getTextContent();
      chars += content.items.reduce((sum, it) => sum + (it.str ? it.str.length : 0), 0);
      sampled++;
    } finally {
      page.cleanup();
    }
  }
  return sampled ? chars / sampled : 0;
}

// ---------------------------------------------------------------------------
// Canvas plumbing. OffscreenCanvas is preferred because convertToBlob() encodes
// off the main thread; HTMLCanvasElement is the fallback for older Safari.
// ---------------------------------------------------------------------------
function makeCanvas(width, height) {
  if (typeof OffscreenCanvas === "function") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { alpha: false });
    return { canvas, ctx, toBlob: (quality) => canvas.convertToBlob({ type: "image/jpeg", quality }) };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  return {
    canvas,
    ctx,
    toBlob: (quality) =>
      new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality)
      ),
  };
}

// iOS in particular holds onto canvas backing stores until they're zeroed.
function releaseCanvas(canvas) {
  canvas.width = 0;
  canvas.height = 0;
}
