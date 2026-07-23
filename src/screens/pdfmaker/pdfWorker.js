/* eslint-env worker */
// ============================================================================
// PDF Maker worker — all document ASSEMBLY happens here (pdf-lib), plus photo
// rasterisation via OffscreenCanvas.
//
// Deliberately NO pdf.js in this file. pdf.js's rendering layer needs a DOM
// (it throws "document is not defined" from its font loader inside a worker),
// and the community workaround is a fake `ownerDocument` shim against library
// internals. Page RENDERING therefore lives on the main thread in
// pdfRender.js — pdf.js already does its parsing in its own internal worker, so
// the expensive part is off the UI thread either way.
//
// NOTE FOR FUTURE WORK: never add `page.drawText()` with non-ASCII text here.
// pdf-lib does no OpenType shaping, so Bengali conjuncts/ligatures come out
// mangled. Every tool below only embeds images or copies existing pages, which
// is why the app can offer this at all. Text must be rendered by the browser
// (HTML -> canvas -> image) if it's ever needed.
// ============================================================================

import { PDFDocument, degrees } from "pdf-lib";
import { A4, PAGE_MARGIN } from "./presets.js";

const cancelled = new Set();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class OpError extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail; // e.g. the offending file name
  }
}

function checkCancelled(id) {
  if (cancelled.has(id)) throw new OpError("cancelled");
}

// pdf-lib throws EncryptedPDFError for password-protected files. We never pass
// ignoreEncryption:true — it "succeeds" and then produces broken output.
async function loadPdf(buf, name) {
  try {
    return await PDFDocument.load(buf);
  } catch (err) {
    const msg = String(err?.name || "") + " " + String(err?.message || "");
    if (/encrypt/i.test(msg)) throw new OpError("encrypted", name);
    throw new OpError("corrupt", name);
  }
}

// Decode -> scale -> rotate -> flatten onto white -> JPEG bytes.
// Returns { bytes, width, height } in device pixels.
async function rasteriseImage({ buf, mime, rotate = 0 }, preset) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(new Blob([buf], { type: mime || "image/jpeg" }), {
      // Phone photos carry EXIF orientation; without this a portrait shot taken
      // in landscape grip lands sideways in the PDF.
      imageOrientation: "from-image",
    });
  } catch {
    throw new OpError("unsupported-image");
  }

  try {
    const { maxDim, quality } = preset;
    const longEdge = Math.max(bitmap.width, bitmap.height);
    const ratio = longEdge > maxDim ? maxDim / longEdge : 1;
    const drawW = Math.max(1, Math.round(bitmap.width * ratio));
    const drawH = Math.max(1, Math.round(bitmap.height * ratio));

    const turned = rotate === 90 || rotate === 270;
    const canvasW = turned ? drawH : drawW;
    const canvasH = turned ? drawW : drawH;

    const canvas = new OffscreenCanvas(canvasW, canvasH);
    const ctx = canvas.getContext("2d");
    // JPEG has no alpha channel: without this, transparent PNG areas turn black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.save();
    ctx.translate(canvasW / 2, canvasH / 2);
    if (rotate) ctx.rotate((rotate * Math.PI) / 180);
    ctx.drawImage(bitmap, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { bytes, width: canvasW, height: canvasH };
  } finally {
    // Free the decoded pixels immediately — 40 un-closed bitmaps of a 12MP
    // photo is ~2GB and takes the tab with it.
    bitmap.close();
  }
}

// Place an image on an A4 page, letterboxed inside the margin. Pages go
// landscape when the picture is wider than it is tall, so a landscape photo
// isn't shrunk into a portrait column.
function addImagePage(pdf, embedded, imgW, imgH) {
  const landscape = imgW > imgH;
  const pageW = landscape ? A4.h : A4.w;
  const pageH = landscape ? A4.w : A4.h;
  const page = pdf.addPage([pageW, pageH]);

  const availW = pageW - PAGE_MARGIN * 2;
  const availH = pageH - PAGE_MARGIN * 2;
  const scale = Math.min(availW / imgW, availH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  page.drawImage(embedded, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
}

async function finish(pdf) {
  const bytes = await pdf.save();
  // Copy into a fresh ArrayBuffer so the Blob owns its memory.
  const blob = new Blob([bytes], { type: "application/pdf" });
  return { blob, bytes: blob.size, pages: pdf.getPageCount() };
}

// ---------------------------------------------------------------------------
// Ops
// ---------------------------------------------------------------------------

// Images -> one A4-per-image PDF.
async function opImagesToPdf(id, { images, preset }) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < images.length; i++) {
    checkCancelled(id);
    post({ id, type: "progress", done: i, total: images.length });
    const { bytes, width, height } = await rasteriseImage(images[i], preset);
    const embedded = await pdf.embedJpg(bytes);
    addImagePage(pdf, embedded, width, height);
  }
  post({ id, type: "progress", done: images.length, total: images.length });
  return finish(pdf);
}

// Merge PDFs (page-copied, lossless) and images (rasterised to A4) in the
// order the student arranged them.
async function opMerge(id, { files, preset }) {
  const out = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    checkCancelled(id);
    post({ id, type: "progress", done: i, total: files.length });
    const f = files[i];
    if (f.kind === "pdf") {
      const src = await loadPdf(f.buf, f.name);
      let copied;
      try {
        copied = await out.copyPages(src, src.getPageIndices());
      } catch {
        // Merging PDFs whose AcroForm fields share names can throw here.
        throw new OpError("corrupt", f.name);
      }
      copied.forEach((p) => out.addPage(p));
    } else {
      const { bytes, width, height } = await rasteriseImage(f, preset);
      const embedded = await out.embedJpg(bytes);
      addImagePage(out, embedded, width, height);
    }
  }
  post({ id, type: "progress", done: files.length, total: files.length });
  return finish(out);
}

// Reorder / rotate / delete pages. Rotation is metadata only (no re-encoding),
// so text stays selectable and the file doesn't grow.
async function opOrganize(id, { buf, order, rotates }) {
  const src = await loadPdf(buf);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, order);
  copied.forEach((page, i) => {
    const delta = rotates?.[order[i]] || 0;
    if (delta) {
      const current = page.getRotation().angle || 0;
      page.setRotation(degrees((current + delta) % 360));
    }
    out.addPage(page);
  });
  return finish(out);
}

// Build a PDF from pages already rasterised on the main thread (compress).
// Each page keeps its ORIGINAL point size so the output paginates identically.
async function opAssemblePages(id, { pages }) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages.length; i++) {
    checkCancelled(id);
    const p = pages[i];
    const embedded = await pdf.embedJpg(new Uint8Array(p.buf));
    const page = pdf.addPage([p.wPt, p.hPt]);
    page.drawImage(embedded, { x: 0, y: 0, width: p.wPt, height: p.hPt });
  }
  return finish(pdf);
}

const OPS = {
  "images-to-pdf": opImagesToPdf,
  merge: opMerge,
  organize: opOrganize,
  "assemble-pages": opAssemblePages,
};

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------

function post(msg) {
  self.postMessage(msg);
}

self.onmessage = async (e) => {
  const { id, op, payload } = e.data || {};

  if (op === "cancel") {
    cancelled.add(e.data.targetId);
    return;
  }

  const fn = OPS[op];
  if (!fn) {
    post({ id, type: "error", code: "unknown" });
    return;
  }

  try {
    const result = await fn(id, payload);
    checkCancelled(id);
    post({ id, type: "done", result });
  } catch (err) {
    post({
      id,
      type: "error",
      code: err instanceof OpError ? err.code : "unknown",
      detail: err?.detail,
    });
  } finally {
    cancelled.delete(id);
  }
};
