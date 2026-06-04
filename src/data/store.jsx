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

// DB announcement row -> screen shape. `id` is the code (routing); `readBy`
// only needs to reflect whether THIS user has read it (RLS hides others' reads).
function toAnnouncement(r, readByMe, userId) {
  return {
    id: r.code,
    uuid: r.id,
    title: r.title,
    body: r.body,
    department: r.department,
    priority: r.priority,
    pinned: r.pinned,
    image: r.image_url || null,            // inline notice photo/scan
    attachment: r.attachment_name || null, // display filename (PDF)
    attachmentUrl: r.attachment_url || null, // real download URL
    date: day(r.created_at),
    readBy: readByMe ? [userId] : [],
  };
}

// DB listing row -> screen shape (id = code for routing; uuid = real PK).
function toListing(r) {
  return {
    id: r.code,
    uuid: r.id,
    title: r.title,
    price: r.price,
    condition: r.condition,
    negotiable: r.negotiable,
    category: r.category,
    description: r.description,
    photo: r.photo_url || null,
    status: r.status,
    sellerId: r.seller_id,
    createdAt: day(r.created_at),
  };
}

// DB event row -> screen shape. attendeeIds aggregates the event_rsvps join
// rows (the screen reads `attendees` as an array of user ids).
function toEvent(r, attendeeIds) {
  return {
    id: r.code,
    uuid: r.id,
    title: r.title,
    category: r.category,
    organizer: r.organizer,
    date: r.date,
    time: r.time,
    endTime: r.end_time || null,
    venue: r.venue,
    description: r.description,
    capacity: r.capacity,
    banner: r.banner_url || null,
    createdById: r.created_by,
    attendees: attendeeIds || [],
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

// Next "PREFIX-<n>" code from the current max suffix, so deletes can't dup an id.
function nextMockId(list, prefix, floor) {
  const max = list.reduce((m, x) => {
    const n = parseInt(String(x.id).replace(/\D/g, ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, floor);
  return `${prefix}-${max + 1}`;
}

// Ride Share — offered rides + seat requests. Seed driver/requester ids are
// demo-only; real offers/requests use the real user id.
const SEED_RIDES = [
  { id: "RD-301", driverId: "u-stu-1", origin: "Uttara", destination: "BUBT Campus", direction: "To Campus", date: isoOffset(1), time: "07:30", seatsTotal: 3, fare: 80, vehicle: "Car", recurring: ["Sat", "Sun", "Mon", "Tue", "Wed"], notes: "AC car, leaves sharp from Uttara Sector 7. Drop near main gate.", requesterIds: ["u-stu-3"] },
  { id: "RD-298", driverId: "u-stu-2", origin: "BUBT Campus", destination: "Mirpur-10", direction: "From Campus", date: isoOffset(0), time: "17:00", seatsTotal: 2, fare: 40, vehicle: "CNG", recurring: [], notes: "Sharing a CNG after class, splitting fare.", requesterIds: [] },
  { id: "RD-295", driverId: "u-stu-3", origin: "Dhanmondi", destination: "BUBT Campus", direction: "To Campus", date: isoOffset(1), time: "08:00", seatsTotal: 4, fare: 70, vehicle: "Car", recurring: ["Sat", "Mon", "Wed"], notes: "Pickup from Dhanmondi 27, room for 4.", requesterIds: ["u-stu-1", "u-stu-2"] },
  { id: "RD-290", driverId: "u-stu-1", origin: "BUBT Campus", destination: "Gulshan-1", direction: "From Campus", date: isoOffset(2), time: "18:15", seatsTotal: 1, fare: 120, vehicle: "Bike", recurring: [], notes: "One pillion seat, helmet provided.", requesterIds: [] },
  { id: "RD-286", driverId: "u-stu-2", origin: "Savar", destination: "BUBT Campus", direction: "To Campus", date: isoOffset(1), time: "07:00", seatsTotal: 3, fare: 90, vehicle: "Car", recurring: ["Sat", "Sun", "Mon", "Tue", "Wed"], notes: "Daily commute from Savar, comfortable and on time.", requesterIds: [] },
];

// Blood donation — urgent requests + donor registry. Seed ids are demo-only.
const SEED_BLOOD_REQUESTS = [
  { id: "BQ-21", group: "O-", patient: "Rafiul (CSE, 3rd yr)", hospital: "Dhaka Medical College Hospital", units: 2, urgency: "Urgent", area: "Shahbagh", requesterId: "u-stu-3", createdAt: isoOffset(0), pledges: [] },
  { id: "BQ-19", group: "B+", patient: "Patient of Sumaiya (EEE)", hospital: "Sohrawardi Hospital", units: 1, urgency: "Today", area: "Sher-e-Bangla Nagar", requesterId: "u-stu-2", createdAt: isoOffset(0), pledges: ["u-stu-1"] },
  { id: "BQ-17", group: "A+", patient: "Father of Tanvir (BBA)", hospital: "Popular Diagnostic, Dhanmondi", units: 2, urgency: "This week", area: "Dhanmondi", requesterId: "u-stu-1", createdAt: isoOffset(-1), pledges: [] },
  { id: "BQ-14", group: "AB+", patient: "Nusaiba (Pharmacy)", hospital: "Ibn Sina Hospital, Mirpur", units: 1, urgency: "This week", area: "Mirpur-1", requesterId: "u-stu-3", createdAt: isoOffset(-2), pledges: ["u-stu-2"] },
];

const SEED_DONORS = [
  { id: "DN-1", userId: "u-stu-1", name: "Tahmid Rahman", group: "O+", area: "Mirpur-2", lastDonated: isoOffset(-150), phone: "" },
  { id: "DN-2", userId: "u-stu-2", name: "Nusrat Jahan", group: "B+", area: "Mohammadpur", lastDonated: isoOffset(-40), phone: "" },
  { id: "DN-3", userId: "u-stu-3", name: "Arefin Khan", group: "A+", area: "Uttara", lastDonated: isoOffset(-200), phone: "" },
  { id: "DN-4", userId: "u-staff-2", name: "Shahana Akter", group: "O-", area: "Savar", lastDonated: isoOffset(-95), phone: "" },
  { id: "DN-5", userId: "u-adm-1", name: "Farhana Islam", group: "AB+", area: "Gulshan", lastDonated: isoOffset(-365), phone: "" },
];

// Medical Center — appointments. Seed studentIds are demo-only, so a real
// student starts with an empty list and books fresh; doctors are in-screen.
const SEED_APPOINTMENTS = [
  { id: "APT-1001", doctorId: "d1", studentId: "u-stu-1", date: isoOffset(0), slot: "10:30", token: "T-07", status: "Confirmed" },
  { id: "APT-0998", doctorId: "d3", studentId: "u-stu-1", date: isoOffset(2), slot: "11:15", token: "T-12", status: "Booked" },
  { id: "APT-0990", doctorId: "d2", studentId: "u-stu-1", date: isoOffset(-14), slot: "10:00", token: "T-03", status: "Completed" },
  { id: "APT-0986", doctorId: "d4", studentId: "u-stu-1", date: isoOffset(-30), slot: "09:45", token: "T-09", status: "Cancelled" },
  { id: "APT-0985", doctorId: "d1", studentId: "u-stu-2", date: isoOffset(0), slot: "09:45", token: "T-05", status: "Booked" },
  { id: "APT-0980", doctorId: "d1", studentId: "u-stu-3", date: isoOffset(0), slot: "09:30", token: "T-04", status: "Confirmed" },
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

  // ---- announcements (LIVE Supabase) ----
  const [announcements, setAnnouncements] = useState([]);

  // ---- marketplace listings (LIVE Supabase) ----
  const [listings, setListings] = useState([]);

  // ---- events (LIVE Supabase) ----
  const [events, setEvents] = useState([]);
  // Admin-curated allowlist of users who may publish events (+ admins). Used to
  // gate the "Create event" UI; RLS enforces the same via can_create_events().
  const [eventOrganizers, setEventOrganizers] = useState([]);

  // ---- campus features still on PHASE-1 MOCK (localStorage) ----
  const [rides, setRides] = useState(() => loadMock("fixit_rides", SEED_RIDES));
  useEffect(() => {
    try { localStorage.setItem("fixit_rides", JSON.stringify(rides)); } catch {}
  }, [rides]);

  const [bloodRequests, setBloodRequests] = useState(() => loadMock("fixit_blood_requests", SEED_BLOOD_REQUESTS));
  useEffect(() => {
    try { localStorage.setItem("fixit_blood_requests", JSON.stringify(bloodRequests)); } catch {}
  }, [bloodRequests]);

  const [donors, setDonors] = useState(() => loadMock("fixit_donors", SEED_DONORS));
  useEffect(() => {
    try { localStorage.setItem("fixit_donors", JSON.stringify(donors)); } catch {}
  }, [donors]);

  const [appointments, setAppointments] = useState(() => loadMock("fixit_appointments", SEED_APPOINTMENTS));
  useEffect(() => {
    try { localStorage.setItem("fixit_appointments", JSON.stringify(appointments)); } catch {}
  }, [appointments]);

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

  // Announcements + this user's read receipts (RLS returns only my own reads).
  const loadAnnouncements = useCallback(async () => {
    if (!currentUser) { setAnnouncements([]); return; }
    const [{ data: rows }, { data: reads }] = await Promise.all([
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("announcement_reads").select("announcement_id"),
    ]);
    const readSet = new Set((reads || []).map((r) => r.announcement_id));
    setAnnouncements((rows || []).map((r) => toAnnouncement(r, readSet.has(r.id), currentUser.id)));
  }, [currentUser]);

  const loadListings = useCallback(async () => {
    if (!currentUser) { setListings([]); return; }
    const { data } = await supabase
      .from("listings").select("*").order("created_at", { ascending: false });
    setListings((data || []).map(toListing));
  }, [currentUser]);

  // Events + RSVPs (aggregated into each event's `attendees` array) + the
  // organizer allowlist (to gate the "Create event" button; RLS enforces it).
  const loadEvents = useCallback(async () => {
    if (!currentUser) { setEvents([]); setEventOrganizers([]); return; }
    const [{ data: rows }, { data: rsvps }, { data: orgs }] = await Promise.all([
      supabase.from("events").select("*").order("date", { ascending: true }),
      supabase.from("event_rsvps").select("event_id, user_id"),
      supabase.from("event_organizers").select("user_id"),
    ]);
    const byEvent = {};
    (rsvps || []).forEach((r) => { (byEvent[r.event_id] ||= []).push(r.user_id); });
    setEvents((rows || []).map((r) => toEvent(r, byEvent[r.id])));
    setEventOrganizers((orgs || []).map((o) => o.user_id));
  }, [currentUser]);

  useEffect(() => {
    let active = true;
    if (currentUser) setDataLoading(true);
    Promise.all([refreshUsers(), loadReports(), loadItems(), loadClaims(), loadAnnouncements(), loadListings(), loadEvents()]).finally(() => {
      if (active) setDataLoading(false);
    });
    return () => { active = false; };
  }, [currentUser, refreshUsers, loadReports, loadItems, loadClaims, loadAnnouncements, loadListings, loadEvents]);

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

  // ---- announcements (LIVE Supabase) ----
  // Upload a PDF (or any file) to the private-ish "attachments" bucket; returns
  // a public URL. (Bucket is public-read; upload is admin-only via RLS.)
  async function uploadAttachment(file) {
    const ext = (file.name?.split(".").pop() || "pdf").toLowerCase();
    const path = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("attachments")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    return supabase.storage.from("attachments").getPublicUrl(path).data.publicUrl;
  }

  // Insert is admin-only (RLS). Uploads the optional notice image + PDF first.
  // Returns { ok, id } where id is the new code.
  async function addAnnouncement(data) {
    let image_url = null, attachment_url = null, attachment_name = null;
    try {
      image_url = await resolvePhoto({ photo: data.image, photoFile: data.imageFile }, "announcements");
      if (data.attachmentFile) {
        attachment_url = await uploadAttachment(data.attachmentFile);
        attachment_name = data.attachmentFile.name;
      }
    } catch (e) {
      return { ok: false, error: "Upload failed: " + e.message };
    }
    const { data: row, error } = await supabase
      .from("announcements")
      .insert({
        title: data.title,
        body: data.body,
        department: data.department,
        priority: data.priority,
        pinned: !!data.pinned,
        image_url,
        attachment_url,
        attachment_name,
        created_by: currentUser.id,
      })
      .select("*")
      .single();
    if (error) return { ok: false, error: error.message };
    await loadAnnouncements();
    return { ok: true, id: row.code };
  }

  // Mark the current user as having read a notice (idempotent upsert).
  async function markAnnouncementRead(id) {
    if (!currentUser) return;
    const note = announcements.find((a) => a.id === id);
    if (!note || note.readBy.includes(currentUser.id)) return;
    const { error } = await supabase
      .from("announcement_reads")
      .upsert(
        { announcement_id: note.uuid, user_id: currentUser.id },
        { onConflict: "announcement_id,user_id", ignoreDuplicates: true }
      );
    if (!error) {
      setAnnouncements((as) =>
        as.map((a) => (a.id === id ? { ...a, readBy: [...a.readBy, currentUser.id] } : a))
      );
    }
  }

  // Delete a notice (admin or the author, enforced by RLS).
  async function deleteAnnouncement(id) {
    const { error } = await supabase.from("announcements").delete().eq("code", id);
    if (error) return { ok: false, error: error.message };
    await loadAnnouncements();
    return { ok: true };
  }

  // ---- marketplace listings (LIVE Supabase) ----
  // Build the insert/update column payload (uploads the photo if a new file).
  async function listingCols(data) {
    const photo_url = await resolvePhoto({ photo: data.photo, photoFile: data.photoFile }, "marketplace");
    return {
      title: data.title,
      price: data.price,
      condition: data.condition,
      negotiable: !!data.negotiable,
      category: data.category,
      description: data.description,
      photo_url,
    };
  }
  async function addListing(data) {
    let cols;
    try { cols = await listingCols(data); }
    catch (e) { return { ok: false, error: "Photo upload failed: " + e.message }; }
    const { data: row, error } = await supabase
      .from("listings")
      .insert({ ...cols, seller_id: currentUser.id })
      .select("*")
      .single();
    if (error) return { ok: false, error: error.message };
    await loadListings();
    return { ok: true, id: row.code };
  }
  async function updateListing(id, data) {
    let cols;
    try { cols = await listingCols(data); }
    catch (e) { return { ok: false, error: "Photo upload failed: " + e.message }; }
    const { error } = await supabase.from("listings").update(cols).eq("code", id);
    if (error) return { ok: false, error: error.message };
    await loadListings();
    return { ok: true };
  }
  async function deleteListing(id) {
    const { error } = await supabase.from("listings").delete().eq("code", id);
    if (error) return { ok: false, error: error.message };
    await loadListings();
    return { ok: true };
  }
  async function markListingSold(id) {
    const { error } = await supabase.from("listings").update({ status: "Sold" }).eq("code", id);
    if (error) return { ok: false, error: error.message };
    await loadListings();
    return { ok: true };
  }
  // Seller name + WhatsApp for a listing (whatsapp only if the seller opted in
  // via show_whatsapp — enforced inside the listing_contact RPC).
  async function getListingContact(code) {
    const { data } = await supabase.rpc("listing_contact", { p_code: code });
    const row = Array.isArray(data) ? data[0] : data;
    return row ? { name: row.name, whatsapp: row.whatsapp || "" } : null;
  }

  // ---- events (LIVE Supabase) ----
  // Whether the current user may publish events (admin or on the allowlist) —
  // mirrors the can_create_events() helper that RLS uses on insert.
  const canCreateEvents = !!currentUser &&
    (currentUser.role === "Admin" || eventOrganizers.includes(currentUser.id));

  // Build the insert column payload (uploads the banner if a new file).
  async function eventCols(data) {
    const banner_url = await resolvePhoto({ photo: data.banner, photoFile: data.bannerFile }, "events");
    return {
      title: data.title,
      category: data.category,
      organizer: data.organizer,
      date: data.date,
      time: data.time,
      end_time: data.endTime || null,
      venue: data.venue,
      description: data.description,
      capacity: data.capacity ?? null,
      banner_url,
    };
  }
  async function addEvent(data) {
    let cols;
    try { cols = await eventCols(data); }
    catch (e) { return { ok: false, error: "Banner upload failed: " + e.message }; }
    const { data: row, error } = await supabase
      .from("events")
      .insert({ ...cols, created_by: currentUser.id })
      .select("*")
      .single();
    if (error) return { ok: false, error: error.message };
    await loadEvents();
    return { ok: true, id: row.code }; // screen navigates to /events/:id
  }
  // Add/remove the current user's own RSVP (idempotent via the join-table PK).
  async function toggleRSVP(id) {
    if (!currentUser) return { ok: false, error: "Not signed in." };
    const ev = events.find((e) => e.id === id);
    if (!ev) return { ok: false, error: "Event not found." };
    const going = ev.attendees.includes(currentUser.id);
    const { error } = going
      ? await supabase.from("event_rsvps").delete().eq("event_id", ev.uuid).eq("user_id", currentUser.id)
      : await supabase.from("event_rsvps").insert({ event_id: ev.uuid, user_id: currentUser.id });
    if (error) return { ok: false, error: error.message };
    await loadEvents();
    return { ok: true, going: !going };
  }
  async function deleteEvent(id) {
    const { error } = await supabase.from("events").delete().eq("code", id);
    if (error) return { ok: false, error: error.message };
    await loadEvents();
    return { ok: true };
  }

  // ---- ride share (PHASE-1 MOCK) ----
  function addRide(data) {
    const ride = { requesterIds: [], ...data, id: nextMockId(rides, "RD", 301), driverId: currentUser?.id };
    setRides((r) => [ride, ...r]);
    return ride; // screen navigates to /rides/:id immediately
  }
  function requestSeat(id) {
    if (!currentUser) return;
    setRides((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        const reqs = r.requesterIds || [];
        if (reqs.includes(currentUser.id)) return r;
        return { ...r, requesterIds: [...reqs, currentUser.id] };
      })
    );
  }
  function deleteRide(id) {
    setRides((rs) => rs.filter((r) => r.id !== id));
  }

  // ---- blood donation (PHASE-1 MOCK) ----
  function addBloodRequest(data) {
    const req = { pledges: [], ...data, id: nextMockId(bloodRequests, "BQ", 21), requesterId: currentUser?.id, createdAt: isoOffset(0) };
    setBloodRequests((b) => [req, ...b]);
    return req; // screen navigates / shows confirmation with the new id
  }
  function pledgeBlood(id) {
    if (!currentUser) return;
    setBloodRequests((bs) =>
      bs.map((b) => {
        if (b.id !== id) return b;
        const pl = b.pledges || [];
        if (pl.includes(currentUser.id)) return b; // idempotent — no double-pledge
        return { ...b, pledges: [...pl, currentUser.id] };
      })
    );
  }
  function registerDonor(data) {
    if (!currentUser) return;
    setDonors((ds) => {
      const existing = ds.find((d) => d.userId === currentUser.id);
      if (existing) return ds.map((d) => (d.userId === currentUser.id ? { ...d, ...data } : d));
      return [{ id: nextMockId(ds, "DN", 0), userId: currentUser.id, name: currentUser.name, ...data }, ...ds];
    });
  }

  // ---- medical appointments (PHASE-1 MOCK) ----
  function addAppointment({ doctorId, date, slot }) {
    const n = appointments.length;
    const appt = {
      id: nextMockId(appointments, "APT", 1001),
      token: "T-" + String(13 + n).padStart(2, "0"),
      doctorId, studentId: currentUser?.id, date, slot, status: "Booked",
    };
    setAppointments((a) => [appt, ...a]);
    return appt; // booking modal shows the returned token
  }
  function cancelAppointment(id) {
    setAppointments((a) => a.map((x) => (x.id === id ? { ...x, status: "Cancelled" } : x)));
  }
  function setAppointmentStatus(id, status) {
    setAppointments((a) => a.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  const value = {
    users, reports, items, claims,
    announcements, addAnnouncement, markAnnouncementRead, deleteAnnouncement,
    listings, addListing, updateListing, deleteListing, markListingSold, getListingContact,
    events, canCreateEvents, addEvent, toggleRSVP, deleteEvent,
    rides, addRide, requestSeat, deleteRide,
    bloodRequests, donors, addBloodRequest, pledgeBlood, registerDonor,
    appointments, addAppointment, cancelAppointment, setAppointmentStatus,
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
