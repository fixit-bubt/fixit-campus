import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { ArrowLeft, Send, Sparkles, History, Image as ImageIcon, X, Trash2 } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { supabase } from "../../lib/supabase.js";
import { streamChat } from "../../lib/chatbotApi.js";
import { AppShell } from "../../components/AppShell.jsx";
import { Card, Button, Textarea, Loading, Modal, useToast } from "../../components/ui.jsx";

// Touch devices have no Shift key — Enter inserts a newline there, same rule
// Messages.jsx uses for its composer.
const IS_TOUCH = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(pointer: coarse)").matches
  : false;

// Kept under the edge function's MAX_IMAGE_BASE64_CHARS (~4.5MB binary) —
// base64 runs ~33% larger than the source file, so a 5MB cap (this app's
// usual FileUpload limit) could occasionally clear the server's ceiling.
const MAX_CHAT_IMAGE_MB = 4;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

// Chatbot student-only gate lives server-side too (the edge function checks
// role itself), but the route/nav are gated here as well, same as every
// other student-only screen in this app.
export default function Chatbot({ conversationId }) {
  const { currentUser } = useApp();
  const toast = useToast();
  const [messages, setMessages] = useState([]); // [{id, role, body}]
  const [convId, setConvId] = useState(conversationId || null);
  const [loadingHistory, setLoadingHistory] = useState(!!conversationId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [image, setImage] = useState(null); // { file, previewUrl }
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const objectUrlRef = useRef(null);

  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);
  // A ref, not the `sending` state, guards re-entrancy: two send() calls
  // fired in the same tick (OS key-repeat on held Enter outruns React's
  // re-render) would otherwise both read `sending` as still false from the
  // same stale closure and both go through.
  const sendingRef = useRef(false);

  // Load an existing conversation's messages when opened from history.
  // A fresh /chatbot (no id) starts empty — the conversation row is only
  // created lazily on the first send, not eagerly on screen open.
  useEffect(() => {
    if (!conversationId) { setMessages([]); setConvId(null); return; }
    let active = true;
    setLoadingHistory(true);
    supabase.from("chatbot_messages").select("*").eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { toast({ type: "error", title: "Couldn't load conversation", message: error.message }); }
        setMessages(data || []);
        setConvId(conversationId);
        setLoadingHistory(false);
      });
    return () => { active = false; };
  }, [conversationId]);

  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, streamText]);

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

  const send = useCallback(async () => {
    const body = text.trim();
    const pickedImage = image;
    if ((!body && !pickedImage) || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setText("");
    setImage(null);
    setStreamText("");

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
      sendingRef.current = false;
      setSending(false);
    }
  }, [text, image, convId, currentUser, messages, toast]);

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !IS_TOUCH) {
      e.preventDefault();
      send();
    }
  }

  const [confirmDelete, setConfirmDelete] = useState(false);
  async function deleteThisConversation() {
    setConfirmDelete(false);
    if (!convId) return;
    const { error } = await supabase.from("chatbot_conversations").delete().eq("id", convId);
    if (error) { toast({ type: "error", title: "Couldn't delete", message: error.message }); return; }
    navigate("/chatbot/history");
  }

  return (
    <AppShell activeKey="chatbot" title="AI Assistant">
      <Card className="flex flex-col h-[calc(100vh-8.5rem)] sm:h-[calc(100vh-11rem)]">
        <div className="flex shrink-0 items-center gap-3 border-b border-brd px-4 py-3">
          <button onClick={() => navigate("/dashboard")} aria-label="Back" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2">
            <ArrowLeft size={18} />
          </button>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <Sparkles size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-ink">AI Assistant</p>
            <p className="truncate text-xs text-ink-3">Ask about bus, prayer times, clubs, jobs, faculty…</p>
          </div>
          {convId && (
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete this conversation"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-3 hover:bg-danger-bg hover:text-danger"
            >
              <Trash2 size={18} />
            </button>
          )}
          <Link to="/chatbot/history" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2" aria-label="Chat history">
            <History size={18} />
          </Link>
        </div>

        {loadingHistory ? (
          <Loading className="flex-1" />
        ) : (
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && !streamText ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-ink-3">
                <Sparkles size={26} />
                <p className="max-w-xs text-md">Ask me anything about campus — bus routes, prayer times, clubs, jobs, faculty, or your CGPA.</p>
              </div>
            ) : (
              <>
                {messages.map((m) => <Bubble key={m.id} role={m.role} body={m.body} imageUrl={m.image_url} />)}
                {streamText && <Bubble role="model" body={streamText} pending />}
              </>
            )}
          </div>
        )}

        <div className="shrink-0 border-t border-brd p-3">
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
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink-2 disabled:opacity-50"
            >
              <ImageIcon size={19} />
            </button>
            <Textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 4000))}
              onKeyDown={onKeyDown}
              placeholder="Message the assistant…"
              className="max-h-32 min-h-[2.75rem] flex-1"
              disabled={sending}
            />
            <Button icon={Send} loading={sending} disabled={!text.trim() && !image} onClick={send} className="shrink-0">
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this chat?"
        description="This conversation and all its messages will be permanently deleted. This can't be undone."
        icon={Trash2}
        tone="red"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteThisConversation}>Delete</Button>
          </>
        }
      />
    </AppShell>
  );
}

function Bubble({ role, body, imageUrl, pending }) {
  const mine = role === "user";
  return (
    <div className={`flex gap-2 py-1 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine && (
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <Sparkles size={14} />
        </span>
      )}
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-md leading-relaxed break-words whitespace-pre-wrap ${
          mine ? "bg-brand text-white" : "bg-surface-2 text-ink"
        }`}
      >
        {imageUrl && (
          <img src={imageUrl} alt="Attached" className={`max-h-64 rounded-lg object-cover ${body ? "mb-2" : ""}`} />
        )}
        {body}
        {pending && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-current align-middle" />}
      </div>
    </div>
  );
}
