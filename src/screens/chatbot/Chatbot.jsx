import React, { useState } from "react";
import { ArrowLeft, Sparkles, History, Trash2 } from "lucide-react";
import { navigate, Link } from "../../lib/router.jsx";
import { supabase } from "../../lib/supabase.js";
import { AppShell } from "../../components/AppShell.jsx";
import { Card, Button, Modal, useToast } from "../../components/ui.jsx";
import { useChatSession, MessageList, Composer } from "./chatCore.jsx";

// Chatbot student-only gate lives server-side too (the edge function checks
// role itself), but the route/nav are gated here as well, same as every
// other student-only screen in this app.
//
// The conversation engine, transcript and composer are shared with the
// floating ChatWidget — see chatCore.jsx. This file is just the full-page
// framing around them (back button, history link, delete).
export default function Chatbot({ conversationId }) {
  const toast = useToast();
  const chat = useChatSession(conversationId);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function deleteThisConversation() {
    setConfirmDelete(false);
    if (!chat.convId) return;
    const { error } = await supabase.from("chatbot_conversations").delete().eq("id", chat.convId);
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
          {chat.convId && (
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

        <MessageList
          messages={chat.messages}
          streamText={chat.streamText}
          loadingHistory={chat.loadingHistory}
          emptyHint="Ask me anything about campus — bus routes, prayer times, clubs, jobs, faculty, or your CGPA."
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
        />
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
