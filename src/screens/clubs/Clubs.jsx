import React, { useState, useEffect } from "react";
import {
  UsersRound, Pin, Paperclip, Plus, ArrowRight, Pencil, Trash2,
  Crown, UserMinus, UserPlus, ChevronDown, Search, X,
  FileText, MoreHorizontal, LogOut, Settings,
} from "lucide-react";
import {
  Button, Card, Badge, Field, Input, Textarea, Select, FileUpload,
  EmptyState, Modal, Avatar, Spinner, Loading, useToast,
} from "../../components/ui.jsx";
import { AppShell, PageHeader } from "../../components/AppShell.jsx";
import { AccentTile } from "../../components/featureKit.jsx";
import { useApp } from "../../data/store.jsx";
import { navigate, Link } from "../../lib/router.jsx";
import { relativeDate } from "../../lib/helpers.js";

// ============================================================================
// Club Hub  (signature accent: purple)
// Private operational home for BUBT's student clubs. Membership is officer-
// managed (offline recruitment → officers add members). Non-members see nothing.
// Roles: president | vp | editor | member
// ============================================================================

const CATEGORIES = ["Tech", "Cultural", "Sports", "Professional", "Social"];

const CATEGORY_TONE = {
  Tech: "blue", Cultural: "amber", Sports: "emerald",
  Professional: "violet", Social: "rose",
};

const ROLE_LABEL = { president: "President", vp: "Vice President", editor: "Editor", member: "Member" };
const ROLE_TONE  = { president: "purple", vp: "blue", editor: "teal", member: "slate" };

// useApp()'s toast is a bare push fn — wrap it so call sites read clearly.
function useToasts() {
  const toast = useToast();
  return {
    success: (title, message) => toast({ type: "success", title, message }),
    error: (title, message) => toast({ type: "error", title, message }),
  };
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function ClubBanner({ club, className = "" }) {
  const gradients = {
    Tech:         "from-blue-600 to-purple-700",
    Cultural:     "from-amber-500 to-orange-600",
    Sports:       "from-emerald-500 to-teal-600",
    Professional: "from-violet-600 to-purple-700",
    Social:       "from-rose-500 to-pink-600",
  };
  if (club.coverUrl) {
    return <img src={club.coverUrl} alt={club.name} className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br ${gradients[club.category] || "from-purple-600 to-purple-800"} ${className}`}>
      <UsersRound size={36} className="text-white/40" />
    </div>
  );
}

function RoleBadge({ role }) {
  if (!role) return null;
  return <Badge tone={ROLE_TONE[role] || "slate"}>{ROLE_LABEL[role] || role}</Badge>;
}

// Post images live in the PRIVATE club-attachments bucket (member-only). Resolve
// the stored path to a short-lived signed URL before rendering.
function ClubImage({ path }) {
  const { getClubFileUrl } = useApp();
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let on = true;
    getClubFileUrl(path).then((u) => { if (on) setUrl(u || null); }).catch(() => { if (on) setFailed(true); });
    return () => { on = false; };
  }, [path]);
  if (failed) return null;
  if (!url) return <div className="mt-3 h-40 w-full animate-pulse rounded-lg bg-slate-100" />;
  return <img src={url} alt="" onError={() => setFailed(true)} className="mt-3 w-full rounded-lg object-cover max-h-64 border border-slate-100" />;
}

// ── Download attachment button ─────────────────────────────────────────────
function AttachmentButton({ fileUrl, fileName }) {
  const { getClubFileUrl } = useApp();
  const toast = useToasts();
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const url = await getClubFileUrl(fileUrl);
      if (!url) { toast.error("Could not load file."); return; }
      const a = document.createElement("a");
      a.href = url; a.download = fileName || "attachment"; a.click();
    } finally { setLoading(false); }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
    >
      {loading ? <Spinner size={12} /> : <Paperclip size={12} />}
      {fileName || "Attachment"}
    </button>
  );
}

// ── Post card ──────────────────────────────────────────────────────────────
function PostCard({ post, clubId, onEdit, onDelete, onPin }) {
  const { userById, currentUser, clubMembersIn, canPostIn, canManageClub } = useApp();
  const author = userById(post.authorId);
  const authorRole = clubMembersIn(clubId).find((m) => m.userId === post.authorId)?.role;
  const mine   = post.authorId === currentUser?.id;
  // Mirrors RLS (migration 0054): edit/pin = own post as officer, or president/VP
  // for any post; delete = own post, or president/VP.
  const canEdit = (mine && canPostIn(clubId)) || canManageClub(clubId);
  const canDel  = mine || canManageClub(clubId);
  const canPin  = canEdit;

  return (
    <div className={`rounded-lg border bg-white ${post.isPinned ? "border-l-4 border-l-amber-400 border-slate-200 bg-amber-50/20" : "border-slate-200"} shadow-sm`}>
      <div className="p-4">
        {/* header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={author?.name || "?"} size={32} src={author?.avatar} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-medium text-slate-900 truncate">{author?.name || "Unknown"}</span>
                <RoleBadge role={authorRole} />
              </div>
              <p className="text-xs text-slate-400">{relativeDate(post.createdAt)}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {post.isPinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                <Pin size={10} /> Pinned
              </span>
            )}
            {(canPin || canEdit || canDel) && (
              <PostMenu
                isPinned={post.isPinned}
                canEdit={canEdit} canDel={canDel} canPin={canPin}
                onEdit={onEdit} onDelete={onDelete} onPin={onPin}
              />
            )}
          </div>
        </div>

        {/* content */}
        <div className="mt-3">
          <p className="text-sm font-semibold text-slate-900">{post.title}</p>
          {post.body && (
            <p className="mt-1 text-sm text-slate-600 whitespace-pre-line line-clamp-4">{post.body}</p>
          )}
        </div>

        {/* image (private — resolved to a signed URL) */}
        {post.imageUrl && <ClubImage path={post.imageUrl} />}

        {/* attachment */}
        {post.fileUrl && (
          <div className="mt-3">
            <AttachmentButton fileUrl={post.fileUrl} fileName={post.fileName} />
          </div>
        )}
      </div>
    </div>
  );
}

function PostMenu({ isPinned, canEdit, canDel, canPin, onEdit, onDelete, onPin }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 min-w-[150px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {canPin && (
              <button onClick={() => { onPin(); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                <Pin size={14} /> {isPinned ? "Unpin" : "Pin"}
              </button>
            )}
            {canEdit && (
              <button onClick={() => { onEdit(); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                <Pencil size={14} /> Edit
              </button>
            )}
            {canDel && (
              <button onClick={() => { onDelete(); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Add Members modal ──────────────────────────────────────────────────────
function AddMembersModal({ clubId, existingUserIds, onClose }) {
  const { users, addClubMembers } = useApp();
  const toast = useToasts();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  // Officers load `users` from public_profiles, which exposes name/dept but NOT
  // email — so search + display are name/department based.
  const eligible = users.filter(
    (u) =>
      u.role === "Student" &&
      !existingUserIds.has(u.id) &&
      (query.trim() === "" || (u.name ?? "").toLowerCase().includes(query.toLowerCase()))
  );

  const toggle = (u) =>
    setSelected((s) => (s.find((x) => x.id === u.id) ? s.filter((x) => x.id !== u.id) : [...s, u]));

  async function handleAdd() {
    if (saving || !selected.length) return;
    setSaving(true);
    try {
      const { ok, error } = await addClubMembers(clubId, selected.map((u) => u.id));
      if (!ok) { toast.error("Couldn't add members", error); return; }
      toast.success(`${selected.length} member${selected.length > 1 ? "s" : ""} added.`);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="Add Members" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search students by name"
            placeholder="Search students by name…"
            className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
          />
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((u) => (
              <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                {u.name}
                <button onClick={() => toggle(u)} className="ml-0.5 hover:text-purple-900"><X size={11} /></button>
              </span>
            ))}
          </div>
        )}

        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
          {eligible.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">{query ? "No students match." : "All students are already members."}</p>
          ) : (
            eligible.slice(0, 40).map((u) => {
              const isSelected = selected.some((x) => x.id === u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggle(u)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${isSelected ? "bg-purple-50" : "hover:bg-slate-50"}`}
                >
                  <Avatar name={u.name} size={30} src={u.avatar} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                    {u.dept && <p className="text-xs text-slate-400 truncate">{u.dept}</p>}
                  </div>
                  {isSelected && <div className="h-4 w-4 rounded-full bg-purple-600 flex items-center justify-center"><svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5 1 6.5l4 4 6-7z"/></svg></div>}
                </button>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleAdd}
            disabled={!selected.length}
            loading={saving}
            className="bg-purple-600 text-white hover:bg-purple-700"
          >
            Add {selected.length > 0 ? `${selected.length} member${selected.length > 1 ? "s" : ""}` : "members"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Club card (used in MyClubs grid) ──────────────────────────────────────
function ClubCard({ club, role }) {
  return (
    <button
      onClick={() => navigate(`/clubs/${club.id}`)}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-purple-300 hover:shadow-md text-left"
    >
      <ClubBanner club={club} className="h-28 w-full" />
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <Badge tone={CATEGORY_TONE[club.category] || "slate"}>{club.category}</Badge>
          {role && <RoleBadge role={role} />}
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-900 group-hover:text-purple-700 transition-colors line-clamp-1">{club.name}</p>
        {club.tagline && <p className="text-xs text-slate-500 line-clamp-1">{club.tagline}</p>}
      </div>
    </button>
  );
}

// ============================================================================
// Screen 1 — My Clubs  (/clubs)
// ============================================================================
export function ClubsHome() {
  const { myClubs, userRoleIn, dataLoading } = useApp();
  const clubs = myClubs();

  return (
    <AppShell activeKey="clubs" title="Clubs">
      <PageHeader title="My Clubs" subtitle="Your student club memberships." />

      {dataLoading ? (
        <Loading />
      ) : clubs.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="You're not in any clubs yet"
          message="Club membership is by invitation. Once a club officer adds you, your clubs will appear here."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => (
            <ClubCard key={club.id} club={club} role={userRoleIn(club.id)} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

// ============================================================================
// Screen 2 — Club Home  (/clubs/:id)
// ============================================================================
export function ClubHome({ id }) {
  const {
    clubById, clubMembersIn, clubPostsIn, userRoleIn, canPostIn, canManageClub,
    facultyById, deleteClubPost, toggleClubPin, dataLoading,
  } = useApp();
  const toast = useToasts();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const club = clubById(id);
  const myRole = userRoleIn(id);

  if (dataLoading) return <AppShell activeKey="clubs" title="Club"><Loading /></AppShell>;
  if (!club) return <AppShell activeKey="clubs" title="Club"><EmptyState icon={UsersRound} title="Club not found" message="This club does not exist or you are not a member." /></AppShell>;
  if (!myRole) {
    return (
      <AppShell activeKey="clubs" title={club.name}>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ClubBanner club={club} className="h-40 w-full" />
          <div className="p-6 text-center">
            <h2 className="text-lg font-semibold text-slate-900">{club.name}</h2>
            <div className="mt-2 flex justify-center"><Badge tone={CATEGORY_TONE[club.category]}>{club.category}</Badge></div>
            <p className="mt-4 text-sm text-slate-500">Club membership is by invitation only. Speak to a club officer to join.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const posts = clubPostsIn(id);
  const members = clubMembersIn(id);
  const advisor = club.facultyAdvisorId ? facultyById?.(club.facultyAdvisorId) : null;

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const { ok, error } = await deleteClubPost(deleteTarget);
      if (!ok) toast.error("Couldn't delete", error); else toast.success("Post deleted.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  async function handlePin(postId) {
    const { ok, error } = await toggleClubPin(postId);
    if (!ok) toast.error("Couldn't pin", error);
  }

  return (
    <AppShell activeKey="clubs" title={club.name}>
      {/* Banner + identity */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ClubBanner club={club} className="h-44 w-full" />
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900">{club.name}</h1>
                <Badge tone={CATEGORY_TONE[club.category]}>{club.category}</Badge>
                <RoleBadge role={myRole} />
              </div>
              {club.tagline && <p className="mt-0.5 text-sm text-slate-500">{club.tagline}</p>}
            </div>
            <Link to={`/clubs/${id}/members`} className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700">
              <UsersRound size={15} /> {members.length} members
            </Link>
          </div>

          {/* Meta chips */}
          {advisor && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => navigate(`/faculty/${advisor.id}`)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100">
                <span className="h-4 w-4 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-[10px] font-bold">F</span>
                {advisor.name}
              </button>
            </div>
          )}

          {/* Collapsible about */}
          {club.about && (
            <div className="mt-3">
              <button
                onClick={() => setAboutOpen((o) => !o)}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                <ChevronDown size={13} className={`transition-transform ${aboutOpen ? "rotate-180" : ""}`} />
                {aboutOpen ? "Hide description" : "About this club"}
              </button>
              {aboutOpen && <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">{club.about}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Posts feed */}
      <div className="relative mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Announcements</h2>
          {canPostIn(id) && (
            <Button icon={Plus} onClick={() => navigate(`/clubs/${id}/post/new`)} className="bg-purple-600 text-white hover:bg-purple-700">
              New Post
            </Button>
          )}
        </div>

        {posts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No announcements yet"
            message={canPostIn(id) ? "Post the first announcement for this club." : "Club officers haven't posted anything yet."}
            action={canPostIn(id) && <Button icon={Plus} onClick={() => navigate(`/clubs/${id}/post/new`)} className="bg-purple-600 text-white hover:bg-purple-700">New Post</Button>}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                clubId={id}
                onEdit={() => navigate(`/clubs/${id}/post/${post.id}/edit`)}
                onDelete={() => setDeleteTarget(post.id)}
                onPin={() => handlePin(post.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Manage shortcut for officers */}
      {canManageClub(id) && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => navigate(`/clubs/${id}/manage`)}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
          >
            <Settings size={14} /> Club settings
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <Modal open title="Delete post?" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm text-slate-600">This post will be permanently removed. This cannot be undone.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button onClick={handleDelete} loading={deleting} className="bg-red-600 text-white hover:bg-red-700">Delete</Button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

// ============================================================================
// Screen 3 — Club Members  (/clubs/:id/members)
// ============================================================================
export function ClubMembers({ id }) {
  const {
    clubById, clubMembersIn, userRoleIn, canManageClub, isPresident,
    updateClubMemberRole, removeClubMember, leaveClub, dataLoading, currentUser,
  } = useApp();
  const toast = useToasts();
  const [showAdd, setShowAdd] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [saving, setSaving] = useState(null);

  const club = clubById(id);
  const myRole = userRoleIn(id);

  if (dataLoading) return <AppShell activeKey="clubs" title="Members"><Loading /></AppShell>;
  if (!club || !myRole) return <AppShell activeKey="clubs" title="Members"><EmptyState icon={UsersRound} title="Not found" message="Club not found or you are not a member." /></AppShell>;

  const members = clubMembersIn(id);
  const existingIds = new Set(members.map((m) => m.userId));
  const officers = members.filter((m) => ["president", "vp", "editor"].includes(m.role));
  const regular  = members.filter((m) => m.role === "member");

  // Only the president can change roles (matches club_members_update RLS), and
  // never to/from president here — handover is admin-only via Manage Clubs.
  const roleOptions = [
    { value: "member", label: "Member" },
    { value: "editor", label: "Editor" },
    { value: "vp",     label: "Vice President" },
  ];

  async function handleRoleChange(userId, role) {
    if (saving) return;
    setSaving(userId);
    try {
      const { ok, error } = await updateClubMemberRole(id, userId, role);
      if (!ok) toast.error("Couldn't change role", error);
    } finally {
      setSaving(null);
    }
  }
  async function handleRemove() {
    if (saving || !removeTarget) return;
    setSaving(removeTarget);
    try {
      const isSelf = removeTarget === currentUser?.id;
      const { ok, error } = isSelf ? await leaveClub(id) : await removeClubMember(id, removeTarget);
      setRemoveTarget(null);
      if (!ok) toast.error("Action failed", error);
      else if (isSelf) navigate("/clubs");
    } finally {
      setSaving(null);
    }
  }

  // self: may leave unless president · others: managers may remove non-presidents
  const rowCanRemove = (m) =>
    m.userId === currentUser.id ? myRole !== "president" : (canManageClub(id) && m.role !== "president");

  return (
    <AppShell activeKey="clubs" title="Members">
      <PageHeader
        title={`${club.name} — Members`}
        subtitle={`${members.length} member${members.length !== 1 ? "s" : ""}`}
        action={
          <div className="flex gap-2">
            {canManageClub(id) && (
              <Button icon={UserPlus} onClick={() => setShowAdd(true)} className="bg-purple-600 text-white hover:bg-purple-700">
                Add Members
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate(`/clubs/${id}`)}>← Club</Button>
          </div>
        }
      />

      {/* Officers */}
      {officers.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Officers</h3>
          <div className="flex flex-col gap-2">
            {officers.map((m) => (
              <MemberRow
                key={m.id} member={m}
                isMe={m.userId === currentUser.id}
                canChangeRole={isPresident(id) && m.userId !== currentUser.id}
                canRemove={rowCanRemove(m)}
                roleOptions={roleOptions}
                saving={saving === m.userId}
                onRoleChange={(role) => handleRoleChange(m.userId, role)}
                onRemove={() => setRemoveTarget(m.userId)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Members */}
      {regular.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Members ({regular.length})</h3>
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {regular.map((m) => (
              <MemberRow
                key={m.id} member={m}
                isMe={m.userId === currentUser.id}
                canChangeRole={isPresident(id) && m.userId !== currentUser.id}
                canRemove={rowCanRemove(m)}
                roleOptions={roleOptions}
                saving={saving === m.userId}
                onRoleChange={(role) => handleRoleChange(m.userId, role)}
                onRemove={() => setRemoveTarget(m.userId)}
              />
            ))}
          </Card>
        </section>
      )}

      {members.length === 0 && (
        <EmptyState icon={UsersRound} title="No members yet" message="Add members to get started." />
      )}

      {/* Leave club (own row) */}
      {myRole && myRole !== "president" && (
        <div className="mt-8 border-t border-slate-200 pt-6">
          <button
            onClick={() => setRemoveTarget(currentUser.id)}
            className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700"
          >
            <LogOut size={14} /> Leave this club
          </button>
        </div>
      )}

      {/* Add Members modal */}
      {showAdd && (
        <AddMembersModal clubId={id} existingUserIds={existingIds} onClose={() => setShowAdd(false)} />
      )}

      {/* Remove/leave confirmation */}
      {removeTarget && (
        <Modal open title={removeTarget === currentUser.id ? "Leave club?" : "Remove member?"} onClose={() => setRemoveTarget(null)}>
          <p className="text-sm text-slate-600">
            {removeTarget === currentUser.id
              ? "You will lose access to this club's posts and will need to be re-added by an officer."
              : "This member will lose access to the club."}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button onClick={handleRemove} loading={saving === removeTarget} className="bg-red-600 text-white hover:bg-red-700">
              {removeTarget === currentUser.id ? "Leave" : "Remove"}
            </Button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

function MemberRow({ member, isMe, canChangeRole, canRemove, roleOptions, saving, onRoleChange, onRemove }) {
  const { userById } = useApp();
  const user = userById(member.userId);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar name={user?.name || "?"} size={36} src={user?.avatar} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 truncate">
          {user?.name || "Unknown"}{isMe && <span className="ml-1 text-xs text-slate-400">(you)</span>}
        </p>
        {user?.dept && <p className="text-xs text-slate-400 truncate">{user.dept}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {saving ? (
          <Spinner size={16} />
        ) : canChangeRole ? (
          <select
            value={member.role}
            onChange={(e) => onRoleChange(e.target.value)}
            className="rounded-md border border-slate-200 py-1 pl-2 pr-6 text-xs text-slate-700 outline-none focus:border-purple-400"
          >
            {roleOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <RoleBadge role={member.role} />
        )}
        {canRemove && (
          <button onClick={onRemove} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-300 hover:bg-red-50 hover:text-red-500">
            <UserMinus size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Screen 4 — Post Form  (/clubs/:id/post/new  &  /clubs/:id/post/:postId/edit)
// ============================================================================
export function ClubPostForm({ id, postId }) {
  const { clubById, clubPostsIn, addClubPost, updateClubPost, userRoleIn, canPostIn, getClubFileUrl, dataLoading } = useApp();
  const toast = useToasts();

  const isEdit = !!postId;
  const club = clubById(id);
  const existing = isEdit ? clubPostsIn(id).find((p) => p.id === postId) : null;

  const [form, setForm] = useState({
    title:          existing?.title    || "",
    body:           existing?.body     || "",
    isPinned:       existing?.isPinned || false,
    imageFile:      null,
    imagePreview:   null, // resolved signed URL for an existing image, or a blob: URL for a new pick
    hadImage:       isEdit && !!existing?.imageUrl,
    attachmentFile: null,
    attachmentName: existing?.fileName || null,
    hadAttachment:  isEdit && !!existing?.fileName,
  });
  const [saving, setSaving] = useState(false);

  // Resolve the existing (private) post image to a signed URL for the preview.
  useEffect(() => {
    let on = true;
    if (isEdit && existing?.imageUrl) {
      getClubFileUrl(existing.imageUrl).then((u) => {
        if (on && u) setForm((f) => (f.imageFile || f.imagePreview ? f : { ...f, imagePreview: u }));
      });
    }
    return () => { on = false; };
  }, [existing?.imageUrl]);

  if (dataLoading) return <AppShell activeKey="clubs" title="Post"><Loading /></AppShell>;
  if (!club || !canPostIn(id)) return <AppShell activeKey="clubs" title="Post"><EmptyState icon={FileText} title="Not allowed" message="You don't have permission to post here." /></AppShell>;
  if (isEdit && !existing) {
    return (
      <AppShell activeKey="clubs" title="Post">
        <EmptyState
          icon={FileText} title="Post not found"
          message="This post may have been deleted, or you don't have access to it."
          action={<Button onClick={() => navigate(`/clubs/${id}`)} className="bg-purple-600 text-white hover:bg-purple-700">Back to club</Button>}
        />
      </AppShell>
    );
  }

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (saving || !form.title.trim()) { if (!form.title.trim()) toast.error("Title is required."); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title, body: form.body, isPinned: form.isPinned,
        imageFile: form.imageFile, attachmentFile: form.attachmentFile,
        // removal intent (edit mode): had a file, now cleared, with no replacement
        removeImage:      isEdit && form.hadImage && !form.imageFile && !form.imagePreview,
        removeAttachment: isEdit && form.hadAttachment && !form.attachmentFile && !form.attachmentName,
        clubId: id,
      };
      const result = isEdit
        ? await updateClubPost(postId, payload)
        : await addClubPost(id, payload);
      if (!result.ok) { toast.error("Couldn't save post", result.error); return; }
      toast.success(isEdit ? "Post updated." : "Post published.");
      navigate(`/clubs/${id}`);
    } finally {
      setSaving(false);
    }
  }

  const myRole = userRoleIn(id);

  return (
    <AppShell activeKey="clubs" title={isEdit ? "Edit Post" : "New Post"}>
      <PageHeader
        title={isEdit ? "Edit Post" : "New Announcement"}
        subtitle={club.name}
        action={<Button variant="secondary" onClick={() => navigate(`/clubs/${id}`)}>Cancel</Button>}
      />

      <div className="max-w-2xl space-y-4">
        <Field label="Title" required>
          <Input value={form.title} onChange={(e) => set("title")(e.target.value)} placeholder="What's this about?" />
        </Field>

        <Field label="Body" hint="Optional — add details, instructions, or context.">
          <Textarea
            value={form.body}
            onChange={(e) => set("body")(e.target.value)}
            rows={5}
            placeholder="Write something…"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Image" hint="Optional cover image.">
            <FileUpload
              value={form.imagePreview}
              onChange={(url, file) => setForm((f) => ({ ...f, imageFile: file, imagePreview: url }))}
            />
          </Field>

          <Field label="Attachment" hint="PDF, DOCX, or similar.">
            <div className="flex flex-col gap-2">
              {form.attachmentName && !form.attachmentFile && (
                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <Paperclip size={14} className="text-slate-400" />
                  <span className="flex-1 truncate text-sm text-slate-600">{form.attachmentName}</span>
                  <button onClick={() => setForm((f) => ({ ...f, attachmentName: null }))} className="text-slate-300 hover:text-slate-500"><X size={14} /></button>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setForm((f) => ({ ...f, attachmentFile: file, attachmentName: file.name }));
                }}
                className="text-sm text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-purple-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-purple-700 hover:file:bg-purple-100"
              />
            </div>
          </Field>
        </div>

        {["president", "vp", "editor"].includes(myRole) && (
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={form.isPinned}
              onChange={(e) => set("isPinned")(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-amber-500"
            />
            <div>
              <p className="text-sm font-medium text-slate-900">Pin this post</p>
              <p className="text-xs text-slate-400">Pinned posts appear at the top of the feed.</p>
            </div>
            <Pin size={15} className="ml-auto text-amber-400" />
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => navigate(`/clubs/${id}`)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} className="bg-purple-600 text-white hover:bg-purple-700">
            {isEdit ? "Save changes" : "Publish"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

// ============================================================================
// Screen 5 — Club Settings  (/clubs/:id/manage)  — President / VP
// Officers edit text fields here; the cover image is set by an admin.
// ============================================================================
export function ClubManage({ id }) {
  const { clubById, updateClubDetails, faculty, canManageClub, dataLoading } = useApp();
  const toast = useToasts();
  const club = clubById(id);

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // Hydrate the form once the club is available (keyed on id so a background
  // refresh never clobbers in-progress edits).
  useEffect(() => {
    if (club && !form) {
      setForm({
        name: club.name, tagline: club.tagline, about: club.about,
        category: club.category, facultyAdvisorId: club.facultyAdvisorId || "",
      });
    }
  }, [club?.id]);

  if (dataLoading) return <AppShell activeKey="clubs" title="Settings"><Loading /></AppShell>;
  if (!club || !canManageClub(id)) {
    return <AppShell activeKey="clubs" title="Settings"><EmptyState icon={Settings} title="Not allowed" message="Only the President or VP can access club settings." /></AppShell>;
  }
  if (!form) return <AppShell activeKey="clubs" title="Settings"><Loading /></AppShell>;

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (saving || !form.name.trim()) { if (!form.name.trim()) toast.error("Club name is required."); return; }
    setSaving(true);
    try {
      const { ok, error } = await updateClubDetails(id, { ...form, facultyAdvisorId: form.facultyAdvisorId || null });
      if (!ok) { toast.error("Couldn't save", error); return; }
      toast.success("Club updated.");
      navigate(`/clubs/${id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell activeKey="clubs" title="Club Settings">
      <PageHeader
        title="Club Settings"
        subtitle={club.name}
        action={<Button variant="secondary" onClick={() => navigate(`/clubs/${id}`)}>← Back</Button>}
      />

      <div className="max-w-xl space-y-4">
        <Field label="Club Name" required>
          <Input value={form.name} onChange={(e) => set("name")(e.target.value)} />
        </Field>
        <Field label="Tagline" hint="One-line summary shown on your club card.">
          <Input value={form.tagline || ""} onChange={(e) => set("tagline")(e.target.value)} placeholder="e.g. Building tomorrow's engineers" />
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => set("category")(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="About" hint="Full description shown on your club profile.">
          <Textarea value={form.about || ""} onChange={(e) => set("about")(e.target.value)} rows={4} placeholder="Describe the club's mission, activities, and what members do." />
        </Field>
        <Field label="Faculty Advisor" hint="Optional.">
          <Select value={form.facultyAdvisorId || ""} onChange={(e) => set("facultyAdvisorId")(e.target.value)}>
            <option value="">— None —</option>
            {(faculty || []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        </Field>
        <p className="text-xs text-slate-400">The cover image is managed by an administrator.</p>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => navigate(`/clubs/${id}`)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} className="bg-purple-600 text-white hover:bg-purple-700">Save changes</Button>
        </div>
      </div>
    </AppShell>
  );
}

// ============================================================================
// Screen 6 — Admin: Manage Clubs  (/admin/clubs)
// ============================================================================
export function AdminManageClubs() {
  const { clubs, clubMembersIn, users, createClub, updateClubDetails, setClubActive, assignClubPresident, faculty, dataLoading } = useApp();
  const toast = useToasts();

  const [showCreate, setShowCreate]             = useState(false);
  const [editTarget, setEditTarget]             = useState(null);
  const [reassignTarget, setReassignTarget]     = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [actioning, setActioning]               = useState(null);

  if (dataLoading) return <AppShell activeKey="clubs-admin" title="Manage Clubs"><Loading /></AppShell>;

  const allClubs = [...clubs].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  async function handleSetActive(clubId, isActive) {
    if (actioning) return;
    setActioning(clubId);
    try {
      const { ok, error } = await setClubActive(clubId, isActive);
      if (!ok) toast.error("Action failed", error);
      setDeactivateTarget(null);
    } finally {
      setActioning(null);
    }
  }

  return (
    <AppShell activeKey="clubs-admin" title="Manage Clubs">
      <PageHeader
        title="Manage Clubs"
        subtitle={`${allClubs.length} club${allClubs.length !== 1 ? "s" : ""}`}
        action={<Button icon={Plus} onClick={() => setShowCreate(true)} className="bg-purple-600 text-white hover:bg-purple-700">New Club</Button>}
      />

      {allClubs.length === 0 ? (
        <EmptyState icon={UsersRound} title="No clubs yet" message="Create the first club." action={<Button icon={Plus} onClick={() => setShowCreate(true)} className="bg-purple-600 text-white hover:bg-purple-700">New Club</Button>} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Club</th>
                <th className="hidden px-4 py-3 text-xs font-semibold text-slate-500 sm:table-cell">Category</th>
                <th className="hidden px-4 py-3 text-xs font-semibold text-slate-500 md:table-cell">Members</th>
                <th className="hidden px-4 py-3 text-xs font-semibold text-slate-500 lg:table-cell">President</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allClubs.map((club) => {
                const members = clubMembersIn(club.id);
                const president = members.find((m) => m.role === "president");
                const presidentUser = president ? users.find((u) => u.id === president.userId) : null;
                return (
                  <tr key={club.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                          <ClubBanner club={club} className="h-full w-full" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{club.name}</p>
                          {club.tagline && <p className="text-xs text-slate-400 truncate">{club.tagline}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <Badge tone={CATEGORY_TONE[club.category]}>{club.category}</Badge>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{members.length}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {presidentUser ? (
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <Crown size={13} className="text-purple-500" /> {presidentUser.name}
                        </span>
                      ) : <span className="text-slate-400 text-xs">— unassigned —</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={club.isActive ? "emerald" : "slate"}>{club.isActive ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditTarget(club)} title="Edit" className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={14} /></button>
                        <button onClick={() => setReassignTarget(club)} title="Assign President" className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-purple-50 hover:text-purple-700"><Crown size={14} /></button>
                        <button onClick={() => setDeactivateTarget(club)} title={club.isActive ? "Deactivate" : "Reactivate"} className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          {actioning === club.id ? <Spinner size={14} /> : club.isActive ? <X size={14} /> : <Plus size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <ClubFormModal
          faculty={faculty}
          users={users}
          onSave={async (data) => {
            const { ok, error } = await createClub(data);
            if (!ok) { toast.error("Couldn't create club", error); return false; }
            toast.success("Club created."); setShowCreate(false); return true;
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <ClubFormModal
          initial={editTarget}
          faculty={faculty}
          users={users}
          onSave={async (data) => {
            const { ok, error } = await updateClubDetails(editTarget.id, data);
            if (!ok) { toast.error("Couldn't update club", error); return false; }
            toast.success("Club updated."); setEditTarget(null); return true;
          }}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Reassign president modal */}
      {reassignTarget && (
        <ReassignPresidentModal
          club={reassignTarget}
          users={users}
          clubMembers={clubMembersIn(reassignTarget.id)}
          onSave={async (userId) => {
            const { ok, error } = await assignClubPresident(reassignTarget.id, userId);
            if (!ok) { toast.error("Couldn't reassign", error); return false; }
            toast.success("President reassigned."); setReassignTarget(null); return true;
          }}
          onClose={() => setReassignTarget(null)}
        />
      )}

      {/* Deactivate confirm */}
      {deactivateTarget && (
        <Modal open title={deactivateTarget.isActive ? "Deactivate club?" : "Reactivate club?"} onClose={() => setDeactivateTarget(null)}>
          <p className="text-sm text-slate-600">
            {deactivateTarget.isActive
              ? "Members will no longer be able to access this club. The data is preserved and can be restored."
              : "This will make the club visible and accessible to its members again."}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeactivateTarget(null)}>Cancel</Button>
            <Button
              onClick={() => handleSetActive(deactivateTarget.id, !deactivateTarget.isActive)}
              loading={actioning === deactivateTarget.id}
              className={deactivateTarget.isActive ? "bg-red-600 text-white hover:bg-red-700" : "bg-emerald-600 text-white hover:bg-emerald-700"}
            >
              {deactivateTarget.isActive ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

function ClubFormModal({ initial, faculty, users, onSave, onClose }) {
  const [form, setForm] = useState({
    name:            initial?.name        || "",
    tagline:         initial?.tagline     || "",
    about:           initial?.about       || "",
    category:        initial?.category    || "Tech",
    facultyAdvisorId:initial?.facultyAdvisorId || "",
    presidentId:     "",
    coverFile:       null,
    coverPreview:    initial?.coverUrl    || null,
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const isCreate = !initial;

  async function handleSave() {
    if (saving || !form.name.trim()) return;
    setSaving(true);
    try {
      await onSave({ ...form, facultyAdvisorId: form.facultyAdvisorId || null, presidentId: form.presidentId || null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={isCreate ? "New Club" : `Edit — ${initial.name}`} onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        <Field label="Club Name" required>
          <Input autoFocus value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. BUBT Robotics Club" />
        </Field>
        <Field label="Tagline">
          <Input value={form.tagline} onChange={(e) => set("tagline")(e.target.value)} placeholder="One-line description" />
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => set("category")(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="About">
          <Textarea value={form.about} onChange={(e) => set("about")(e.target.value)} rows={3} placeholder="What does this club do?" />
        </Field>
        {isCreate && (
          <Field label="Assign President" hint="Optional — can be assigned later.">
            <Select value={form.presidentId} onChange={(e) => set("presidentId")(e.target.value)}>
              <option value="">— Select a student —</option>
              {users.filter((u) => u.role === "Student").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Faculty Advisor" hint="Optional.">
          <Select value={form.facultyAdvisorId} onChange={(e) => set("facultyAdvisorId")(e.target.value)}>
            <option value="">— None —</option>
            {(faculty || []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        </Field>
        <Field label="Cover Image">
          <FileUpload
            value={form.coverPreview}
            onChange={(url, file) => { set("coverFile")(file); setForm((f) => ({ ...f, coverPreview: url })); }}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!form.name.trim()} className="bg-purple-600 text-white hover:bg-purple-700">
            {isCreate ? "Create Club" : "Save Changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ReassignPresidentModal({ club, users, clubMembers, onSave, onClose }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const currentPresident = clubMembers.find((m) => m.role === "president");
  const candidates = users.filter(
    (u) =>
      u.role === "Student" &&
      u.id !== currentPresident?.userId &&
      (query === "" || (u.name ?? "").toLowerCase().includes(query.toLowerCase()))
  );

  async function handleSave() {
    if (saving || !selected) return;
    setSaving(true);
    try {
      await onSave(selected.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={`Reassign President — ${club.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-500">The current president will be demoted to member. The new president will have full control.</p>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            aria-label="Search students"
            placeholder="Search students…"
            className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
          />
        </div>
        <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
          {candidates.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No students match.</p>
          ) : candidates.slice(0, 30).map((u) => (
            <button
              key={u.id}
              onClick={() => setSelected(u)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${selected?.id === u.id ? "bg-purple-50" : "hover:bg-slate-50"}`}
            >
              <Avatar name={u.name} size={28} src={u.avatar} />
              <span className="text-sm text-slate-900">{u.name}</span>
              {selected?.id === u.id && <Crown size={14} className="ml-auto text-purple-500" />}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!selected} className="bg-purple-600 text-white hover:bg-purple-700">
            Assign as President
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// Dashboard widget
// ============================================================================
export function ClubsWidget() {
  const { myClubs, userRoleIn, currentUser } = useApp();
  // Clubs is a student-only feature; don't surface the widget to staff/admin.
  if (currentUser?.role !== "Student") return null;
  const clubs = myClubs();

  return (
    <button
      onClick={() => navigate("/clubs")}
      className="group flex w-full items-start gap-4 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-purple-300 hover:bg-purple-50/40"
    >
      <AccentTile icon="UsersRound" tone="purple" size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">My Clubs</p>
        {clubs.length === 0 ? (
          <p className="text-xs text-slate-400">You're not in any clubs yet.</p>
        ) : (
          <div className="mt-1 flex flex-col gap-0.5">
            {clubs.slice(0, 3).map((c) => (
              <p key={c.id} className="truncate text-xs text-slate-500">
                {c.name}
                <span className="ml-1.5 text-slate-400">· {ROLE_LABEL[userRoleIn(c.id)] || "Member"}</span>
              </p>
            ))}
            {clubs.length > 3 && <p className="text-xs text-slate-400">+{clubs.length - 3} more</p>}
          </div>
        )}
      </div>
      <ArrowRight size={18} className="mt-0.5 shrink-0 text-slate-300 group-hover:text-purple-500" />
    </button>
  );
}
