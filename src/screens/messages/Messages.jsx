import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { Card, Avatar, Button, EmptyState, Loading, Textarea, Input, Modal, useToast } from "../../components/ui.jsx";
import {
  MessagesSquare, Search, MoreVertical, Pencil, Trash2, Ban,
  ArrowLeft, Send, Users, BookMarked,
} from "lucide-react";

// ============================================================================
// Messaging (migration 0081) — 1-to-1 DMs (accepted connections only) + auto
// group chats per club and per approved study section. Realtime via Supabase
// Broadcast; everything flows through useApp() (screens never touch Supabase).
// ============================================================================

// ---- small time helpers (ISO -> human) --------------------------------------
function clockOf(iso) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
  catch { return ""; }
}
// Local-time day key (not UTC slice): times render local, so day dividers must
// bucket local too — otherwise near midnight in UTC+6 they land on the wrong day.
function dayKeyOf(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dayLabelOf(iso) {
  const k = dayKeyOf(iso);
  const now = new Date();
  const y = new Date(); y.setDate(now.getDate() - 1);
  if (k === dayKeyOf(now)) return "Today";
  if (k === dayKeyOf(y)) return "Yesterday";
  try { return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); }
  catch { return k; }
}
function previewOf(m) {
  if (!m) return "No messages yet";
  if (m.deletedAt) return "Message removed";
  return m.body;
}

// Touch devices have no Shift key, so Enter must insert a newline there and the
// Send button is the only way to send. Desktop keeps Enter = send.
const IS_TOUCH = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(pointer: coarse)").matches
  : false;

// ---------------------------------------------------------------------------
// Conversations list
// ---------------------------------------------------------------------------
export function MessagesHome() {
  const {
    currentUser, userById, dmPartners, myClubs, studyMembers, studyIntakes, studySectionById,
    messages, unreadByConv, dataLoading,
  } = useApp();

  // Latest (non-optimistic-order-safe) message per conversation key.
  const lastByConv = useMemo(() => {
    const me = currentUser?.id;
    const map = {};
    for (const m of messages) {
      const key = m.kind === "dm"
        ? `dm:${m.peerLow === me ? m.peerHigh : m.peerLow}`
        : m.kind === "club" ? `club:${m.clubId}` : `section:${m.sectionId}`;
      const cur = map[key];
      if (!cur || new Date(m.createdAt) > new Date(cur.createdAt)) map[key] = m;
    }
    return map;
  }, [messages, currentUser?.id]);

  const rows = useMemo(() => {
    const me = currentUser?.id;
    const out = [];
    // DMs — accepted connections
    for (const pid of dmPartners) {
      const u = userById(pid);
      out.push({
        key: `dm:${pid}`, to: `/messages/dm/${pid}`, kind: "dm",
        title: u?.name || "Student", avatar: u?.avatar, name: u?.name || "Student",
      });
    }
    // Club chats — my active clubs
    for (const c of (myClubs() || [])) {
      out.push({ key: `club:${c.id}`, to: `/messages/club/${c.id}`, kind: "club", title: c.name });
    }
    // Section chats — my approved sections (a student may be in several)
    const mySecs = studyMembers.filter((m) => m.userId === me && m.status === "approved");
    for (const mem of mySecs) {
      const sec = studySectionById(mem.sectionId);
      if (!sec) continue;
      const intake = studyIntakes.find((i) => i.id === sec.intakeId);
      out.push({
        key: `section:${mem.sectionId}`, to: `/messages/section/${mem.sectionId}`, kind: "section",
        title: `Intake ${intake?.number ?? "?"} · Section ${sec.number}`,
      });
    }
    // attach last message + unread, then sort: most-recent first, empty threads last
    for (const r of out) { r.last = lastByConv[r.key] || null; r.unread = unreadByConv[r.key] || 0; }
    out.sort((a, b) => {
      if (a.last && b.last) return new Date(b.last.createdAt) - new Date(a.last.createdAt);
      if (a.last) return -1;
      if (b.last) return 1;
      return a.title.localeCompare(b.title);
    });
    return out;
  }, [currentUser?.id, dmPartners, myClubs, studyMembers, studyIntakes, studySectionById, lastByConv, unreadByConv]);

  return (
    <AppShell activeKey="messages" title="Messages">
      <PageHeader title="Messages" subtitle="Chat with your connections, clubs, and study sections." />
      {dataLoading && rows.length === 0 ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No conversations yet"
          message="Connect with students in the directory, or join a club or study section to start chatting."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button icon={Users} onClick={() => navigate("/students")}>Find students</Button>
              <Button variant="secondary" icon={Users} onClick={() => navigate("/clubs")}>Browse clubs</Button>
            </div>
          }
        />
      ) : (
        <Card className="divide-y divide-brd">
          {rows.map((r) => (
            <Link
              key={r.key}
              to={r.to}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
            >
              {r.kind === "dm" ? (
                <Avatar name={r.name} src={r.avatar} size={44} />
              ) : (
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                  {r.kind === "club" ? <Users size={20} /> : <BookMarked size={20} />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-bold text-ink">{r.title}</p>
                  {r.last && <span className="ml-auto shrink-0 text-xs text-ink-3">{clockOf(r.last.createdAt)}</span>}
                </div>
                <p className={`truncate text-md ${r.unread > 0 ? "font-semibold text-ink-2" : "text-ink-3"} ${r.last?.deletedAt ? "italic" : ""}`}>
                  {previewOf(r.last)}
                </p>
              </div>
              {r.unread > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold leading-none text-white">
                  {r.unread > 9 ? "9+" : r.unread}
                </span>
              )}
            </Link>
          ))}
        </Card>
      )}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// One conversation thread
// ---------------------------------------------------------------------------
export function MessageThread({ kind, id }) {
  const {
    currentUser, userById, clubById, clubMembersIn, userRoleIn, studySectionById, studyIntakes, studyMembers,
    dmPartners, messageThread, messageConvKey, sendMessage, editMessage, removeMessage,
    markConversationRead, blockUser, unblockUser, isBlocked, fetchOlderMessages, searchConversation,
    loadConversation, dataLoading,
  } = useApp();
  const toast = useToast();
  const me = currentUser?.id;

  // ---- access + header identity ----
  const access = useMemo(() => {
    if (kind === "dm") {
      const u = userById(id);
      return { ok: dmPartners.includes(id), title: u?.name || "Student", avatar: u?.avatar, name: u?.name || "Student" };
    }
    if (kind === "club") {
      const club = clubById(id);
      const member = (clubMembersIn(id) || []).some((m) => m.userId === me);
      return { ok: !!club && member, title: club?.name || "Club", club };
    }
    const sec = studySectionById(id);
    const member = studyMembers.some((m) => m.sectionId === id && m.userId === me && m.status === "approved");
    const intake = sec ? studyIntakes.find((i) => i.id === sec.intakeId) : null;
    return { ok: !!sec && member, title: sec ? `Intake ${intake?.number ?? "?"} · Section ${sec.number}` : "Section" };
  }, [kind, id, me, userById, dmPartners, clubById, clubMembersIn, studySectionById, studyMembers, studyIntakes]);

  const canModerate = useMemo(() => {
    if (kind === "club") return ["president", "vp", "editor"].includes(userRoleIn(id));
    if (kind === "section") return studyMembers.some((m) => m.sectionId === id && m.userId === me && m.role === "cr" && m.status === "approved");
    return false;
  }, [kind, id, me, userRoleIn, studyMembers]);

  const convKey = messageConvKey(kind, id);
  const thread = messageThread(kind, id);
  const iBlockedThem = kind === "dm" && isBlocked(id);

  // ---- composer ----
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  // ---- edit / delete modals ----
  const [editing, setEditing] = useState(null); // message being edited
  const [editText, setEditText] = useState("");
  const [confirmDel, setConfirmDel] = useState(null); // message pending delete
  // ---- search ----
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState(null); // null = not searched
  const searchSeq = useRef(0);
  const searchTimer = useRef(null);
  // ---- header menu (DM block) ----
  const [menuOpen, setMenuOpen] = useState(false);
  // ---- pagination ----
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // ---- scroll management (inner container, never the window) ----
  const listRef = useRef(null);
  const atBottomRef = useRef(true);
  const pendingOlderRef = useRef(null); // holds pre-fetch scrollHeight while prepending older msgs

  const lastMsg = thread.length ? thread[thread.length - 1] : null;
  const lastId = lastMsg ? lastMsg.id : null;

  function markReadHere() {
    if (access.ok && lastMsg) markConversationRead(convKey, lastMsg.createdAt);
  }

  function onScroll() {
    const el = listRef.current; if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    const entered = atBottom && !atBottomRef.current;
    atBottomRef.current = atBottom;
    if (entered) markReadHere(); // scrolling back to the newest clears unread
  }

  // Reset per-conversation UI when switching threads.
  useEffect(() => {
    setText(""); setSearchOpen(false); setSearchTerm(""); setSearchResults(null);
    setMenuOpen(false); setHasMore(true); atBottomRef.current = true; pendingOlderRef.current = null;
  }, [convKey]);

  // Fetch THIS conversation's newest page on open (the global slice may not
  // contain it). Seed hasMore from whether a full page came back.
  useEffect(() => {
    if (!access.ok) { setLoadingInitial(false); return; }
    let alive = true;
    setLoadingInitial(true);
    loadConversation(kind, id).then((res) => {
      if (!alive) return;
      setHasMore(res.ok && res.count >= 50);
      setLoadingInitial(false);
    });
    return () => { alive = false; };
  }, [convKey, access.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the viewport anchored: restore position after prepending older messages;
  // otherwise stick to the bottom only when the user was already near it.
  useLayoutEffect(() => {
    const el = listRef.current; if (!el) return;
    if (pendingOlderRef.current != null) {
      el.scrollTop = el.scrollHeight - pendingOlderRef.current;
      pendingOlderRef.current = null;
      return;
    }
    if (atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [thread.length, convKey]);

  // Mark read only when the newest message is actually in view (at the bottom) —
  // never while the user is scrolled up reading history.
  useEffect(() => {
    if (!access.ok || !lastId) return;
    if (atBottomRef.current) markReadHere();
  }, [lastId, convKey, access.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!access.ok) {
    // While the store's initial load is still in flight, membership isn't known
    // yet — show a spinner rather than flashing "unavailable" for a valid thread.
    return (
      <AppShell activeKey="messages" title="Messages">
        {dataLoading ? (
          <Loading />
        ) : (
          <EmptyState
            icon={MessagesSquare}
            title="Conversation unavailable"
            message="You don't have access to this conversation, or it no longer exists."
            action={<Button icon={ArrowLeft} onClick={() => navigate("/messages")}>Back to Messages</Button>}
          />
        )}
      </AppShell>
    );
  }

  async function doSend() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    atBottomRef.current = true; // sending scrolls us to the newest
    const res = await sendMessage(kind, id, body);
    setSending(false);
    if (res.ok) { setText(""); markReadHere(); }
    else toast?.({ type: "error", title: res.error || "Couldn't send message." });
  }

  function onComposerKey(e) {
    if (e.key === "Enter" && !e.shiftKey && !IS_TOUCH) { e.preventDefault(); doSend(); }
  }

  async function loadOlder() {
    if (loadingOlder || !thread.length) return;
    setLoadingOlder(true);
    const el = listRef.current;
    pendingOlderRef.current = el ? el.scrollHeight : null;
    const oldest = thread[0].createdAt;
    const res = await fetchOlderMessages(kind, id, oldest);
    setLoadingOlder(false);
    if (!res.ok || res.count < 50) setHasMore(false);
    // If the fetch added no rows (empty result / all duplicates), the scroll-
    // restore layout effect won't fire — clear the pending marker after the
    // render settles so a later incoming message doesn't misfire it.
    requestAnimationFrame(() => { pendingOlderRef.current = null; });
  }

  async function saveEdit() {
    const res = await editMessage(editing.id, editText);
    if (res.ok) setEditing(null);
    else toast?.({ type: "error", title: res.error || "Couldn't edit message." });
  }

  async function doDelete() {
    const res = await removeMessage(confirmDel.id);
    setConfirmDel(null);
    if (!res.ok) toast?.({ type: "error", title: res.error || "Couldn't remove message." });
  }

  // Debounced + sequenced so rapid typing doesn't spam queries or let a stale
  // (slower) response overwrite a newer one.
  function runSearch(term) {
    setSearchTerm(term);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!term.trim()) { setSearchResults(null); return; }
    const seq = ++searchSeq.current;
    searchTimer.current = setTimeout(async () => {
      const res = await searchConversation(kind, id, term);
      if (seq === searchSeq.current) setSearchResults(res);
    }, 300);
  }

  async function toggleBlock() {
    setMenuOpen(false);
    if (iBlockedThem) { await unblockUser(id); }
    else {
      const res = await blockUser(id);
      if (!res.ok) toast?.({ type: "error", title: res.error || "Couldn't block user." });
    }
  }

  const isGroup = kind !== "dm";

  return (
    <AppShell activeKey="messages" title="Messages">
      <Card className="flex flex-col h-[calc(100vh-8.5rem)] sm:h-[calc(100vh-11rem)]">
        {/* header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-brd px-4 py-3">
          <button onClick={() => navigate("/messages")} aria-label="Back" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2">
            <ArrowLeft size={18} />
          </button>
          {kind === "dm" ? (
            <Avatar name={access.name} src={access.avatar} size={38} />
          ) : (
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              {kind === "club" ? <Users size={18} /> : <BookMarked size={18} />}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-ink">{access.title}</p>
            {isGroup && <p className="truncate text-xs text-ink-3">Group chat</p>}
          </div>
          <button onClick={() => setSearchOpen((s) => !s)} aria-label="Search conversation" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2">
            <Search size={18} />
          </button>
          {kind === "dm" && (
            <div className="relative">
              <button onClick={() => setMenuOpen((s) => !s)} aria-label="More" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2">
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-brd bg-surface shadow-lg">
                    <button onClick={toggleBlock} className="flex w-full items-center gap-2 px-3 py-2 text-md text-ink-2 hover:bg-surface-2">
                      <Ban size={15} /> {iBlockedThem ? "Unblock user" : "Block user"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* search bar */}
        {searchOpen && (
          <div className="shrink-0 border-b border-brd bg-surface-2 px-4 py-2">
            <Input
              autoFocus
              value={searchTerm}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="Search this conversation…"
              className="h-10"
            />
          </div>
        )}

        {/* body: search results OR the thread */}
        {searchResults !== null ? (
          <div className="flex-1 overflow-y-auto p-4">
            {searchResults.length === 0 ? (
              <p className="py-8 text-center text-md text-ink-3">No messages match “{searchTerm}”.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{searchResults.length} result{searchResults.length === 1 ? "" : "s"}</p>
                {searchResults.map((m) => (
                  <div key={m.id} className="rounded-md border border-brd bg-surface p-3">
                    <div className="flex items-center gap-2 text-xs text-ink-3">
                      <span className="font-semibold text-ink-2">{m.senderId === me ? "You" : (userById(m.senderId)?.name || "Unknown")}</span>
                      <span>· {dayLabelOf(m.createdAt)} {clockOf(m.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-md text-ink whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-3">
            {hasMore && thread.length > 0 && (
              <div className="mb-3 text-center">
                <Button size="sm" variant="secondary" loading={loadingOlder} onClick={loadOlder}>Load older messages</Button>
              </div>
            )}
            {thread.length === 0 ? (
              loadingInitial ? (
                <Loading />
              ) : (
                <p className="py-10 text-center text-md text-ink-3">No messages yet. Say hello 👋</p>
              )
            ) : (
              thread.map((m, i) => {
                const prev = thread[i - 1];
                const showDay = !prev || dayKeyOf(prev.createdAt) !== dayKeyOf(m.createdAt);
                return (
                  <React.Fragment key={m.id}>
                    {showDay && (
                      <div className="my-3 flex items-center justify-center">
                        <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-3">{dayLabelOf(m.createdAt)}</span>
                      </div>
                    )}
                    <Bubble
                      m={m}
                      mine={m.senderId === me}
                      isGroup={isGroup}
                      senderName={m.senderId === me ? "You" : (userById(m.senderId)?.name || "Unknown")}
                      senderAvatar={userById(m.senderId)?.avatar}
                      canModerate={canModerate}
                      onEdit={() => { setEditing(m); setEditText(m.body); }}
                      onDelete={() => setConfirmDel(m)}
                    />
                  </React.Fragment>
                );
              })
            )}
          </div>
        )}

        {/* composer */}
        <div className="shrink-0 border-t border-brd p-3">
          {iBlockedThem ? (
            <div className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2 text-md text-ink-2">
              <span>You blocked this user.</span>
              <Button size="sm" variant="secondary" onClick={() => unblockUser(id)}>Unblock</Button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <Textarea
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 4000))}
                onKeyDown={onComposerKey}
                placeholder="Type a message…"
                className="max-h-32 min-h-[2.75rem] flex-1"
              />
              <Button icon={Send} loading={sending} disabled={!text.trim()} onClick={doSend} className="shrink-0">
                <span className="hidden sm:inline">Send</span>
              </Button>
            </div>
          )}
          {text.length > 3600 && <p className="mt-1 text-right text-xs text-ink-3">{text.length}/4000</p>}
        </div>
      </Card>

      {/* edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit message"
        icon={Pencil}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={!editText.trim()}>Save</Button>
          </>
        }
      >
        <Textarea rows={3} value={editText} onChange={(e) => setEditText(e.target.value.slice(0, 4000))} autoFocus />
      </Modal>

      {/* delete confirm */}
      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Remove message?"
        description="This message will be replaced with “Message removed”. This can't be undone."
        icon={Trash2}
        tone="red"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDel(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doDelete}>Remove</Button>
          </>
        }
      />
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// One message bubble
// ---------------------------------------------------------------------------
function Bubble({ m, mine, isGroup, senderName, senderAvatar, canModerate, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);
  const deleted = !!m.deletedAt;
  const canEdit = mine && !deleted;
  const canRemove = !deleted && (mine || canModerate);
  const removedByMod = deleted && m.deletedBy && m.deletedBy !== m.senderId;
  // Touch devices have no hover — keep the action buttons visible there.
  const showCtrls = hover || IS_TOUCH;

  return (
    <div
      className={`group flex gap-2 py-1 ${mine ? "justify-end" : "justify-start"}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {!mine && isGroup && (
        <Avatar name={senderName === "Unknown" ? "" : senderName} src={senderAvatar} size={30} className="mt-4" />
      )}
      <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
        {!mine && isGroup && <span className="px-1 text-xs font-semibold text-ink-3">{senderName}</span>}
        <div className="flex items-center gap-1">
          {mine && !deleted && (canEdit || canRemove) && (
            <div className={`flex items-center gap-0.5 transition-opacity ${showCtrls ? "opacity-100" : "opacity-0"}`}>
              {canEdit && <button onClick={onEdit} aria-label="Edit" className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-3 hover:bg-surface-2"><Pencil size={14} /></button>}
              {canRemove && <button onClick={onDelete} aria-label="Remove" className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-3 hover:bg-surface-2"><Trash2 size={14} /></button>}
            </div>
          )}
          <div
            className={`rounded-2xl px-3.5 py-2 text-md leading-relaxed break-words whitespace-pre-wrap ${
              deleted
                ? "bg-surface-2 italic text-ink-3"
                : mine
                ? "bg-brand text-white"
                : "bg-surface-2 text-ink"
            }`}
          >
            {deleted ? (removedByMod ? "Message removed by a moderator" : "Message removed") : m.body}
          </div>
          {!mine && !deleted && canModerate && (
            <button onClick={onDelete} aria-label="Remove" className={`inline-flex h-7 w-7 items-center justify-center rounded text-ink-3 hover:bg-surface-2 transition-opacity ${showCtrls ? "opacity-100" : "opacity-0"}`}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
        <span className="px-1 pt-0.5 text-[11px] text-ink-3">
          {clockOf(m.createdAt)}{m.editedAt && !deleted ? " · edited" : ""}{m.pending ? " · sending…" : ""}
        </span>
      </div>
    </div>
  );
}
