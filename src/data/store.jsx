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

// DB ride row -> screen shape. requesterIds aggregates the ride_requests join
// rows (the screen reads `requesterIds` as an array of user ids).
function toRide(r, requesterIds) {
  return {
    id: r.code,
    uuid: r.id,
    driverId: r.driver_id,
    direction: r.direction,
    vehicle: r.vehicle,
    origin: r.origin,
    destination: r.destination,
    date: r.date,
    time: r.time,
    seatsTotal: r.seats_total,
    fare: r.fare,
    recurring: r.recurring || [],
    notes: r.notes || "",
    requesterIds: requesterIds || [],
  };
}

// DB blood_requests row -> screen shape. pledgeIds aggregates the blood_pledges
// join rows (the screen reads `pledges` as an array of donor ids).
function toBloodRequest(r, pledgeIds) {
  return {
    id: r.code,
    uuid: r.id,
    group: r.blood_group,
    units: r.units,
    patient: r.patient,
    hospital: r.hospital,
    area: r.area,
    urgency: r.urgency,
    requesterId: r.requester_id,
    createdAt: day(r.created_at),
    pledges: pledgeIds || [],
  };
}

// DB donors row -> screen shape. Donor name is resolved from `users`
// (public_profiles) via userById in the screen — not stored on the row.
function toDonor(d) {
  return {
    id: d.user_id,       // one row per user; user_id is the PK
    userId: d.user_id,
    group: d.blood_group,
    area: d.area,
    lastDonated: d.last_donated || "",
  };
}

// DB bus_routes row -> screen shape. `days` is stored as a one-element text[]
// holding the display string (see migration 0022); join it back. snake_case
// columns map to the camelCase keys the screen reads.
function toBusRoute(r) {
  return {
    id: r.id,
    name: r.name,
    area: r.area,
    busNo: r.bus_no || "",
    helperName: r.helper_name || "",
    helperPhone: r.helper_phone || "",
    days: (r.days || []).join(", "),
    fridayNote: r.friday_note || "",
    stops: r.stops || [],
    legMins: r.leg_mins || [],
    toDepartures: r.to_departures || [],
    fromDepartures: r.from_departures || [],
  };
}

// DB doctors row -> screen shape (start_time/end_time -> start/end).
function toDoctor(d) {
  return {
    id: d.id,
    name: d.name,
    specialty: d.specialty,
    days: d.days || [],
    start: d.start_time,
    end: d.end_time,
    room: d.room || "",
  };
}

// DB appointments row -> screen shape (id = code for routing; uuid = real PK).
function toAppointment(a) {
  return {
    id: a.code,
    uuid: a.id,
    doctorId: a.doctor_id,
    studentId: a.student_id,
    date: a.date,
    slot: a.slot,
    token: a.token,
    status: a.status,
  };
}

// All eight campus-life features are now backed by Supabase (Phase 2 complete);
// the Phase-1 localStorage mock slices + their seed data have been removed.

export function AppProvider({ children }) {
  // ---- auth / profiles (real Supabase) ----
  const [sessionUserId, setSessionUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [profileError, setProfileError] = useState(false); // profile read failed
  const [profileTry, setProfileTry] = useState(0);          // bump to retry

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

  // ---- ride share (LIVE Supabase) ----
  const [rides, setRides] = useState([]);

  // ---- blood donation (LIVE Supabase) ----
  const [bloodRequests, setBloodRequests] = useState([]);
  const [donors, setDonors] = useState([]);

  // ---- medical center (LIVE Supabase) ----
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);

  // ---- bus schedule (LIVE Supabase) ----
  const [busRoutes, setBusRoutes] = useState([]);
  const [savedBusRoutes, setSavedBusRoutes] = useState([]); // route ids this user starred

  // ---- prayer times (LIVE Supabase) ----
  const [prayerTimes, setPrayerTimes] = useState([]);

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
    if (!sessionUserId) { setCurrentUser(null); setProfileError(false); return; }
    // Drop any previously-loaded identity that isn't this session (account
    // switch / multi-tab sync) so we show the spinner until the right profile
    // arrives instead of rendering the old user.
    setCurrentUser((prev) => (prev && prev.id === sessionUserId ? prev : null));
    setProfileError(false);
    const wanted = sessionUserId;
    supabase
      .from("profiles").select("*").eq("id", wanted).single()
      .then(({ data, error }) => {
        if (!active || wanted !== sessionUserId) return;
        // A failed/empty read leaves a terminal error state (App shows a
        // recoverable error screen) instead of an infinite spinner.
        if (error || !data) { setProfileError(true); return; }
        setCurrentUser(toUser(data));
      })
      .catch(() => { if (active) setProfileError(true); });
    return () => { active = false; };
  }, [sessionUserId, profileTry]);

  // Retry a failed profile load (from the App error screen).
  const retryProfile = useCallback(() => { setProfileError(false); setProfileTry((n) => n + 1); }, []);

  const refreshUsers = useCallback(async () => {
    if (!currentUser) { setUsers([]); return; }
    const src = currentUser.role === "Admin" ? "profiles" : "public_profiles";
    const { data } = await supabase.from(src).select("*").order("full_name");
    setUsers((data || []).map(toUser));
  }, [currentUser?.id, currentUser?.role]);

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
  }, [currentUser?.id]);

  const loadItems = useCallback(async () => {
    if (!currentUser) { setItems([]); return; }
    const { data } = await supabase
      .from("lost_found_items").select("*").order("item_date", { ascending: false });
    setItems((data || []).map(toItem));
  }, [currentUser?.id]);

  const loadClaims = useCallback(async () => {
    if (!currentUser) { setClaims([]); return; }
    const { data } = await supabase
      .from("claims")
      .select("*, item:lost_found_items(code)")
      .order("created_at", { ascending: false });
    setClaims((data || []).map(toClaim));
  }, [currentUser?.id]);

  // Announcements + this user's read receipts (RLS returns only my own reads).
  const loadAnnouncements = useCallback(async () => {
    if (!currentUser) { setAnnouncements([]); return; }
    const [{ data: rows }, { data: reads }] = await Promise.all([
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("announcement_reads").select("announcement_id"),
    ]);
    const readSet = new Set((reads || []).map((r) => r.announcement_id));
    setAnnouncements((rows || []).map((r) => toAnnouncement(r, readSet.has(r.id), currentUser.id)));
  }, [currentUser?.id]);

  const loadListings = useCallback(async () => {
    if (!currentUser) { setListings([]); return; }
    const { data } = await supabase
      .from("listings").select("*").order("created_at", { ascending: false });
    setListings((data || []).map(toListing));
  }, [currentUser?.id]);

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
  }, [currentUser?.id]);

  // Rides + seat requests (aggregated into each ride's `requesterIds` array).
  const loadRides = useCallback(async () => {
    if (!currentUser) { setRides([]); return; }
    const [{ data: rows }, { data: reqs }] = await Promise.all([
      supabase.from("rides").select("*").order("date", { ascending: true }),
      supabase.from("ride_requests").select("ride_id, requester_id"),
    ]);
    const byRide = {};
    (reqs || []).forEach((r) => { (byRide[r.ride_id] ||= []).push(r.requester_id); });
    setRides((rows || []).map((r) => toRide(r, byRide[r.id])));
  }, [currentUser?.id]);

  // Blood requests (+ pledges aggregated into each request's `pledges` array)
  // and the donor registry.
  const loadBlood = useCallback(async () => {
    if (!currentUser) { setBloodRequests([]); setDonors([]); return; }
    const [{ data: reqs }, { data: pledges }, { data: ds }] = await Promise.all([
      supabase.from("blood_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("blood_pledges").select("request_id, donor_id"),
      supabase.from("donors").select("*"),
    ]);
    const byReq = {};
    (pledges || []).forEach((p) => { (byReq[p.request_id] ||= []).push(p.donor_id); });
    setBloodRequests((reqs || []).map((r) => toBloodRequest(r, byReq[r.id])));
    setDonors((ds || []).map(toDonor));
  }, [currentUser?.id]);

  // Doctors (active reference data) + appointments (RLS returns the student's
  // own rows; admins see all).
  const loadMedical = useCallback(async () => {
    if (!currentUser) { setDoctors([]); setAppointments([]); return; }
    const [{ data: docs }, { data: appts }] = await Promise.all([
      supabase.from("doctors").select("*").eq("active", true).order("id"),
      supabase.from("appointments").select("*").order("date", { ascending: false }),
    ]);
    setDoctors((docs || []).map(toDoctor));
    setAppointments((appts || []).map(toAppointment));
  }, [currentUser?.id]);

  // Bus routes (active reference data) + this user's saved (starred) route ids.
  const loadBus = useCallback(async () => {
    if (!currentUser) { setBusRoutes([]); setSavedBusRoutes([]); return; }
    const [{ data: routes }, { data: saved }] = await Promise.all([
      supabase.from("bus_routes").select("*").eq("active", true).order("id"),
      supabase.from("saved_bus_routes").select("route_id"),
    ]);
    setBusRoutes((routes || []).map(toBusRoute));
    setSavedBusRoutes((saved || []).map((s) => s.route_id));
  }, [currentUser?.id]);

  // Prayer times config (Azan + Jamaat per prayer), ordered by `sort`.
  const loadPrayer = useCallback(async () => {
    if (!currentUser) { setPrayerTimes([]); return; }
    const { data } = await supabase.from("prayer_times").select("*").order("sort");
    setPrayerTimes(data || []);
  }, [currentUser?.id]);

  useEffect(() => {
    let active = true;
    if (currentUser?.id) setDataLoading(true);
    Promise.all([refreshUsers(), loadReports(), loadItems(), loadClaims(), loadAnnouncements(), loadListings(), loadEvents(), loadRides(), loadBlood(), loadMedical(), loadBus(), loadPrayer()]).finally(() => {
      if (active) setDataLoading(false);
    });
    return () => { active = false; };
  }, [currentUser?.id, refreshUsers, loadReports, loadItems, loadClaims, loadAnnouncements, loadListings, loadEvents, loadRides, loadBlood, loadMedical, loadBus, loadPrayer]);

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
    // When confirmation is ON and the email already exists, Supabase returns an
    // obfuscated user with empty identities (anti-enumeration) and no error.
    // Bail out before we accidentally overwrite that real account's role/dept.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      await tmp.auth.signOut();
      return { ok: false, error: "An account with this email already exists." };
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
  const doctorById = (id) => doctors.find((d) => d.id === id);
  const busById = (id) => busRoutes.find((r) => r.id === id);
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
    if (error) {
      const dup = error.code === "23505" || /duplicate|unique/i.test(error.message);
      return { ok: false, error: dup ? "You've already submitted a claim on this item." : error.message };
    }
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

  // ---- ride share (LIVE Supabase) ----
  async function addRide(data) {
    const { data: row, error } = await supabase
      .from("rides")
      .insert({
        driver_id: currentUser.id,
        direction: data.direction,
        vehicle: data.vehicle,
        origin: data.origin,
        destination: data.destination,
        date: data.date,
        time: data.time,
        seats_total: data.seatsTotal,
        fare: data.fare,
        recurring: data.recurring || [],
        notes: data.notes || null,
      })
      .select("*")
      .single();
    if (error) return { ok: false, error: error.message };
    await loadRides();
    return { ok: true, id: row.code }; // screen navigates to /rides/:id
  }
  // Request a seat as yourself (idempotent; RLS blocks requesting your own ride).
  async function requestSeat(id) {
    if (!currentUser) return { ok: false, error: "Not signed in." };
    const ride = rides.find((r) => r.id === id);
    if (!ride) return { ok: false, error: "Ride not found." };
    if (ride.requesterIds.includes(currentUser.id)) return { ok: true };
    const { error } = await supabase
      .from("ride_requests")
      .upsert(
        { ride_id: ride.uuid, requester_id: currentUser.id },
        { onConflict: "ride_id,requester_id", ignoreDuplicates: true }
      );
    if (error) return { ok: false, error: error.message };
    await loadRides();
    return { ok: true };
  }
  async function deleteRide(id) {
    const { error } = await supabase.from("rides").delete().eq("code", id);
    if (error) return { ok: false, error: error.message };
    await loadRides();
    return { ok: true };
  }
  // Name + WhatsApp of a party on a ride (driver always to requesters; a
  // requester only if they opted in via show_whatsapp — enforced in the
  // ride_contact RPC). Returns null whatsapp when not shared.
  async function getRideContact(code, targetId) {
    const { data } = await supabase.rpc("ride_contact", { p_code: code, p_target: targetId });
    const row = Array.isArray(data) ? data[0] : data;
    return row ? { name: row.name, whatsapp: row.whatsapp || "" } : null;
  }

  // ---- blood donation (LIVE Supabase) ----
  async function addBloodRequest(data) {
    const { data: row, error } = await supabase
      .from("blood_requests")
      .insert({
        blood_group: data.group,
        units: data.units,
        patient: data.patient,
        hospital: data.hospital,
        area: data.area,
        urgency: data.urgency,
        requester_id: currentUser.id,
      })
      .select("*")
      .single();
    if (error) return { ok: false, error: error.message };
    await loadBlood();
    return { ok: true, id: row.code };
  }
  // Pledge to donate (idempotent via PK). Pledging on your own request is allowed.
  async function pledgeBlood(id) {
    if (!currentUser) return { ok: false, error: "Not signed in." };
    const req = bloodRequests.find((b) => b.id === id);
    if (!req) return { ok: false, error: "Request not found." };
    if (req.pledges.includes(currentUser.id)) return { ok: true };
    const { error } = await supabase
      .from("blood_pledges")
      .upsert(
        { request_id: req.uuid, donor_id: currentUser.id },
        { onConflict: "request_id,donor_id", ignoreDuplicates: true }
      );
    if (error) return { ok: false, error: error.message };
    await loadBlood();
    return { ok: true };
  }
  // Join / update the donor registry (one row per user). The WhatsApp number the
  // donor enters is saved to their profile (donor contact = profiles.whatsapp).
  async function registerDonor(data) {
    if (!currentUser) return { ok: false, error: "Not signed in." };
    if (data.phone && data.phone !== currentUser.whatsapp) {
      const { error: pErr } = await supabase
        .from("profiles").update({ whatsapp: data.phone }).eq("id", currentUser.id);
      if (pErr) return { ok: false, error: pErr.message };
      setCurrentUser((c) => ({ ...c, whatsapp: data.phone }));
    }
    const { error } = await supabase
      .from("donors")
      .upsert(
        { user_id: currentUser.id, blood_group: data.group, area: data.area, last_donated: data.lastDonated || null },
        { onConflict: "user_id" }
      );
    if (error) return { ok: false, error: error.message };
    await loadBlood();
    return { ok: true };
  }
  // Name + WhatsApp of a registered donor (consent: registering = reachable).
  async function getDonorContact(userId) {
    const { data } = await supabase.rpc("donor_contact", { p_user_id: userId });
    const row = Array.isArray(data) ? data[0] : data;
    return row ? { name: row.name, whatsapp: row.whatsapp || "" } : null;
  }
  // Name + WhatsApp of a blood request's requester — only for a donor who pledged.
  async function getBloodRequesterContact(code) {
    const { data } = await supabase.rpc("blood_requester_contact", { p_code: code });
    const row = Array.isArray(data) ? data[0] : data;
    return row ? { name: row.name, whatsapp: row.whatsapp || "" } : null;
  }

  // ---- medical appointments (LIVE Supabase) ----
  // Token is server-set by a trigger; the unique index blocks double-booking
  // (a taken slot returns a friendly error). Returns the booked row so the
  // success modal can show the token.
  async function addAppointment({ doctorId, date, slot }) {
    const { data: row, error } = await supabase
      .from("appointments")
      .insert({ doctor_id: doctorId, student_id: currentUser.id, date, slot, status: "Booked" })
      .select("*")
      .single();
    if (error) {
      const taken = error.code === "23505" || /duplicate|unique/i.test(error.message);
      return { ok: false, error: taken ? "That slot was just taken — please pick another." : error.message };
    }
    await loadMedical();
    return { ok: true, appt: toAppointment(row) };
  }
  async function cancelAppointment(id) {
    const { error } = await supabase.from("appointments").update({ status: "Cancelled" }).eq("code", id);
    if (error) return { ok: false, error: error.message };
    await loadMedical();
    return { ok: true };
  }
  async function setAppointmentStatus(id, status) {
    const { error } = await supabase.from("appointments").update({ status }).eq("code", id);
    if (error) return { ok: false, error: error.message };
    await loadMedical();
    return { ok: true };
  }
  // Taken slots for a doctor+date — via the booked_slots RPC, since RLS hides
  // other students' appointment rows from the booking grid.
  async function getBookedSlots(doctorId, date) {
    const { data } = await supabase.rpc("booked_slots", { p_doctor_id: doctorId, p_date: date });
    return (data || []).map((r) => (typeof r === "string" ? r : Object.values(r)[0]));
  }

  // ---- bus schedule (LIVE Supabase) ----
  // Star / unstar a route for this user (saved_bus_routes join table).
  async function toggleBusSave(routeId) {
    if (!currentUser) return { ok: false, error: "Not signed in." };
    const saved = savedBusRoutes.includes(routeId);
    const { error } = saved
      ? await supabase.from("saved_bus_routes").delete().eq("user_id", currentUser.id).eq("route_id", routeId)
      : await supabase.from("saved_bus_routes").insert({ user_id: currentUser.id, route_id: routeId });
    if (error) return { ok: false, error: error.message };
    setSavedBusRoutes((s) => (saved ? s.filter((x) => x !== routeId) : [...s, routeId]));
    return { ok: true };
  }
  // Build the bus_routes column payload from the admin form. `days` is stored as
  // a one-element array (opaque display string). leg_mins is round-tripped from
  // the existing route (the form doesn't expose per-leg minutes) so editing a
  // route never destroys its real stop timings — gaps are matched to the current
  // stop count, padding any *new* gap with 10 min.
  function busRouteCols(data) {
    const stops = (data.stops || []).filter(Boolean);
    const gaps = Math.max(stops.length - 1, 0);
    const provided = Array.isArray(data.legMins) ? data.legMins : [];
    const leg_mins = Array.from({ length: gaps }, (_, i) => Number(provided[i]) || 10);
    return {
      name: data.name,
      area: data.area,
      bus_no: data.busNo || null,
      helper_name: data.helperName || null,
      helper_phone: data.helperPhone || null,
      days: data.days ? [data.days] : [],
      friday_note: data.fridayNote || "No service on Friday & government holidays.",
      stops,
      leg_mins,
      to_departures: data.toDepartures || [],
      from_departures: data.fromDepartures || [],
    };
  }
  async function addBusRoute(data) {
    // id is an admin-entered code (e.g. 'BR-12'); fall back to a slug of bus_no.
    const id = (data.id || data.busNo || "").trim();
    if (!id) return { ok: false, error: "Enter a route/bus code." };
    const { error } = await supabase.from("bus_routes").insert({ id, ...busRouteCols(data) });
    if (error) return { ok: false, error: error.message };
    await loadBus();
    return { ok: true, id };
  }
  async function updateBusRoute(id, data) {
    const { error } = await supabase.from("bus_routes").update(busRouteCols(data)).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await loadBus();
    return { ok: true, id };
  }

  // ---- prayer times (LIVE Supabase) ----
  // Admin-only (RLS): set the jamaat (congregation) time for one prayer.
  async function updatePrayerJamaat(key, jamaat) {
    const { error } = await supabase.from("prayer_times").update({ jamaat }).eq("key", key);
    if (error) return { ok: false, error: error.message };
    await loadPrayer();
    return { ok: true };
  }

  const value = {
    users, reports, items, claims,
    announcements, addAnnouncement, markAnnouncementRead, deleteAnnouncement,
    listings, addListing, updateListing, deleteListing, markListingSold, getListingContact,
    events, canCreateEvents, addEvent, toggleRSVP, deleteEvent,
    rides, addRide, requestSeat, deleteRide, getRideContact,
    bloodRequests, donors, addBloodRequest, pledgeBlood, registerDonor, getDonorContact, getBloodRequesterContact,
    doctors, doctorById, appointments, addAppointment, cancelAppointment, setAppointmentStatus, getBookedSlots,
    busRoutes, busById, savedBusRoutes, toggleBusSave, addBusRoute, updateBusRoute,
    prayerTimes, updatePrayerJamaat,
    currentUser, setCurrentUser, sessionUserId, loading, dataLoading, profileError, retryProfile,
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
