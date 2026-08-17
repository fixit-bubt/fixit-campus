import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { Send, Sparkles, Image as ImageIcon, X, Square, Copy, Check } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { supabase } from "../../lib/supabase.js";
import { streamChat } from "../../lib/chatbotApi.js";
import { Button, Textarea, Loading, useToast } from "../../components/ui.jsx";

// ============================================================================
// Shared chatbot core — the conversation engine plus the message list and
// composer, used by BOTH the full /chatbot page and the floating ChatWidget.
// The streaming + re-entrancy handling is subtle enough that duplicating it
// per surface would guarantee the two drift apart, so it lives here once.
// ============================================================================

// Touch devices have no Shift key — Enter inserts a newline there, same rule
// Messages.jsx uses for its composer.
const IS_TOUCH = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(pointer: coarse)").matches
  : false;

// Kept under the edge function's MAX_IMAGE_BASE64_CHARS (~4.5MB binary) —
// base64 runs ~33% larger than the source file, so a 5MB cap (this app's
// usual FileUpload limit) could occasionally clear the server's ceiling.
const MAX_CHAT_IMAGE_MB = 4;

// Conversation starters for the empty state. A blank box gets no typing;
// these are the questions the campus-data tools actually answer well.
export const CHAT_SUGGESTIONS = [
  "When is the next bus to campus?",
  "What time is Maghrib today?",
  "What clubs can I join?",
  "Any jobs or internships open?",
];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

function readStored(key) {
  try { return localStorage.getItem(key) || null; } catch { return null; }
}
function writeStored(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch { /* storage blocked — in-memory only */ }
}

// Owns one conversation: its messages, the in-flight stream, and the pending
// image attachment. `conversationId` opens an existing thread from history;
// omit it to start a fresh one (the DB row is created lazily on first send).
// `persistKey` remembers the thread id in localStorage so the widget resumes
// the same conversation after a page reload instead of losing it.
export function useChatSession(conversationId, { persistKey } = {}) {
  const { currentUser } = useApp();
  const toast = useToast();
  // The thread to FETCH. Kept separate from convId because convId also changes
  // when a conversation is lazily created mid-session — keying the load effect
  // on that would refetch and clobber the optimistic local messages.
  const initialId = conversationId || (persistKey ? readStored(persistKey) : null);
  const [loadId, setLoadId] = useState(initialId);
  const [convId, setConvId] = useState(initialId);
  const [messages, setMessages] = useState([]); // [{id, role, body}]
  const [loadingHistory, setLoadingHistory] = useState(!!initialId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [image, setImage] = useState(null); // { file, previewUrl }
  const objectUrlRef = useRef(null);
  const abortRef = useRef(null);
  const restoredRef = useRef(!conversationId && !!initialId);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    abortRef.current?.abort();
  }, []);
  // A ref, not the `sending` state, guards re-entrancy: two send() calls
  // fired in the same tick (OS key-repeat on held Enter outruns React's
  // re-render) would otherwise both read `sending` as still false from the
  // same stale closure and both go through.
  const sendingRef = useRef(false);

  // Follow the routed conversation id when the page navigates between threads
  // (including /chatbot/:id → /chatbot, which must clear back to a new chat).
  // A persisted session (the widget) owns its own thread instead — the route
  // it happens to be sitting on says nothing about which chat is open.
  useEffect(() => {
    if (persistKey) return;
    restoredRef.current = false;
    setLoadId(conversationId || null);
    setConvId(conversationId || null);
  }, [conversationId, persistKey]);

  // Remember the active thread so a reload resumes it.
  useEffect(() => {
    if (persistKey) writeStored(persistKey, convId);
  }, [persistKey, convId]);

  // Load an existing conversation's messages. A fresh chat (no id) starts
  // empty — the conversation row is only created lazily on the first send.
  useEffect(() => {
    if (!loadId) { setMessages([]); setLoadingHistory(false); return; }
    let active = true;
    setLoadingHistory(true);
    supabase.from("chatbot_messages").select("*").eq("conversation_id", loadId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { toast({ type: "error", title: "Couldn't load conversation", message: error.message }); }
        // A restored thread with no messages was deleted elsewhere (every real
        // conversation has at least the message that created it) — drop the
        // stale id instead of letting the next send fail its foreign key.
        if (!error && restoredRef.current && (data || []).length === 0) {
          restoredRef.current = false;
          setConvId(null);
          setLoadId(null);
          setMessages([]);
          setLoadingHistory(false);
          return;
        }
        setMessages(data || []);
        setLoadingHistory(false);
      });
    return () => { active = false; };
  }, [loadId]);

  function pickImage(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ type: "error", title: "Choose an image file" }); return; }
    if (file.size > MAX_CHAT_IMAGE_MB * 1024 * 1024) { toast({ type: "error", title: `Image must be under ${MAX_CHAT_IMAGE_MB} MB` }); return; }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    objectUrlRef.current = previewUrl;
    setImage({ file, previewUrl });
  }

  function clearImage() {
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
    setImage(null);
  }

  // Start a brand-new thread (widget "New chat"). Refuses mid-send so a
  // streaming reply can't land in the cleared thread.
  function reset() {
    if (sendingRef.current) return;
    restoredRef.current = false;
    clearImage();
    setMessages([]);
    setConvId(null);
    setLoadId(null);
    setText("");
    setStreamText("");
  }

  // Open an existing thread from the widget's history list.
  function openThread(id) {
    if (sendingRef.current) return;
    restoredRef.current = false;
    clearImage();
    setText("");
    setStreamText("");
    setConvId(id);
    setLoadId(id);
  }

  // Stop generating. The partial text is dropped rather than left on screen:
  // only the server's `done` frame persists a model message, so keeping a
  // half-answer visible would vanish on the next reload anyway.
  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamText("");
    sendingRef.current = false;
    setSending(false);
  }

  const send = useCallback(async (override) => {
    const body = (typeof override === "string" ? override : text).trim();
    const pickedImage = image;
    if ((!body && !pickedImage) || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setText("");
    setImage(null);
    setStreamText("");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Lazily create the conversation on the first message of a new chat.
      let cid = convId;
      if (!cid) {
        const { data, error } = await supabase
          .from("chatbot_conversations")
          .insert({ user_id: currentUser.id, title: (body || "Photo").slice(0, 60) })
          .select().single();
        if (error || !data) { toast({ type: "error", title: "Couldn't start chat", message: error?.message }); setSending(false); return; }
        cid = data.id;
        setConvId(cid);
      }

      let imageBase64, imageMimeType, imageUrl;
      if (pickedImage) {
        try {
          imageBase64 = await fileToBase64(pickedImage.file);
          imageMimeType = pickedImage.file.type;
          const ext = (pickedImage.file.name?.split(".").pop() || "jpg").toLowerCase();
          const path = `chatbot/${currentUser.id}-${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("photos").upload(path, pickedImage.file, { cacheControl: "3600", upsert: false });
          if (!upErr) imageUrl = supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
        } catch { /* base64/upload failure — message still sends as text-only below */ }
      }

      const { data: userMsg, error: umErr } = await supabase
        .from("chatbot_messages")
        .insert({ conversation_id: cid, user_id: currentUser.id, role: "user", body, image_url: imageUrl || null })
        .select().single();
      if (umErr || !userMsg) { toast({ type: "error", title: "Couldn't send message", message: umErr?.message }); setSending(false); return; }

      const history = messages.map((m) => ({ role: m.role, text: m.body }));
      setMessages((prev) => [...prev, userMsg]);

      await streamChat({
        message: body,
        history,
        imageBase64,
        imageMimeType,
        signal: controller.signal,
        onChunk: (t) => setStreamText((s) => s + t),
        onRetract: () => setStreamText(""),
        onDone: async (finalText) => {
          setStreamText("");
          const { data: modelMsg, error: mmErr } = await supabase
            .from("chatbot_messages")
            .insert({ conversation_id: cid, user_id: currentUser.id, role: "model", body: finalText })
            .select().single();
          if (!mmErr && modelMsg) setMessages((prev) => [...prev, modelMsg]);
        },
        onError: (msg) => {
          setStreamText("");
          toast({ type: "error", title: "Assistant error", message: msg });
        },
      });
    } finally {
      // Only the turn that still owns the abort slot may clear the busy flags.
      // After Stop, stop() already cleared them and may have handed the slot to
      // a newer send — resetting unconditionally here would drop that turn's
      // re-entrancy guard and hide its Stop button mid-stream.
      if (abortRef.current === controller) {
        abortRef.current = null;
        sendingRef.current = false;
        setSending(false);
      }
    }
  }, [text, image, convId, currentUser, messages, toast]);

  return {
    messages, convId, loadingHistory,
    text, setText, sending, streamText,
    image, pickImage, clearImage, send, reset, stop, openThread,
  };
}

// ---------------------------------------------------------------------------
// Markdown-lite. The assistant replies with **bold**, `code`, and - bullet
// lists; rendering them as literal asterisks looks broken. This covers just
// those cases and builds React nodes (never dangerouslySetInnerHTML), so a
// reply can't inject markup.
// ---------------------------------------------------------------------------
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

function renderInline(text, keyPrefix) {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={key} className="rounded bg-black/10 px-1 py-0.5 text-[0.9em] dark:bg-white/15">{part.slice(1, -1)}</code>;
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export function RichText({ body }) {
  if (!body) return null;
  const lines = String(body).split("\n");
  const blocks = [];
  let list = null; // buffered consecutive bullet lines

  const flush = () => {
    if (!list) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-1 list-disc space-y-0.5 pl-5">
        {list.map((item, i) => <li key={i}>{renderInline(item, `li-${blocks.length}-${i}`)}</li>)}
      </ul>
    );
    list = null;
  };

  lines.forEach((line, i) => {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) { (list ||= []).push(bullet[1]); return; }
    flush();
    if (line.trim() === "") { blocks.push(<div key={`sp-${i}`} className="h-2" />); return; }
    blocks.push(<p key={`p-${i}`}>{renderInline(line, `p-${i}`)}</p>);
  });
  flush();
  return <>{blocks}</>;
}

// Scrolling transcript. `emptyHint` lets the widget run a shorter blurb than
// the full page without forking the component; `onPickSuggestion` turns the
// empty state into tappable conversation starters.
export function MessageList({ messages, streamText, loadingHistory, emptyHint, onPickSuggestion, className = "" }) {
  const listRef = useRef(null);
  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, streamText]);

  if (loadingHistory) return <Loading className="flex-1" />;
  return (
    <div ref={listRef} className={`flex-1 overflow-y-auto px-4 py-3 ${className}`}>
      {messages.length === 0 && !streamText ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-ink-3">
          <Sparkles size={26} />
          <p className="max-w-xs text-md">{emptyHint}</p>
          {onPickSuggestion && (
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {CHAT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onPickSuggestion(s)}
                  className="rounded-full border border-brd bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:border-brand hover:bg-brand-50 hover:text-brand"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {messages.map((m) => <Bubble key={m.id} role={m.role} body={m.body} imageUrl={m.image_url} />)}
          {streamText && <Bubble role="model" body={streamText} pending />}
        </>
      )}
    </div>
  );
}

// Attach + textarea + send. `compact` trims it for the narrow widget panel.
// While a reply streams, Send becomes Stop.
export function Composer({ text, setText, image, pickImage, clearImage, sending, send, stop, compact = false, autoFocus = false }) {
  const fileInputRef = useRef(null);

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !IS_TOUCH) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className={`shrink-0 border-t border-brd ${compact ? "p-2" : "p-3"}`}>
      {image && (
        <div className="mb-2 flex items-center gap-2">
          <div className="relative">
            <img src={image.previewUrl} alt="" className="h-14 w-14 rounded-md object-cover" />
            <button
              type="button"
              onClick={clearImage}
              aria-label="Remove image"
              className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface text-ink-3 shadow-sm hover:text-danger"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={pickImage} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          title="Attach a photo"
          aria-label="Attach a photo"
          className={`inline-flex shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink-2 disabled:opacity-50 ${compact ? "h-10 w-10" : "h-11 w-11"}`}
        >
          <ImageIcon size={19} />
        </button>
        <Textarea
          rows={1}
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value.slice(0, 4000))}
          onKeyDown={onKeyDown}
          placeholder="Message the assistant…"
          className={`flex-1 ${compact ? "max-h-24 min-h-[2.5rem]" : "max-h-32 min-h-[2.75rem]"}`}
          disabled={sending}
        />
        {sending && stop ? (
          <Button icon={Square} variant="secondary" onClick={stop} className="shrink-0" title="Stop generating">
            {!compact && <span className="hidden sm:inline">Stop</span>}
          </Button>
        ) : (
          <Button icon={Send} loading={sending} disabled={!text.trim() && !image} onClick={() => send()} className="shrink-0">
            {!compact && <span className="hidden sm:inline">Send</span>}
          </Button>
        )}
      </div>
    </div>
  );
}

// Copy-to-clipboard for an assistant reply. Falls back silently on browsers
// that block the clipboard API (or serve the app over plain http).
function CopyButton({ body }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  async function copy() {
    try { await navigator.clipboard.writeText(body); setCopied(true); } catch { /* unavailable */ }
  }
  return (
    <button
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy reply"}
      title={copied ? "Copied" : "Copy reply"}
      className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded text-ink-3 opacity-0 transition-opacity hover:bg-surface-2 hover:text-ink-2 focus:opacity-100 group-hover:opacity-100"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

export function Bubble({ role, body, imageUrl, pending }) {
  const mine = role === "user";
  return (
    <div className={`group flex gap-2 py-1 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine && (
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <Sparkles size={14} />
        </span>
      )}
      <div className="flex max-w-[78%] flex-col items-start">
        <div
          className={`w-full rounded-2xl px-3.5 py-2 text-md leading-relaxed break-words ${
            mine ? "whitespace-pre-wrap bg-brand text-white" : "bg-surface-2 text-ink"
          }`}
        >
          {imageUrl && (
            <img src={imageUrl} alt="Attached" className={`max-h-64 rounded-lg object-cover ${body ? "mb-2" : ""}`} />
          )}
          {/* User text is shown verbatim; only assistant replies get markdown. */}
          {mine ? body : <RichText body={body} />}
          {pending && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-current align-middle" />}
        </div>
        {!mine && !pending && body && <CopyButton body={body} />}
      </div>
    </div>
  );
}
