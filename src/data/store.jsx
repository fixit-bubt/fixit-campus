import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase.js";
import { navigate } from "../lib/router.jsx";

// ============================================================================
// App data store.
//   AUTH + PROFILES + REPORTS  -> real Supabase.
//   lost & found items / claims -> still local for now (chunk #4 wires these).
// Every screen reads/writes through useApp(); the value shape is unchanged.
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
    name: p.full_name,
    email: p.email ?? "",
    role: cap(p.role),
    dept: p.department ?? undefined,
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

function loadPersisted(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function AppProvider({ children }) {
  // ---- auth / profiles (real Supabase) ----
  const [sessionUserId, setSessionUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---- reports (real Supabase) ----
  const [reports, setReports] = useState([]);

  // ---- items / claims (local for now, empty start) ----
  const [items, setItems] = useState(() => loadPersisted("fixit_items", []));
  const [claims, setClaims] = useState(() => loadPersisted("fixit_claims", []));
  useEffect(() => { localStorage.setItem("fixit_items", JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem("fixit_claims", JSON.stringify(claims)); }, [claims]);

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
      .then(({ data }) => { if (active) setCurrentUser(toUser(data)); });
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

  useEffect(() => { refreshUsers(); loadReports(); }, [refreshUsers, loadReports]);

  // ---- auth actions ----
  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: "Incorrect email or password. Try again." };
    const { data: p } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    return { ok: true, user: toUser(p) || { name: email.split("@")[0], role: "Student" } };
  }

  async function register({ name, email, password }) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password, options: { data: { full_name: name.trim() } },
    });
    if (error) {
      return { ok: false, error: /already/i.test(error.message) ? "An account with this email already exists." : error.message };
    }
    if (!data.session) return { ok: false, error: "Check your email to confirm your account, then log in." };
    return { ok: true, user: { name: name.trim(), role: "Student" } };
  }

  async function logout() {
    await supabase.auth.signOut();
    setCurrentUser(null);
    navigate("/");
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
    const { error: e2 } = await supabase
      .from("profiles").update({ role: lower(role), department: dept?.trim() || null })
      .eq("id", data.user?.id);
    await tmp.auth.signOut();
    if (e2) return { ok: false, error: e2.message };
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
    const { error } = await supabase.from("profiles").update({ role: lower(role) }).eq("id", userId);
    if (error) return { ok: false, error: error.message };
    await refreshUsers();
    if (currentUser && currentUser.id === userId) setCurrentUser((c) => ({ ...c, role }));
    return { ok: true };
  }

  // ---- report mutations (real) ----
  async function createReport({ category, description, building, room, photo }) {
    const { data, error } = await supabase
      .from("reports")
      .insert({
        category,
        description: description.trim(),
        building: building.trim(),
        room: room?.trim() || null,
        photo_url: photo || null,
        reporter_id: currentUser.id,
      })
      .select("code")
      .single();
    if (error) return { ok: false, error: error.message };
    await loadReports();
    return { ok: true, id: data.code };
  }

  async function updateReport(id, { category, description, building, room, photo }) {
    const { error } = await supabase
      .from("reports")
      .update({
        category,
        description: description.trim(),
        building: building.trim(),
        room: room?.trim() || null,
        photo_url: photo || null,
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
    const r = reports.find((x) => x.id === id);
    const patch = { assigned_staff_id: staffId || null };
    if (r && r.status === "Open" && staffId) patch.status = "In Progress";
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

  // ---- lost & found / claims (LOCAL for now — wired to Supabase in #4) ----
  function addItem(data) {
    const id = "I-" + (302 + items.length);
    const item = { id, ...data, photo: data.photo || null };
    setItems((it) => [item, ...it]);
    return item;
  }
  function updateItem(id, data) {
    setItems((it) => it.map((x) => (x.id === id ? { ...x, ...data } : x)));
  }
  function deleteItem(id) {
    setItems((it) => it.filter((x) => x.id !== id));
    setClaims((cs) => cs.filter((c) => c.itemId !== id));
  }
  function addClaim({ itemId, claimantId, kind, message, proof }) {
    const id = "C-" + (52 + claims.length);
    const claim = { id, itemId, claimantId, kind, message, proof: proof || null, status: "Pending", createdAt: new Date().toISOString().slice(0, 10) };
    setClaims((cs) => [claim, ...cs]);
    return claim;
  }
  function setClaimStatus(id, status) {
    setClaims((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
  }

  const value = {
    users, setUsers, reports, setReports, items, setItems, claims, setClaims,
    currentUser, setCurrentUser, loading,
    login, register, logout, createUser,
    userById, dashboardPath, staffList,
    createReport, updateReport, setReportStatus, assignReport, deleteReport,
    setRole, addItem, updateItem, deleteItem, addClaim, setClaimStatus,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
