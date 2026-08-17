import { supabase } from "./supabase.js";

// Streams the `chat` Supabase Edge Function — same deployed function CampusOne
// mobile uses (Gemini proxy with campus-data tool calling), already live on
// the shared backend. Browser fetch()/ReadableStream handles SSE natively, so
// none of mobile's raw-fetch workaround (their RN fetch polyfill can't stream)
// applies here — this is just a normal fetch with a stream reader.
//
// Server protocol (supabase/functions/chat/index.ts), one JSON object per
// `data: {...}\n\n` frame:
//   {type:'chunk', text}  - partial reply text, append live
//   {type:'retract'}      - discard everything streamed so far this turn
//                            (model started talking, then decided to call a
//                            tool instead — the preamble text was never real)
//   {type:'done', text}   - final, complete reply
//   {type:'error', message} - mid-stream failure
// `signal` (optional) aborts an in-flight reply — the composer's Stop button.
// An abort is user-intent, not a failure, so it never reaches onError; the
// caller keeps whatever text streamed up to that point.
export async function streamChat({ message, history, imageBase64, imageMimeType, signal, onChunk, onRetract, onDone, onError }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { onError("Not signed in."); return; }
  if (signal?.aborted) return;

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      // Only the CURRENT turn's image is ever sent — past images in `history`
      // aren't re-fetched and re-attached on later messages (matches the
      // server's own doc comment on this, keeps request size bounded).
      body: JSON.stringify({ message, history, imageBase64, imageMimeType }),
      signal,
    });
  } catch (e) {
    if (e?.name === "AbortError" || signal?.aborted) return;
    onError("Couldn't reach the assistant. Check your connection.");
    return;
  }

  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status}).`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* not JSON */ }
    onError(msg);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    let done, value;
    try {
      ({ done, value } = await reader.read());
    } catch (e) {
      // Aborting mid-read rejects the pending read() — expected, not an error.
      if (e?.name === "AbortError" || signal?.aborted) return;
      throw e;
    }
    if (done) break;
    buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const jsonStr = dataLine.slice(5).trim();
      if (!jsonStr) continue;
      let obj;
      try { obj = JSON.parse(jsonStr); } catch { continue; }
      if (obj.type === "chunk") onChunk(obj.text);
      else if (obj.type === "retract") onRetract();
      else if (obj.type === "done") onDone(obj.text);
      else if (obj.type === "error") onError(obj.message);
    }
  }
}
