import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { ArrowLeft, Send, Sparkles, History } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { supabase } from "../../lib/supabase.js";
import { streamChat } from "../../lib/chatbotApi.js";
import { AppShell } from "../../components/AppShell.jsx";
import { Card, Button, Textarea, Loading, useToast } from "../../components/ui.jsx";

// Touch devices have no Shift key — Enter inserts a newline there, same rule
// Messages.jsx uses for its composer.
const IS_TOUCH = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(pointer: coarse)").matches
  : false;

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
  const listRef = useRef(null);
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

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setText("");
    setStreamText("");

    try {
      // Lazily create the conversation on the first message of a new chat.
      let cid = convId;
      if (!cid) {
        const { data, error } = await supabase
          .from("chatbot_conversations")
          .insert({ user_id: currentUser.id, title: body.slice(0, 60) })
          .select().single();
        if (error || !data) { toast({ type: "error", title: "Couldn't start chat", message: error?.message }); setSending(false); return; }
        cid = data.id;
        setConvId(cid);
      }

      const { data: userMsg, error: umErr } = await supabase
        .from("chatbot_messages")
        .insert({ conversation_id: cid, user_id: currentUser.id, role: "user", body })
        .select().single();
      if (umErr || !userMsg) { toast({ type: "error", title: "Couldn't send message", message: umErr?.message }); setSending(false); return; }

      const history = messages.map((m) => ({ role: m.role, text: m.body }));
      setMessages((prev) => [...prev, userMsg]);

      await streamChat({
        message: body,
        history,
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
  }, [text, convId, currentUser, messages, toast]);

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !IS_TOUCH) {
      e.preventDefault();
      send();
    }
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
                {messages.map((m) => <Bubble key={m.id} role={m.role} body={m.body} />)}
                {streamText && <Bubble role="model" body={streamText} pending />}
              </>
            )}
          </div>
        )}

        <div className="shrink-0 border-t border-brd p-3">
          <div className="flex items-end gap-2">
            <Textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 4000))}
              onKeyDown={onKeyDown}
              placeholder="Message the assistant…"
              className="max-h-32 min-h-[2.75rem] flex-1"
              disabled={sending}
            />
            <Button icon={Send} loading={sending} disabled={!text.trim()} onClick={send} className="shrink-0">
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}

function Bubble({ role, body, pending }) {
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
        {body}
        {pending && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-current align-middle" />}
      </div>
    </div>
  );
}
