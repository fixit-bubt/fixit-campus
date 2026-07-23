import { useCallback, useEffect, useRef } from "react";

// ============================================================================
// usePdfWorker — thin client for pdfWorker.js.
//
// The worker is created LAZILY on the first job, so simply opening the PDF
// Maker landing page downloads none of the heavy pdf-lib chunk. It's terminated
// when the screen unmounts, which also frees anything a cancelled job was
// holding.
// ============================================================================

export function usePdfWorker() {
  const workerRef = useRef(null);
  const pendingRef = useRef(new Map());
  const seqRef = useRef(0);
  const currentRef = useRef(null);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("./pdfWorker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const { id, type } = e.data || {};
      const entry = pendingRef.current.get(id);
      if (!entry) return;
      if (type === "progress") {
        entry.onProgress?.(e.data);
        return;
      }
      pendingRef.current.delete(id);
      if (currentRef.current === id) currentRef.current = null;
      if (type === "done") entry.resolve(e.data.result);
      else entry.reject(Object.assign(new Error(e.data.code || "unknown"), { code: e.data.code, detail: e.data.detail }));
    };
    worker.onerror = () => {
      // A worker-level failure (bad chunk, unsupported browser) can't be tied to
      // one job — fail everything in flight rather than hanging the UI.
      for (const [, entry] of pendingRef.current) {
        entry.reject(Object.assign(new Error("browser-unsupported"), { code: "browser-unsupported" }));
      }
      pendingRef.current.clear();
      currentRef.current = null;
    };
    workerRef.current = worker;
    return worker;
  }, []);

  const run = useCallback(
    (op, payload, { transfer = [], onProgress } = {}) => {
      const worker = ensureWorker();
      const id = ++seqRef.current;
      currentRef.current = id;
      return new Promise((resolve, reject) => {
        pendingRef.current.set(id, { resolve, reject, onProgress });
        worker.postMessage({ id, op, payload }, transfer);
      });
    },
    [ensureWorker]
  );

  // Cancels the job currently in flight. The worker checks the flag between
  // pages, so this lands within roughly one page of work.
  const cancel = useCallback(() => {
    const id = currentRef.current;
    if (id && workerRef.current) workerRef.current.postMessage({ op: "cancel", targetId: id });
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      pendingRef.current.clear();
    };
  }, []);

  return { run, cancel };
}
