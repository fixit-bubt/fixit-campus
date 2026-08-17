import React, { useState, useEffect, useRef } from "react";
import { Sparkles, X, Maximize2, SquarePen, History, ArrowLeft, MessageSquare } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate, useHashRoute } from "../../lib/router.jsx";
import { supabase } from "../../lib/supabase.js";
import { Loading } from "../../components/ui.jsx";
import { useChatSession, MessageList, Composer } from "./chatCore.jsx";

// ============================================================================
// ChatWidget — the floating "ask the assistant" bubble pinned to the bottom
// right of every signed-in screen, like a support-chat launcher. Mounted once
// inside AppLayout (see App.jsx) so the conversation survives navigation:
// the state lives here, not in the routed screen that happens to be open.
//
// The full /chatbot page still exists for long sessions; this is the same
// engine (chatCore.jsx) in a smaller frame, plus a compact history list.
//
// Layering: z-40 keeps it above the nav capsule (z-30) but below Modal (z-50)
// and the toast stack (z-[60]) — a dialog must never open behind the bubble.
// Toasts land in this same corner, so one briefly covers the launcher; they
// auto-dismiss, and raising the bubble above them would hide error messages.
// ============================================================================

// Remembers the active thread across reloads (see useChatSession persistKey).
const WIDGET_THREAD_KEY = "fixit.chatWidget.threadId";

export default function ChatWidget() {
  const { currentUser } = useApp();
  const path = useHashRoute();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // drives the open/close transition
  const [view, setView] = useState("chat");  // chat | history
  const [unread, setUnread] = useState(false);
  const launcherRef = useRef(null);
  const chat = useChatSession(undefined, { persistKey: WIDGET_THREAD_KEY });

  // Closing always returns focus to the launcher and drops back to the chat
  // view, so Escape and the X button can't leave the widget in different
  // states. Declared before the effect that uses it (hoisted, but this reads
  // in the order it runs).
  function close() {
    setOpen(false);
    setView("chat");
    launcherRef.current?.focus();
  }

  // Escape closes the panel, matching the mobile drawer and Modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Mount → next frame → animate in. Without the frame gap the element is born
  // already in its final state and the transition never runs.
  useEffect(() => {
    if (!open) { setShown(false); return; }
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // A reply that lands while the panel is closed gets a dot on the launcher —
  // otherwise the answer arrives silently and the user never comes back.
  // seenRef starts unset so a RESTORED thread whose last message is already a
  // reply doesn't show a stale dot on every page load.
  const lastMessage = chat.messages[chat.messages.length - 1];
  const seenRef = useRef(undefined);
  useEffect(() => {
    const id = lastMessage?.id ?? null;
    const first = seenRef.current === undefined;
    seenRef.current = id;
    if (open) { setUnread(false); return; }
    if (!first && id && lastMessage?.role === "model") setUnread(true);
  }, [lastMessage?.id, open]);

  // The assistant is student-only (the edge function enforces this too), and
  // the launcher is pointless on the chatbot's own pages.
  if (currentUser?.role !== "Student") return null;
  if (path === "/chatbot" || path.startsWith("/chatbot/")) return null;

  // Hand the conversation to the full page. Passing the id keeps the thread —
  // /chatbot/:id loads its messages from the DB.
  function expand() {
    setOpen(false);
    setView("chat");
    navigate(chat.convId ? `/chatbot/${chat.convId}` : "/chatbot");
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
      {open && (
        <div
          id="chat-widget-panel"
          role="dialog"
          aria-label="AI Assistant"
          className={`fixed inset-0 flex flex-col overflow-hidden border-brd bg-surface shadow-2xl transition-all duration-200 sm:absolute sm:inset-auto sm:bottom-[4.5rem] sm:right-0 sm:h-[30rem] sm:max-h-[calc(100vh-8rem)] sm:w-[22rem] sm:rounded-2xl sm:border ${
            shown ? "opacity-100 sm:translate-y-0 sm:scale-100" : "opacity-0 sm:translate-y-2 sm:scale-95"
          }`}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-brd px-3 py-2.5">
            {view === "history" ? (
              <button
                onClick={() => setView("chat")}
                aria-label="Back to chat"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink-2"
              >
                <ArrowLeft size={16} />
              </button>
            ) : (
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <Sparkles size={16} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-ink">{view === "history" ? "Your chats" : "AI Assistant"}</p>
              {view === "chat" && <p className="truncate text-xs text-ink-3">Bus, prayer times, clubs, jobs, faculty…</p>}
            </div>
            {view === "chat" && (
              <>
                {chat.messages.length > 0 && (
                  <button
                    onClick={chat.reset}
                    disabled={chat.sending}
                    aria-label="New chat"
                    title="New chat"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink-2 disabled:opacity-50"
                  >
                    <SquarePen size={16} />
                  </button>
                )}
                <button
                  onClick={() => setView("history")}
                  aria-label="Chat history"
                  title="Chat history"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink-2"
                >
                  <History size={16} />
                </button>
                <button
                  onClick={expand}
                  aria-label="Open full page"
                  title="Open full page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink-2"
                >
                  <Maximize2 size={16} />
                </button>
              </>
            )}
            <button
              onClick={close}
              aria-label="Close assistant"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink-2"
            >
              <X size={16} />
            </button>
          </div>

          {view === "history" ? (
            <HistoryList
              activeId={chat.convId}
              onPick={(id) => { chat.openThread(id); setView("chat"); }}
            />
          ) : (
            <>
              <MessageList
                messages={chat.messages}
                streamText={chat.streamText}
                loadingHistory={chat.loadingHistory}
                emptyHint="Ask me anything about campus."
                onPickSuggestion={(s) => chat.send(s)}
              />
              <Composer
                text={chat.text}
                setText={chat.setText}
                image={chat.image}
                pickImage={chat.pickImage}
                clearImage={chat.clearImage}
                sending={chat.sending}
                send={chat.send}
                stop={chat.stop}
                compact
                autoFocus
              />
            </>
          )}
        </div>
      )}

      <button
        ref={launcherRef}
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? "Close assistant" : "Open AI Assistant"}
        aria-expanded={open}
        aria-controls="chat-widget-panel"
        title="AI Assistant"
        // Hidden on phones while the full-screen sheet is up — the sheet has
        // its own close button and the bubble would float on top of it.
        className={`relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-transform hover:scale-105 hover:brightness-110 active:scale-95 ${
          open ? "hidden sm:inline-flex" : "inline-flex"
        }`}
      >
        {open ? <X size={24} /> : <Sparkles size={24} />}
        {unread && !open && (
          <span className="absolute right-1 top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-danger ring-2 ring-surface" />
          </span>
        )}
      </button>
    </div>
  );
}

// Compact conversation list — same rows as the full history page, without the
// delete controls (destructive actions stay on the full page).
function HistoryList({ activeId, onPick }) {
  const { currentUser } = useApp();
  const [rows, setRows] = useState(null); // null = loading
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.from("chatbot_conversations").select("*").eq("user_id", currentUser.id)
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        setFailed(!!error);
        setRows(data || []);
      });
    return () => { active = false; };
  }, [currentUser.id]);

  if (rows === null) return <Loading className="flex-1" />;
  if (rows.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-ink-3">
        <MessageSquare size={24} />
        {/* A failed load must not read as "you have no chats". */}
        <p className="text-md">{failed ? "Couldn't load your chats." : "No past chats yet."}</p>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto p-2">
      {rows.map((c) => (
        <button
          key={c.id}
          onClick={() => onPick(c.id)}
          className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-2 ${
            c.id === activeId ? "bg-brand-50 text-brand" : "text-ink"
          }`}
        >
          <MessageSquare size={15} className="shrink-0 text-ink-3" />
          <span className="truncate text-base">{c.title || "Untitled chat"}</span>
        </button>
      ))}
    </div>
  );
}
