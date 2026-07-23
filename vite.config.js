import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

// pdf.js needs two asset folders at runtime that aren't part of its JS bundle:
//   standard_fonts/ — glyph data for PDFs that reference (but don't embed) the
//                     14 standard fonts, i.e. most Word/Docs exports. Without
//                     these, text renders blank or with the wrong glyphs.
//   cmaps/          — character maps for CJK and other encoded text.
// They're copied to /pdfjs/* and handed to every getDocument() call
// (see src/screens/pdfmaker/pdfjsSetup.js).
const PDFJS = "node_modules/pdfjs-dist";

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      // `rename: { stripBase: true }` is required: by default this plugin keeps
      // the source path, so the files land in
      // dist/pdfjs/standard_fonts/node_modules/pdfjs-dist/… where pdf.js never
      // looks for them — and the failure is silent (missing glyphs, not an
      // error). Both source folders are flat, so stripping to the bare filename
      // is exactly right.
      targets: [
        { src: `${PDFJS}/standard_fonts/*`, dest: "pdfjs/standard_fonts", rename: { stripBase: true } },
        { src: `${PDFJS}/cmaps/*`, dest: "pdfjs/cmaps", rename: { stripBase: true } },
      ],
    }),
  ],
  // pdfjs-dist ships dynamic import() inside the code our PDF worker pulls in;
  // Vite's default "iife" worker format can't emit a code-split worker, so the
  // build fails without this.
  worker: { format: "es" },
});
