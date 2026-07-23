// ============================================================================
// downloadBlob — save a generated Blob to the user's device.
// The app had no client-side download path before the PDF Maker (existing
// "downloads" are just <a href> to a Supabase URL), so this is the one helper
// for it.
// ============================================================================

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  // Firefox needs the anchor in the document for the click to register.
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Don't revoke immediately: on iOS Safari the share sheet reads the URL
  // asynchronously after the click, and revoking early aborts the save.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// "report.pdf" / "scan 2.PDF" -> "report", "scan 2" (used to name outputs after
// whichever file the student picked first).
export function baseName(filename = "") {
  return filename.replace(/\.[^.]+$/, "").trim() || "document";
}

export function fmtBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return "0 KB";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 2 : 1)} MB`;
}
