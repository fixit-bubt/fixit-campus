import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase.js";
import { navigate } from "../lib/router.jsx";

// ============================================================================
// App data store.
//   AUTH + PROFILES  -> real Supabase (this file, chunk #2).
//   reports / items / claims -> still local for now (chunks #3–#4 wire these
//   to Supabase). They start EMPTY so the app reflects a fresh real account.
// Every screen reads/writes through useApp(); the value shape is unchanged.
// ============================================================================

const AppContext = createContext(null);

// DB stores role lowercase ('student'); the UI uses 'Student'/'Staff'/'Admin'.
const cap = (r) => (r ? r.charAt(0).toUpperCase() + r.slice(1) : "Student");
const lower = (r) => (r ? r.toLowerCase() : "student");

// Map a profiles/public_profiles row -> the object shape the screens expect.
function toUser(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.full_name,
    email: p.email ?? "",
    role: cap(p.role),
    dept: p.department ?? undefined,
    joined: p.created_at ? p.created_at.slice(0, 10) : "",
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
  const [users, setUsers] = useState([]); // directory of profiles (for names, staff list, admin)
  const [loading, setLoading] = useState(true);

  // ---- reports / items / claims (local for now, empty start) ----
  const [reports, setReports] = useState(() => loadPersisted("fixit_reports", []));
  const [items, setItems] = useState(() => loadPersisted("fixit_items", []));
  const [claims, setClaims] = useState(() => loadPersisted("fixit_claims", []));

  useEffect(() => { localStorage.setItem("fixit_reports", JSON.stringify(reports)); }, [reports]);
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
    // NOTE: keep this callback synchronous (no awaits) to avoid Supabase deadlocks.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user?.id ?? null);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  // When the signed-in user changes, load their profile.
  useEffect(() => {
    let active = true;
    if (!sessionUserId) { setCurrentUser(null); return; }
    supabase
      .from("profiles")
      .select("*")
      .eq("id", sessionUserId)
      .single()
      .then(({ data }) => { if (active) setCurrentUser(toUser(data)); });
    return () => { active = false; };
  }, [sessionUserId]);

  // Load the user directory (names for everyone; full rows incl. email for admins).
  const refreshUsers = useCallback(async () => {
    if (!currentUser) { setUsers([]); return; }
    if (currentUser.role === "Admin") {
      const { data } = await supabase.from("profiles").select("*").order("full_name");
      setUsers((data || []).map(toUser));
    } else {
      const { data } = await supabase.from("public_profiles").select("*").order("full_name");
      setUsers((data || []).map(toUser));
    }
  }, [currentUser]);

  useEffect(() => { refreshUsers(); }, [refreshUsers]);

  // ---- auth actions ----
  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { ok: false, error: "Incorrect email or password. Try again." };
    const { data: p } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    return { ok: true, user: toUser(p) || { name: email.split("@")[0], role: "Student" } };
  }

  // Public signup -> always a Student (role enforced by DB trigger).
  async function register({ name, email, password }) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });
    if (error) {
      const msg = /already/i.test(error.message)
        ? "An account with this email already exists."
        : error.message;
      return { ok: false, error: msg };
    }
    if (!data.session) {
      // Happens only if email confirmation is ON.
      return { ok: false, error: "Check your email to confirm your account, then log in." };
    }
    return { ok: true, user: { name: name.trim(), role: "Student" } };
  }

  async function logout() {
    await supabase.auth.signOut();
    setCurrentUser(null);
    navigate("/");
  }

  // Admin-only: create a Staff or Admin account without disturbing the admin's
  // own session (uses a throwaway client), then set the role/department.
  async function createUser({ name, email, password, role, dept }) {
    const tmp = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data, error } = await tmp.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });
    if (error) {
      const msg = /already/i.test(error.message)
        ? "An account with this email already exists."
        : error.message;
      return { ok: false, error: msg };
    }
    const newId = data.user?.id;
    // The profile row is created by the signup trigger (as 'student'); promote it.
    const { error: e2 } = await supabase
      .from("profiles")
      .update({ role: lower(role), department: dept?.trim() || null })
      .eq("id", newId);
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

  // ---- profile / role mutations (real) ----
  async function setRole(userId, role) {
    const { error } = await supabase.from("profiles").update({ role: lower(role) }).eq("id", userId);
    if (error) return { ok: false, error: error.message };
    await refreshUsers();
    if (currentUser && currentUser.id === userId) setCurrentUser((c) => ({ ...c, role }));
    return { ok: true };
  }

  // ---- reports / items / claims (LOCAL for now — wired to Supabase in #3–#4) ----
  function assignReport(id, staffId) {
    setReports((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, assignedStaffId: staffId };
        if (r.status === "Open") {
          next.status = "In Progress";
          next.timeline = [...r.timeline, { status: "In Progress", date: new Date().toISOString().slice(0, 10) }];
        }
        return next;
      })
    );
  }
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
    assignReport, setRole, addItem, updateItem, deleteItem, addClaim, setClaimStatus,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
