import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase.js";
import { navigate } from "../lib/router.jsx";

// ============================================================================
// App data store — everything (auth, profiles, reports, lost & found items,
// claims, photos) is backed by Supabase. Every screen reads/writes through
// useApp(); screens never touch Supabase directly.
// ============================================================================

const AppContext = createContext(null);

// DB stores role lowercase ('student'); the UI uses 'Student'/'Staff'/'Admin'.
const cap = (r) => (r ? r.charAt(0).toUpperCase() + r.slice(1) : "Student");
const lower = (r) => (r ? r.toLowerCase() : "student");
const day = (ts) => (ts ? String(ts).slice(0, 10) : "");

function toUser(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.full_name || (p.email ? p.email.split("@")[0] : "User"),
    email: p.email ?? "",
    role: cap(p.role),
    dept: p.department ?? undefined,
    whatsapp: p.whatsapp ?? "",
    intake: p.intake ?? "",
    section: p.section ?? "",
    avatar: p.avatar_url ?? null,
    directoryVisible: p.directory_visible ?? true,
    showWhatsapp: p.show_whatsapp ?? false,
    joined: day(p.created_at),
  };
}

// DB report row -> the shape the screens expect.
// `id` is the human code (used for routing + display); `uuid` is the real PK.
function toReport(r, timeline) {
  return {
    id: r.code,
    uuid: r.id,
    category: r.category,
    description: r.description,
    building: r.building,
    room: r.room || "",
    photo: r.photo_url || null,
    status: r.status,
    studentId: r.reporter_id,
    assignedStaffId: r.assigned_staff_id,
    createdAt: day(r.created_at),
    timeline:
      timeline && timeline.length
        ? timeline
        : [{ status: r.status, date: day(r.created_at) }],
  };
}

// DB lost & found row -> screen shape. `id` is the code (routing/matching).
function toItem(r) {
  return {
    id: r.code,
    uuid: r.id,
    type: r.type,
    title: r.title,
    category: r.category,
    description: r.description,
    location: r.location,
    date: r.item_date,
    photo: r.photo_url || null,
    status: r.status,
    posterId: r.poster_id,
    createdAt: day(r.created_at),
  };
}

// DB claim row -> screen shape. itemId is the item's CODE (via join) so it
// matches item.id everywhere in the UI.
function toClaim(r) {
  return {
    id: r.code,
    uuid: r.id,
    itemId: r.item?.code || null,
    claimantId: r.claimant_id,
    kind: r.kind,
    message: r.message,
    proof: r.proof_url || null,
    status: r.status,
    createdAt: day(r.created_at),
  };
}

// ============================================================================
// ⚠️ PHASE-1 MOCK — campus-feature slices (localStorage, not Supabase).
// These ship the new UI on seed data while the screens are built one by one.
// Phase 2 replaces each slice with real tables + RLS, keeping the same `value`
// keys so the screens don't change. Replace this block, not the screens.
// ----------------------------------------------------------------------------
const isoOffset = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function loadMock(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Announcements (notice board). `readBy` seed ids are demo-only and won't match
// real user ids, so seeded notices simply read as "unread" for everyone — fine.
const SEED_ANNOUNCEMENTS = [
  { id: "AN-52", title: "Mid-term examination routine published", priority: "Important", department: "Examination Controller", date: isoOffset(0), pinned: true, attachment: "Midterm_Routine_Summer2026.pdf", body: "The mid-term examination routine for Summer 2026 has been published. Examinations begin from the week after next. Students must clear all dues before collecting admit cards from their respective departments. Seat plans will be displayed on notice boards two days before each exam.", readBy: [] },
  { id: "AN-50", title: "Campus closed on national holiday", priority: "General", department: "Administration", date: isoOffset(-1), pinned: true, attachment: null, body: "The campus, including all administrative offices and the library, will remain closed on the upcoming national holiday. Shuttle services will not operate. Classes will resume the following working day as per the regular routine.", readBy: [] },
  { id: "AN-49", title: "Urgent: Water supply maintenance in Building B", priority: "Urgent", department: "Facilities", date: isoOffset(0), pinned: false, attachment: null, body: "Due to emergency maintenance of the water pump, water supply in Building B will be interrupted tomorrow from 9:00 AM to 1:00 PM. We apologize for the inconvenience. Please plan accordingly.", readBy: [] },
  { id: "AN-47", title: "Semester final tuition fee deadline", priority: "Important", department: "Accounts", date: isoOffset(-2), pinned: false, attachment: "Fee_Notice.pdf", body: "Students are reminded to pay the semester final tuition fee by the end of this month to avoid a late fine. Payment can be made online through the student portal or at the accounts office.", readBy: [] },
  { id: "AN-44", title: "Library extended hours during exams", priority: "General", department: "Library", date: isoOffset(-3), pinned: false, attachment: null, body: "The central library will remain open until 10:00 PM on weekdays during the examination period to support student preparation. Please carry your ID cards at all times.", readBy: [] },
  { id: "AN-41", title: "Club registration open for new members", priority: "General", department: "Student Welfare", date: isoOffset(-5), pinned: false, attachment: "Club_List.pdf", body: "Registration for all student clubs is now open. Visit the Student Welfare office or the respective club booths in the concourse to sign up. Membership is free for the first semester.", readBy: [] },
];

export function AppProvider({ children }) {
  // ---- auth / profiles (real Supabase) ----
  const [sessionUserId, setSessionUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // ---- reports (real Supabase) ----
  const [reports, setReports] = useState([]);

  // ---- items / claims (real Supabase) ----
  const [items, setItems] = useState([]);
  const [claims, setClaims] = useState([]);

  // ---- campus features (PHASE-1 MOCK, localStorage) ----
  const [announcements, setAnnouncements] = useState(() => loadMock("fixit_announcements", SEED_ANNOUNCEMENTS));
  useEffect(() => {
    try { localStorage.setItem("fixit_announcements", JSON.stringify(announcements)); } catch {}
  }, [announcements]);

  // ---- session bootstrap + live auth changes ----
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSessionUserId(data.session?.user?.id ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user?.id ?? null);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let active = true;
    if (!sessionUserId) { setCurrentUser(null); return; }
    supabase
      .from("profiles").select("*").eq("id", sessionUserId).single()
      .then(({ data, error }) => {
        // On a transient read failure, keep the user signed in rather than
        // flipping to a confusing "logged out but session valid" state.
        if (!active || error || !data) return;
        setCurrentUser(toUser(data));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [sessionUserId]);

  const refreshUsers = useCallback(async () => {
    if (!currentUser) { setUsers([]); return; }
    const src = currentUser.role === "Admin" ? "profiles" : "public_profiles";
    const { data } = await supabase.from(src).select("*").order("full_name");
    setUsers((data || []).map(toUser));
  }, [currentUser]);

  // ---- reports: load (RLS returns only rows this user may see) ----
  const loadReports = useCallback(async () => {
    if (!currentUser) { setReports([]); return; }
    const { data: rows } = await supabase
      .from("reports").select("*").order("created_at", { ascending: false });
    const ids = (rows || []).map((r) => r.id);
    const byReport = {};
    if (ids.length) {
      const { data: evs } = await supabase
        .from("report_events").select("*").in("report_id", ids)
        .order("created_at", { ascending: true });
      (evs || []).forEach((e) => {
        (byReport[e.report_id] ||= []).push({ status: e.status, date: day(e.created_at) });
      });
    }
    setReports((rows || []).map((r) => toReport(r, byReport[r.id])));
  }, [currentUser]);

  const loadItems = useCallback(async () => {
    if (!currentUser) { setItems([]); return; }
    const { data } = await supabase
      .from("lost_found_items").select("*").order("item_date", { ascending: false });
    setItems((data || []).map(toItem));
  }, [currentUser]);

  const loadClaims = useCallback(async () => {
    if (!currentUser) { setClaims([]); return; }
    const { data } = await supabase
      .from("claims")
      .select("*, item:lost_found_items(code)")
      .order("created_at", { ascending: false });
    setClaims((data || []).map(toClaim));
  }, [currentUser]);

  useEffect(() => {
    let active = true;
    if (currentUser) setDataLoading(true);
    Promise.all([refreshUsers(), loadReports(), loadItems(), loadClaims()]).finally(() => {
      if (active) setDataLoading(false);
    });
    return () => { active = false; };
  }, [currentUser, refreshUsers, loadReports, loadItems, loadClaims]);

  // ---- auth actions ----
  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: "Incorrect email or password. Try again." };
    const { data: p } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    // Don't fabricate a role if the profile read hiccuped — omit it so the
    // post-login redirect lands on a safe default and the route guards (driven
    // by the real currentUser loaded separately) correct it.
    return { ok: true, user: toUser(p) || { name: email.split("@")[0] } };
  }

  async function register({ name, email, password }) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password, options: { data: { full_name: name.trim() } },
    });
    if (error) {
      return { ok: false, error: /already/i.test(error.message) ? "An account with this email already exists." : error.message };
    }
    // Email-confirmation ON: account created but no session yet — not an error.
    if (!data.session) return { ok: true, needsConfirm: true };
    return { ok: true, user: { name: name.trim(), role: "Student" } };
  }

  async function logout() {
    // Clear local state and navigate even if the network sign-out call fails.
    try {
      await supabase.auth.signOut();
    } finally {
      setCurrentUser(null);
      navigate("/");
    }
  }

  async function createUser({ name, email, password, role, dept }) {
    const tmp = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data, error } = await tmp.auth.signUp({
      email: email.trim(), password, options: { data: { full_name: name.trim() } },
    });
    if (error) {
      return { ok: false, error: /already/i.test(error.message) ? "An account with this email already exists." : error.message };
    }
    // If email confirmation is on, signUp returns no user — we can't set the role.
    if (!data.user) {
      await tmp.auth.signOut();
      return { ok: false, error: "Account created, but it must confirm its email before the role can be set. Set the role from the Users list once confirmed." };
    }
    // Set the role (the signup trigger created the row as 'student'); verify it took.
    const { data: updated, error: e2 } = await supabase
      .from("profiles")
      .update({ role: lower(role), department: dept?.trim() || null })
      .eq("id", data.user.id)
      .select("id");
    await tmp.auth.signOut();
    if (e2) return { ok: false, error: e2.message };
    if (!updated || updated.length !== 1) {
      return { ok: false, error: "Account created, but assigning the role failed — set it from the Users list." };
    }
    await refreshUsers();
    return { ok: true };
  }

  // ---- lookups ----
  const userById = (id) => users.find((u) => u.id === id);
  const dashboardPath = (role) =>
    role === "Admin" ? "/admin" : role === "Staff" ? "/staff" : "/dashboard";
  const staffList = users
    .filter((u) => u.role === "Staff")
    .map((u) => ({ id: u.id, name: u.name, dept: u.dept || "Staff" }));

  async function setRole(userId, role) {
    // Don't let the last admin be demoted (DB also enforces this in 0009).
    const target = users.find((u) => u.id === userId);
    if (target && target.role === "Admin" && role !== "Admin") {
      const admins = users.filter((u) => u.role === "Admin").length;
      if (admins <= 1) {
        return { ok: false, error: "You can't remove the last admin — promote another admin first." };
      }
    }
    const { error } = await supabase.from("profiles").update({ role: lower(role) }).eq("id", userId);
    if (error) return { ok: false, error: error.message };
    await refreshUsers();
    if (currentUser && currentUser.id === userId) setCurrentUser((c) => ({ ...c, role }));
    return { ok: true };
  }

  // Update the signed-in user's own profile (name, WhatsApp, photo; intake &
  // section for students). Email and role are not editable here.
  async function updateProfile(form) {
    let avatar_url;
    try {
      avatar_url = await resolvePhoto({ photo: form.avatar, photoFile: form.avatarFile }, "avatars");
    } catch (e) {
      return { ok: false, error: "Photo upload failed: " + e.message };
    }
    const patch = {
      full_name: form.name.trim(),
      whatsapp: form.whatsapp?.trim() || null,
      avatar_url,
    };
    if (currentUser.role === "Student") {
      patch.intake = form.intake?.trim() || null;
      patch.section = form.section?.trim() || null;
      patch.directory_visible = form.directoryVisible !== false;
      patch.show_whatsapp = form.showWhatsapp === true;
    }
    const { error } = await supabase.from("profiles").update(patch).eq("id", currentUser.id);
    if (error) return { ok: false, error: error.message };
    const { data } = await supabase.from("profiles").select("*").eq("id", currentUser.id).single();
    setCurrentUser(toUser(data));
    await refreshUsers();
    return { ok: true };
  }

  // ---- photo upload (Supabase Storage) ----
  async function uploadPhoto(file, folder) {
    const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
    // Proofs go to a PRIVATE bucket (viewed via signed URL); everything else to
    // the public "photos" bucket (viewed via a permanent public URL).
    const isProof = folder === "proofs";
    const bucket = isProof ? "proofs" : "photos";
    const path = isProof
      ? `${currentUser.id}/${crypto.randomUUID()}.${ext}`
      : `${folder}/${currentUser.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    // Private proofs: store the object PATH (resolved to a signed URL on view).
    if (isProof) return path;
    return supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
  }

  // Resolve a private proof PATH to a short-lived signed URL for viewing.
  // (Passes through legacy http(s) URLs untouched.)
  async function getProofUrl(pathOrUrl) {
    if (!pathOrUrl) return null;
    if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
    const { data } = await supabase.storage.from("proofs").createSignedUrl(pathOrUrl, 3600);
    return data?.signedUrl || null;
  }

  // A form carries `photo` (preview URL or existing saved URL) and `photoFile`
  // (a newly chosen File). Resolve to the URL we should store.
  async function resolvePhoto(form, folder) {
    if (form.photoFile) return await uploadPhoto(form.photoFile, folder);
    if (form.photo && !String(form.photo).startsWith("blob:")) return form.photo;
    return null;
  }

  // ---- report mutations (real) ----
  async function createReport(form) {
    let photo_url;
    try {
      photo_url = await resolvePhoto(form, "reports");
    } catch (e) {
      return { ok: false, error: "Photo upload failed: " + e.message };
    }
    const { data, error } = await supabase
      .from("reports")
      .insert({
        category: form.category,
        description: form.description.trim(),
        building: form.building.trim(),
        room: form.room?.trim() || null,
        photo_url,
        reporter_id: currentUser.id,
      })
      .select("code")
      .single();
    if (error) return { ok: false, error: error.message };
    await loadReports();
    return { ok: true, id: data.code };
  }

  async function updateReport(id, form) {
    let photo_url;
    try {
      photo_url = await resolvePhoto(form, "reports");
    } catch (e) {
      return { ok: false, error: "Photo upload failed: " + e.message };
    }
    const { error } = await supabase
      .from("reports")
      .update({
        category: form.category,
        description: form.description.trim(),
        building: form.building.trim(),
        room: form.room?.trim() || null,
        photo_url,
      })
      .eq("code", id);
    if (error) return { ok: false, error: error.message };
    await loadReports();
    return { ok: true };
  }

  async function setReportStatus(id, status) {
    const { error } = await supabase.from("reports").update({ status }).eq("code", id);
    if (error) return { ok: false, error: error.message };
    await loadReports();
    return { ok: true };
  }

  async function assignReport(id, staffId) {
    const patch = { assigned_staff_id: staffId || null };
    // Auto-advance Open -> In Progress, deciding from a fresh read (not cached state).
    if (staffId) {
      const { data: cur } = await supabase.from("reports").select("status").eq("code", id).single();
      if (cur?.status === "Open") patch.status = "In Progress";
    }
    const { error } = await supabase.from("reports").update(patch).eq("code", id);
    if (error) return { ok: false, error: error.message };
    await loadReports();
    return { ok: true };
  }

  async function deleteReport(id) {
    const { error } = await supabase
      .from("reports").update({ deleted_at: new Date().toISOString() }).eq("code", id);
    if (error) return { ok: false, error: error.message };
    await loadReports();
    return { ok: true };
  }

  // ---- lost & found mutations (real) ----
  async function addItem(form) {
    let photo_url;
    try {
      photo_url = await resolvePhoto(form, "items");
    } catch (e) {
      return { ok: false, error: "Photo upload failed: " + e.message };
    }
    const { data, error } = await supabase
      .from("lost_found_items")
      .insert({
        type: form.type,
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        location: form.location.trim(),
        item_date: form.date,
        photo_url,
        poster_id: currentUser.id,
      })
      .select("code")
      .single();
    if (error) return { ok: false, error: error.message };
    await loadItems();
    return { ok: true, id: data.code };
  }

  async function updateItem(id, form) {
    let photo_url;
    try {
      photo_url = await resolvePhoto(form, "items");
    } catch (e) {
      return { ok: false, error: "Photo upload failed: " + e.message };
    }
    const { error } = await supabase
      .from("lost_found_items")
      .update({
        type: form.type,
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        location: form.location.trim(),
        item_date: form.date,
        photo_url,
      })
      .eq("code", id);
    if (error) return { ok: false, error: error.message };
    await loadItems();
    return { ok: true };
  }

  async function deleteItem(id) {
    const { error } = await supabase
      .from("lost_found_items").update({ deleted_at: new Date().toISOString() }).eq("code", id);
    if (error) return { ok: false, error: error.message };
    await loadItems();
    await loadClaims();
    return { ok: true };
  }

  // itemUuid is the item's real id; proofFile is an optional File to upload.
  async function addClaim({ itemUuid, kind, message, proof, proofFile }) {
    let proof_url;
    try {
      proof_url = await resolvePhoto({ photo: proof, photoFile: proofFile }, "proofs");
    } catch (e) {
      return { ok: false, error: "Photo upload failed: " + e.message };
    }
    const { error } = await supabase.from("claims").insert({
      item_id: itemUuid,
      claimant_id: currentUser.id,
      kind,
      message: message.trim(),
      proof_url,
    });
    if (error) return { ok: false, error: error.message };
    await loadClaims();
    return { ok: true };
  }

  async function setClaimStatus(id, status) {
    const { error } = await supabase.from("claims").update({ status }).eq("code", id);
    if (error) return { ok: false, error: error.message };
    await loadClaims();
    await loadItems();
    return { ok: true };
  }

  // Student directory (students only; respects each user's privacy toggles and
  // the reciprocal "hidden users can't browse" rule — all enforced in the DB).
  async function getStudentDirectory() {
    const { data, error } = await supabase.rpc("student_directory");
    if (error) throw error; // let the screen show an error + retry instead of a silent empty list
    return (data || []).map((r) => ({
      id: r.id,
      name: r.full_name,
      avatar: r.avatar_url,
      department: r.department,
      intake: r.intake,
      section: r.section,
      status: r.status, // 'none' | 'pending_outgoing' | 'pending_incoming' | 'accepted'
      email: r.email,
      whatsapp: r.whatsapp,
    }));
  }

  // Send a connection request to another student.
  async function sendConnectionRequest(addresseeId) {
    const { error } = await supabase
      .from("connections")
      .insert({ requester_id: currentUser.id, addressee_id: addresseeId });
    if (error) {
      const msg = /already exists/i.test(error.message)
        ? "You're already connected or have a pending request with this student."
        : error.message;
      return { ok: false, error: msg };
    }
    return { ok: true };
  }

  // Respond to an incoming request from `requesterId`.
  // Accept -> mark accepted (contact unlocks). Decline -> delete the request,
  // so it leaves no trace and either student can start fresh later.
  async function respondConnection(requesterId, accept) {
    const match = (q) =>
      q.eq("requester_id", requesterId).eq("addressee_id", currentUser.id).eq("status", "pending").select("id");
    const { data, error } = accept
      ? await match(supabase.from("connections").update({ status: "accepted", decided_at: new Date().toISOString() }))
      : await match(supabase.from("connections").delete());
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) return { ok: false, error: "This request is no longer pending." };
    return { ok: true };
  }

  // Cancel a pending request you sent to `addresseeId`.
  async function cancelConnectionRequest(addresseeId) {
    const { data, error } = await supabase
      .from("connections")
      .delete()
      .eq("requester_id", currentUser.id)
      .eq("addressee_id", addresseeId)
      .eq("status", "pending")
      .select("id");
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) return { ok: false, error: "This request was already handled." };
    return { ok: true };
  }

  // Contact reveal: read a counterpart's name + email + whatsapp from profiles.
  // RLS only returns it if you're allowed (self, admin, or the matched party of
  // an approved claim) — so this is safe to call.
  async function getContact(userId) {
    if (!userId) return null;
    const { data } = await supabase
      .from("profiles").select("full_name, email, whatsapp, avatar_url").eq("id", userId).single();
    return data
      ? { name: data.full_name, email: data.email, whatsapp: data.whatsapp, avatar: data.avatar_url }
      : null;
  }

  // ---- announcements (PHASE-1 MOCK) ----
  // Next AN-id from the current max suffix, so deletes can't cause a dup id.
  function nextAnnId(list) {
    const max = list.reduce((m, a) => {
      const n = parseInt(String(a.id).replace(/\D/g, ""), 10);
      return isNaN(n) ? m : Math.max(m, n);
    }, 52);
    return "AN-" + (max + 1);
  }
  function addAnnouncement(data) {
    const an = { id: nextAnnId(announcements), date: isoOffset(0), readBy: [], ...data };
    setAnnouncements((a) => [an, ...a]);
    return an; // screen navigates to /announcements/:id immediately
  }
  function markAnnouncementRead(id) {
    if (!currentUser) return;
    setAnnouncements((as) =>
      as.map((a) =>
        a.id === id && !a.readBy.includes(currentUser.id)
          ? { ...a, readBy: [...a.readBy, currentUser.id] }
          : a
      )
    );
  }
  function deleteAnnouncement(id) {
    setAnnouncements((as) => as.filter((a) => a.id !== id));
  }

  const value = {
    users, reports, items, claims,
    announcements, addAnnouncement, markAnnouncementRead, deleteAnnouncement,
    currentUser, setCurrentUser, sessionUserId, loading, dataLoading,
    login, register, logout, createUser,
    userById, dashboardPath, staffList,
    createReport, updateReport, setReportStatus, assignReport, deleteReport,
    setRole, updateProfile, addItem, updateItem, deleteItem, addClaim, setClaimStatus, getContact, getProofUrl,
    getStudentDirectory, sendConnectionRequest, respondConnection, cancelConnectionRequest,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
