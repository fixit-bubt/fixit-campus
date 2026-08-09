import React, { useState, useEffect } from "react";
import { ArrowLeft, Sparkles, Trash2, Plus } from "lucide-react";
import { useApp } from "../../data/store.jsx";
import { navigate } from "../../lib/router.jsx";
import { supabase } from "../../lib/supabase.js";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { Card, Button, EmptyState, Loading, Modal, useToast } from "../../components/ui.jsx";

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  try { return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" }); }
  catch { return ""; }
}

export default function ChatbotHistory() {
  const { currentUser } = useApp();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null); // conversation being confirmed for delete

  useEffect(() => {
    let active = true;
    supabase.from("chatbot_conversations").select("*").eq("user_id", currentUser.id)
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) toast({ type: "error", title: "Couldn't load history", message: error.message });
        setRows(data || []);
      });
    return () => { active = false; };
  }, [currentUser.id]);

  async function doDelete() {
    const c = confirmDel;
    if (!c) return;
    setConfirmDel(null);
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== c.id)); // optimistic — messages cascade-delete server-side
    const { error } = await supabase.from("chatbot_conversations").delete().eq("id", c.id);
    if (error) { setRows(prev); toast({ type: "error", title: "Couldn't delete", message: error.message }); }
  }

  return (
    <AppShell activeKey="chatbot" title="Chat History">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate("/chatbot")} aria-label="Back" className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2">
          <ArrowLeft size={18} />
        </button>
        <PageHeader
          title="Chat History"
          subtitle="Your past conversations with the AI assistant."
          action={<Button icon={Plus} onClick={() => navigate("/chatbot")}>New chat</Button>}
        />

        {rows === null ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyState icon={Sparkles} title="No conversations yet" message="Start a new chat with the AI assistant to see it here." />
        ) : (
          <Card className="divide-y divide-brd">
            {rows.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/chatbot/${c.id}`)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/chatbot/${c.id}`); } }}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                  <Sparkles size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{c.title || "New chat"}</p>
                  <p className="text-xs text-ink-3">{timeAgo(c.updated_at)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDel(c); }}
                  aria-label="Delete conversation"
                  className="shrink-0 rounded-md p-2 text-ink-3 hover:bg-danger-bg hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </Card>
        )}
      </div>

      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Delete this chat?"
        description="This conversation and all its messages will be permanently deleted. This can't be undone."
        icon={Trash2}
        tone="red"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDel(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doDelete}>Delete</Button>
          </>
        }
      />
    </AppShell>
  );
}
