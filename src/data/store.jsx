import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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

// DB departments row -> screen shape (snake_case -> camelCase).
function toDepartment(d) {
  return {
    id: d.id,
    name: d.name,
    branch: d.branch,
    deptNumber: d.dept_number,
    chairman: d.chairman || "",
  };
}

// DB faculty row -> screen shape. `id` is the uuid PK (used for routing). Link
// fields collapse to a single `links` map the profile screen iterates. The
// `qualifications` jsonb is a flat array of degree strings (CSE only).
function toFaculty(f) {
  return {
    id: f.id,
    departmentId: f.department_id,
    name: f.name,
    designation: f.designation,
    email: f.email || "",
    phone: f.phone || "",
    photo: f.photo_url || null,
    interests: f.research_interests || [],
    qualifications: Array.isArray(f.qualifications) ? f.qualifications : [],
    onLeave: !!f.on_leave,
    isChairman: !!f.is_chairman,
    links: {
      scholar: f.scholar_url || null,
      researchgate: f.researchgate_url || null,
      linkedin: f.linkedin_url || null,
      orcid: f.orcid_url || null,
      website: f.website_url || null,
    },
    profileUrl: f.profile_url || null,
    dataSource: f.data_source,
  };
}

// All eight campus-life features are now backed by Supabase (Phase 2 complete);
// the Phase-1 localStorage mock slices + their seed data have been removed.

// ---- Study Hub mappers (snake_case DB -> camelCase screen shape) ----
const bytesToMB = (b) => (b == null ? null : b / (1024 * 1024));
// Short, headline department code, e.g. "Computer Science & Engineering" -> "CSE".
function deptAcronym(name) {
  const s = (name || "").replace(/^Department of\s+/i, "");
  const words = s.split(/\s+/).filter((w) => /[A-Za-z]/.test(w) && !/^(&|and|of|the|in|for)$/i.test(w));
  return words.length >= 2 ? words.map((w) => w[0].toUpperCase()).join("") : s;
}
const toStudyIntake  = (r) => ({ id: r.id, deptId: r.department_id, number: r.number, years: r.years || "" });
const toStudySection = (r) => ({ id: r.id, intakeId: r.intake_id, number: r.number });
const toStudyMember  = (r) => ({ id: r.id, sectionId: r.section_id, userId: r.user_id, role: r.role, status: r.status });
const toStudyCourse  = (r) => ({ id: r.id, sectionId: r.section_id, code: r.code, name: r.name, createdBy: r.created_by, createdAt: day(r.created_at) });
const toStudyMaterial = (r) => ({ id: r.id, courseId: r.course_id, title: r.title, type: r.type, kind: r.file_kind || "", sizeMB: bytesToMB(r.size_bytes), path: r.storage_path, byId: r.uploaded_by, createdAt: day(r.created_at) });
const toStudyQB      = (r) => ({ id: r.id, sectionId: r.section_id, courseId: r.course_id || null, exam: r.exam, title: r.title, kind: r.file_kind || "", sizeMB: bytesToMB(r.size_bytes), path: r.storage_path, verified: !!r.verified, byId: r.uploaded_by, createdAt: day(r.created_at) });
const toStudyBook    = (r) => ({ id: r.id, intakeId: r.intake_id, courseId: r.course_id || null, title: r.title, author: r.author || "", edition: r.edition || "", kind: r.kind, courseCode: r.course_code || "", path: r.storage_path || null, url: r.url || null, byId: r.added_by, createdAt: day(r.created_at) });
const toStudyPin     = (r) => ({ id: r.id, sectionId: r.section_id, kind: r.kind, message: r.message, fileName: r.file_name || null, path: r.storage_path || null, byId: r.pinned_by, createdAt: day(r.created_at) });

// Map a chosen file's extension to the screen's file-kind glyph key.
function fileKindFromName(name) {
  const e = (String(name || "").split(".").pop() || "").toLowerCase();
  if (e === "pdf") return "pdf";
  if (["doc", "docx"].includes(e)) return "docx";
  if (["ppt", "pptx"].includes(e)) return "ppt";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(e)) return "img";
  if (["zip", "rar", "7z"].includes(e)) return "zip";
  return e || "file";
}

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

  // ---- faculty directory (LIVE Supabase) ----
  const [departments, setDepartments] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [facultyBookmarks, setFacultyBookmarks] = useState([]); // faculty ids this user saved

  // ---- study hub (LIVE Supabase, migration 0046). RLS scopes every slice to
  // what this user may see (own/granted sections' content; rosters they can view).
  const [studyIntakes, setStudyIntakes] = useState([]);
  const [studySections, setStudySections] = useState([]);
  const [studyMembers, setStudyMembers] = useState([]);
  const [studyCourses, setStudyCourses] = useState([]);
  const [studyMaterials, setStudyMaterials] = useState([]);
  const [studyQuestionBank, setStudyQuestionBank] = useState([]);
  const [studyBooks, setStudyBooks] = useState([]);
  const [studyPins, setStudyPins] = useState([]);
  const [studyCRSections, setStudyCRSections] = useState([]); // section ids with an approved CR (RLS-safe, via RPC)

  // ---- club hub (LIVE Supabase, migration 0053) ----
  const [clubs, setClubs] = useState([]);
  const [clubMembers, setClubMembers] = useState([]);
  const [clubPosts, setClubPosts] = useState([]);

  // ---- jobs & internships ----
  const [jobs, setJobs] = useState([]);
  const [jobReports, setJobReports] = useState([]); // admin-only: flags awaiting review
  const [jobBookmarks, setJobBookmarks] = useState([]); // job ids this user saved

  // Latest signed-in user id — loaders compare against this after their await so a
  // slow response from a previous account can't overwrite the new account's data.
  const currentUidRef = useRef(null);
  const stillCurrent = (uid) => currentUidRef.current === uid;
  const [dataError, setDataError] = useState(false); // a background load failed (network/RLS) — show a retry banner
  const [dataTry, setDataTry] = useState(0);
  const retryData = useCallback(() => { setDataError(false); setDataTry((n) => n + 1); }, []);

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

  // Track the current user id for the loaders' stale-response guard.
  useEffect(() => { currentUidRef.current = currentUser?.id ?? null; }, [currentUser?.id]);

  const refreshUsers = useCallback(async () => {
    if (!currentUser) { setUsers([]); return; }
    const uid = currentUser.id;
    const src = currentUser.role === "Admin" ? "profiles" : "public_profiles";
    const { data, error } = await supabase.from(src).select("*").order("full_name");
    if (!stillCurrent(uid)) return;
    if (error) { setDataError(true); return; }
    setUsers((data || []).map(toUser));
  }, [currentUser?.id, currentUser?.role]);

  // ---- reports: load (RLS returns only rows this user may see) ----
  const loadReports = useCallback(async () => {
    if (!currentUser) { setReports([]); return; }
    const uid = currentUser.id;
    const { data: rows, error } = await supabase
      .from("reports").select("*").order("created_at", { ascending: false });
    if (!stillCurrent(uid)) return;
    if (error) { setDataError(true); return; }
    const ids = (rows || []).map((r) => r.id);
    const byReport = {};
    if (ids.length) {
      const { data: evs, error: e2 } = await supabase
        .from("report_events").select("*").in("report_id", ids)
        .order("created_at", { ascending: true });
      if (!stillCurrent(uid)) return;
      if (e2) { setDataError(true); return; }
      (evs || []).forEach((e) => {
        (byReport[e.report_id] ||= []).push({ status: e.status, date: day(e.created_at) });
      });
    }
    if (!stillCurrent(uid)) return;
    setReports((rows || []).map((r) => toReport(r, byReport[r.id])));
  }, [currentUser?.id]);

  const loadItems = useCallback(async () => {
    if (!currentUser) { setItems([]); return; }
    const uid = currentUser.id;
    const { data, error } = await supabase
      .from("lost_found_items").select("*").order("item_date", { ascending: false });
    if (!stillCurrent(uid)) return;
    if (error) { setDataError(true); return; }
    setItems((data || []).map(toItem));
  }, [currentUser?.id]);

  const loadClaims = useCallback(async () => {
    if (!currentUser) { setClaims([]); return; }
    const uid = currentUser.id;
    const { data, error } = await supabase
      .from("claims")
      .select("*, item:lost_found_items(code)")
      .order("created_at", { ascending: false });
    if (!stillCurrent(uid)) return;
    if (error) { setDataError(true); return; }
    setClaims((data || []).map(toClaim));
  }, [currentUser?.id]);

  // Announcements + this user's read receipts (RLS returns only my own reads).
  const loadAnnouncements = useCallback(async () => {
    if (!currentUser) { setAnnouncements([]); return; }
    const uid = currentUser.id;
    const [{ data: rows, error: e1 }, { data: reads, error: e2 }] = await Promise.all([
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("announcement_reads").select("announcement_id"),
    ]);
    if (!stillCurrent(uid)) return;
    if (e1 || e2) { setDataError(true); return; }
    const readSet = new Set((reads || []).map((r) => r.announcement_id));
    setAnnouncements((rows || []).map((r) => toAnnouncement(r, readSet.has(r.id), currentUser.id)));
  }, [currentUser?.id]);

  const loadListings = useCallback(async () => {
    if (!currentUser) { setListings([]); return; }
    const uid = currentUser.id;
    const { data, error } = await supabase
      .from("listings").select("*").order("created_at", { ascending: false });
    if (!stillCurrent(uid)) return;
    if (error) { setDataError(true); return; }
    setListings((data || []).map(toListing));
  }, [currentUser?.id]);

  // Events + RSVPs (aggregated into each event's `attendees` array) + the
  // organizer allowlist (to gate the "Create event" button; RLS enforces it).
  const loadEvents = useCallback(async () => {
    if (!currentUser) { setEvents([]); setEventOrganizers([]); return; }
    const uid = currentUser.id;
    const [{ data: rows, error: e1 }, { data: rsvps, error: e2 }, { data: orgs, error: e3 }] = await Promise.all([
      supabase.from("events").select("*").order("date", { ascending: true }),
      supabase.from("event_rsvps").select("event_id, user_id"),
      supabase.from("event_organizers").select("user_id"),
    ]);
    if (!stillCurrent(uid)) return;
    if (e1 || e2 || e3) { setDataError(true); return; }
    const byEvent = {};
    (rsvps || []).forEach((r) => { (byEvent[r.event_id] ||= []).push(r.user_id); });
    setEvents((rows || []).map((r) => toEvent(r, byEvent[r.id])));
    setEventOrganizers((orgs || []).map((o) => o.user_id));
  }, [currentUser?.id]);

  // Rides + seat requests (aggregated into each ride's `requesterIds` array).
  const loadRides = useCallback(async () => {
    if (!currentUser) { setRides([]); return; }
    const uid = currentUser.id;
    const [{ data: rows, error: e1 }, { data: reqs, error: e2 }] = await Promise.all([
      supabase.from("rides").select("*").order("date", { ascending: true }),
      supabase.from("ride_requests").select("ride_id, requester_id"),
    ]);
    if (!stillCurrent(uid)) return;
    if (e1 || e2) { setDataError(true); return; }
    const byRide = {};
    (reqs || []).forEach((r) => { (byRide[r.ride_id] ||= []).push(r.requester_id); });
    setRides((rows || []).map((r) => toRide(r, byRide[r.id])));
  }, [currentUser?.id]);

  // Blood requests (+ pledges aggregated into each request's `pledges` array)
  // and the donor registry.
  const loadBlood = useCallback(async () => {
    if (!currentUser) { setBloodRequests([]); setDonors([]); return; }
    const uid = currentUser.id;
    const [{ data: reqs, error: e1 }, { data: pledges, error: e2 }, { data: ds, error: e3 }] = await Promise.all([
      supabase.from("blood_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("blood_pledges").select("request_id, donor_id"),
      supabase.from("donors").select("*"),
    ]);
    if (!stillCurrent(uid)) return;
    if (e1 || e2 || e3) { setDataError(true); return; }
    const byReq = {};
    (pledges || []).forEach((p) => { (byReq[p.request_id] ||= []).push(p.donor_id); });
    setBloodRequests((reqs || []).map((r) => toBloodRequest(r, byReq[r.id])));
    setDonors((ds || []).map(toDonor));
  }, [currentUser?.id]);

  // Doctors (active reference data) + appointments (RLS returns the student's
  // own rows; admins see all).
  const loadMedical = useCallback(async () => {
    if (!currentUser) { setDoctors([]); setAppointments([]); return; }
    const uid = currentUser.id;
    const [{ data: docs, error: e1 }, { data: appts, error: e2 }] = await Promise.all([
      supabase.from("doctors").select("*").eq("active", true).order("id"),
      supabase.from("appointments").select("*").order("date", { ascending: false }),
    ]);
    if (!stillCurrent(uid)) return;
    if (e1 || e2) { setDataError(true); return; }
    setDoctors((docs || []).map(toDoctor));
    setAppointments((appts || []).map(toAppointment));
  }, [currentUser?.id]);

  // Bus routes (active reference data) + this user's saved (starred) route ids.
  const loadBus = useCallback(async () => {
    if (!currentUser) { setBusRoutes([]); setSavedBusRoutes([]); return; }
    const uid = currentUser.id;
    const [{ data: routes, error: e1 }, { data: saved, error: e2 }] = await Promise.all([
      supabase.from("bus_routes").select("*").eq("active", true).order("id"),
      supabase.from("saved_bus_routes").select("route_id"),
    ]);
    if (!stillCurrent(uid)) return;
    if (e1 || e2) { setDataError(true); return; }
    setBusRoutes((routes || []).map(toBusRoute));
    setSavedBusRoutes((saved || []).map((s) => s.route_id));
  }, [currentUser?.id]);

  // Prayer times config (Azan + Jamaat per prayer), ordered by `sort`.
  const loadPrayer = useCallback(async () => {
    if (!currentUser) { setPrayerTimes([]); return; }
    const uid = currentUser.id;
    const { data, error } = await supabase.from("prayer_times").select("*").order("sort");
    if (!stillCurrent(uid)) return;
    if (error) { setDataError(true); return; }
    setPrayerTimes(data || []);
  }, [currentUser?.id]);

  // Faculty directory: departments + faculty (both reference data, RLS = any
  // signed-in user reads) + this user's saved (bookmarked) faculty ids.
  const loadFaculty = useCallback(async () => {
    if (!currentUser) { setDepartments([]); setFaculty([]); setFacultyBookmarks([]); return; }
    const uid = currentUser.id;
    const [{ data: depts, error: e1 }, { data: fac, error: e2 }, { data: marks, error: e3 }] = await Promise.all([
      supabase.from("departments").select("*").order("name"),
      supabase.from("faculty").select("*").order("name"),
      supabase.from("faculty_bookmarks").select("faculty_id"),
    ]);
    if (!stillCurrent(uid)) return;
    if (e1 || e2 || e3) { setDataError(true); return; }
    setDepartments((depts || []).map(toDepartment));
    setFaculty((fac || []).map(toFaculty));
    setFacultyBookmarks((marks || []).map((m) => m.faculty_id));
  }, [currentUser?.id]);

  // Study Hub: catalogue (intakes/sections — reference) + memberships + content.
  // RLS returns only viewable content; admins get the catalogue + rosters (for
  // CR assignment) but no content. Staff don't use Study Hub, so skip the load.
  const loadStudyHub = useCallback(async () => {
    const clear = () => {
      setStudyIntakes([]); setStudySections([]); setStudyMembers([]); setStudyCourses([]);
      setStudyMaterials([]); setStudyQuestionBank([]); setStudyBooks([]); setStudyPins([]);
      setStudyCRSections([]);
    };
    if (!currentUser || (currentUser.role !== "Student" && currentUser.role !== "Admin")) { clear(); return; }
    const uid = currentUser.id;
    const [ints, secs, mems, crs, mats, qb, bks, pins, crSecs] = await Promise.all([
      supabase.from("study_intakes").select("*"),
      supabase.from("study_sections").select("*"),
      supabase.from("study_section_members").select("*"),
      supabase.from("study_courses").select("*").order("created_at", { ascending: false }),
      supabase.from("study_materials").select("*").order("created_at", { ascending: false }),
      supabase.from("study_question_bank").select("*").order("created_at", { ascending: false }),
      supabase.from("study_books").select("*").order("created_at", { ascending: false }),
      supabase.from("study_pins").select("*").order("created_at", { ascending: false }),
      supabase.rpc("study_sections_with_cr"),
    ]);
    if (!stillCurrent(uid)) return;
    if ([ints, secs, mems, crs, mats, qb, bks, pins, crSecs].some((r) => r.error)) { setDataError(true); return; }
    setStudyCRSections((crSecs.data || []).map((r) => r.section_id));
    setStudyIntakes((ints.data || []).map(toStudyIntake));
    setStudySections((secs.data || []).map(toStudySection));
    setStudyMembers((mems.data || []).map(toStudyMember));
    setStudyCourses((crs.data || []).map(toStudyCourse));
    setStudyMaterials((mats.data || []).map(toStudyMaterial));
    setStudyQuestionBank((qb.data || []).map(toStudyQB));
    setStudyBooks((bks.data || []).map(toStudyBook));
    setStudyPins((pins.data || []).map(toStudyPin));
  }, [currentUser?.id, currentUser?.role]);

  // ── Club Hub mappers ────────────────────────────────────────────────────────
  function toClub(r) {
    // cover_url stores the full public URL (set by createClub/updateClubDetails),
    // mirroring how post image_url is stored — pass it through unchanged.
    const coverUrl = r.cover_url || null;
    return {
      id: r.id, name: r.name, tagline: r.tagline || "", about: r.about || "",
      coverUrl, category: r.category, facultyAdvisorId: r.faculty_advisor_id,
      isActive: r.is_active, createdBy: r.created_by, createdAt: r.created_at,
    };
  }
  function toClubMember(r) {
    return { id: r.id, clubId: r.club_id, userId: r.user_id, role: r.role, addedBy: r.added_by, joinedAt: r.joined_at };
  }
  function toClubPost(r) {
    return {
      id: r.id, clubId: r.club_id, authorId: r.author_id, title: r.title,
      body: r.body || "", imageUrl: r.image_url || null,
      fileUrl: r.file_url || null, fileName: r.file_name || null,
      isPinned: r.is_pinned, createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }

  // Club Hub loader: all active clubs + members/posts for clubs I'm in.
  // Two round-trips: (1) clubs + my memberships in parallel,
  //                  (2) full rosters + posts for my clubs in parallel.
  const loadClubs = useCallback(async () => {
    const clear = () => { setClubs([]); setClubMembers([]); setClubPosts([]); };
    if (!currentUser) { clear(); return; }
    const uid = currentUser.id;
    const isAdmin = currentUser.role === "Admin";
    // Admins manage ALL clubs (incl. inactive) and need every roster to show
    // accurate member counts + presidents. Members see only active clubs and
    // only the rosters/posts of clubs they belong to. (Admins are excluded from
    // club_posts by RLS, so we don't fetch posts for them.)
    const [clubsRes, myRes] = await Promise.all([
      isAdmin
        ? supabase.from("clubs").select("*").order("name")
        : supabase.from("clubs").select("*").eq("is_active", true).order("name"),
      supabase.from("club_members").select("*").eq("user_id", currentUser.id),
    ]);
    if (!stillCurrent(uid)) return;
    if (clubsRes.error || myRes.error) { setDataError(true); return; }
    const myClubIds = (myRes.data || []).map((m) => m.club_id);
    const [membersRes, postsRes] = await Promise.all([
      isAdmin
        ? supabase.from("club_members").select("*")
        : (myClubIds.length
            ? supabase.from("club_members").select("*").in("club_id", myClubIds)
            : { data: [], error: null }),
      isAdmin
        ? { data: [], error: null }
        : (myClubIds.length
            ? supabase.from("club_posts").select("*").in("club_id", myClubIds).order("created_at", { ascending: false })
            : { data: [], error: null }),
    ]);
    if (!stillCurrent(uid)) return;
    if (membersRes.error || postsRes.error) { setDataError(true); return; }
    setClubs((clubsRes.data || []).map(toClub));
    setClubMembers((membersRes.data || []).map(toClubMember));
    setClubPosts((postsRes.data || []).map(toClubPost));
  }, [currentUser?.id, currentUser?.role]);

  // ── Jobs & Internships mappers + loader ─────────────────────────────────────
  // apply_file_url stores the full PUBLIC URL (job-circulars bucket), mirroring
  // how announcement attachment_url is stored — pass it through unchanged.
  function toJob(r, reportCount) {
    return {
      id: r.code, uuid: r.id,
      title: r.title, company: r.company, jobType: r.job_type,
      location: r.location, workMode: r.work_mode,
      description: r.description, requirements: r.requirements || "",
      stipend: r.stipend || "", deadline: day(r.deadline),
      applyMethod: r.apply_method, applyValue: r.apply_value || "",
      applyFileUrl: r.apply_file_url || null, applyFileName: r.apply_file_name || null,
      postedById: r.posted_by, postedByName: r.posted_by_name || "", clubId: r.club_id || null,
      removed: !!r.deleted_at, removedReason: r.removed_reason || "",
      reportCount: reportCount || 0,
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }
  function toJobReport(r) {
    return { id: r.id, jobId: r.job_id, reporterId: r.reporter_id, reason: r.reason, note: r.note || "", createdAt: r.created_at };
  }

  // Campus-wide board: every signed-in user reads active listings (RLS hides
  // removed ones from non-admins). Admins also load reports to build the
  // moderation queue + per-listing report counts.
  const loadJobs = useCallback(async () => {
    if (!currentUser) { setJobs([]); setJobReports([]); setJobBookmarks([]); return; }
    const uid = currentUser.id;
    const isAdmin = currentUser.role === "Admin";
    const [jobsRes, repsRes, bmRes] = await Promise.all([
      supabase.from("jobs").select("*").order("created_at", { ascending: false }),
      isAdmin
        ? supabase.from("job_reports").select("*").order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase.from("job_bookmarks").select("job_id"),
    ]);
    if (!stillCurrent(uid)) return;
    if (jobsRes.error || repsRes.error) { setDataError(true); return; }
    const counts = {};
    (repsRes.data || []).forEach((r) => { counts[r.job_id] = (counts[r.job_id] || 0) + 1; });
    setJobs((jobsRes.data || []).map((r) => toJob(r, counts[r.id])));
    setJobReports((repsRes.data || []).map(toJobReport));
    // Bookmarks are non-critical: if migration 0056 isn't applied yet (table
    // missing) or the read fails, show no saved items rather than breaking the
    // whole board.
    setJobBookmarks(bmRes.error ? [] : (bmRes.data || []).map((r) => r.job_id));
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    let active = true;
    if (currentUser?.id) { setDataLoading(true); setDataError(false); }
    Promise.all([refreshUsers(), loadReports(), loadItems(), loadClaims(), loadAnnouncements(), loadListings(), loadEvents(), loadRides(), loadBlood(), loadMedical(), loadBus(), loadPrayer(), loadFaculty(), loadStudyHub(), loadClubs(), loadJobs()]).finally(() => {
      if (active) setDataLoading(false);
    });
    return () => { active = false; };
  }, [currentUser?.id, dataTry, refreshUsers, loadReports, loadItems, loadClaims, loadAnnouncements, loadListings, loadEvents, loadRides, loadBlood, loadMedical, loadBus, loadPrayer, loadFaculty, loadStudyHub, loadClubs, loadJobs]);

  // ---- auth actions ----
  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: "Incorrect email or password. Try again." };
    const { data: p } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    // If the profile read hiccuped, return no user — the session effect reloads it
    // (or shows the recoverable profile-error screen). Don't fabricate a partial,
    // role-less user that would drive an initial wrong-dashboard redirect.
    return { ok: true, user: toUser(p) };
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
  const facultyById = (id) => faculty.find((f) => f.id === id);
  const departmentByNumber = (no) => departments.find((d) => d.deptNumber === String(no));
  const departmentById = (id) => departments.find((d) => d.id === id);
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
    if (!currentUser) throw new Error("Not signed in.");
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
    if (!currentUser) return { ok: false, error: "Not signed in." };
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
    if (!currentUser) return { ok: false, error: "Not signed in." };
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
    if (!currentUser) return { ok: false, error: "Not signed in." };
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
    if (!currentUser) return { ok: false, error: "Not signed in." };
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
    if (!currentUser) return { ok: false, error: "Not signed in." };
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
    if (!currentUser) return { ok: false, error: "Not signed in." };
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
    if (!currentUser) return { ok: false, error: "Not signed in." };
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
    if (!currentUser) return { ok: false, error: "Not signed in." };
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
    (currentUser.role === "Admin" ||
     eventOrganizers.includes(currentUser.id) ||
     clubMembers.some((m) => m.userId === currentUser.id && ["president", "vp"].includes(m.role)));

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
    if (!currentUser) return { ok: false, error: "Not signed in." };
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
    // A racing duplicate RSVP (23505) just means we're already going — reconcile, don't error.
    if (error && error.code !== "23505") return { ok: false, error: error.message };
    await loadEvents();
    return { ok: true, going: !going };
  }
  async function deleteEvent(id) {
    const { error } = await supabase.from("events").delete().eq("code", id);
    if (error) return { ok: false, error: error.message };
    await loadEvents();
    return { ok: true };
  }

  // ---- jobs & internships (LIVE Supabase) ----
  // Mirrors can_post_jobs() used by RLS: an admin, an event organizer, or a club
  // president/VP may post to the campus-wide jobs board.
  const canPostJobs = !!currentUser &&
    (currentUser.role === "Admin" ||
     eventOrganizers.includes(currentUser.id) ||
     clubMembers.some((m) => m.userId === currentUser.id && ["president", "vp"].includes(m.role)));

  // Upload an optional PDF circular to the public job-circulars bucket; returns
  // { url, name }. Insert is gated by can_post_jobs() + own-folder path (RLS).
  async function uploadJobCircular(file) {
    if (!currentUser) throw new Error("Not signed in.");
    const ext = (file.name?.split(".").pop() || "pdf").toLowerCase();
    const path = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("job-circulars").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    return { url: supabase.storage.from("job-circulars").getPublicUrl(path).data.publicUrl, name: file.name };
  }

  // Extract the storage path from a job-circulars public URL, for best-effort
  // cleanup of a replaced/removed PDF (the poster owns their own uploads).
  function jobCircularPath(url) {
    if (!url) return null;
    const m = String(url).split("?")[0].match(/\/job-circulars\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  // Build the insert/update column payload (uploads the circular if a new file
  // was chosen). On edit, an unchanged 'file' apply method keeps the existing
  // circular (we just don't overwrite apply_file_url); switching to link/email
  // clears it.
  async function jobCols(data) {
    const cols = {
      title: data.title, company: data.company, job_type: data.jobType,
      location: data.location, work_mode: data.workMode,
      description: data.description, requirements: data.requirements || null,
      stipend: data.stipend || null, deadline: data.deadline,
      club_id: data.clubId || null, apply_method: data.applyMethod,
      apply_value: data.applyValue || null,
    };
    if (data.applyMethod === "file") {
      cols.apply_value = null; // a file listing never carries a link/email (constraint)
      if (data.applyFile) {
        const f = await uploadJobCircular(data.applyFile);
        cols.apply_file_url = f.url; cols.apply_file_name = f.name;
      }
    } else {
      cols.apply_file_url = null; cols.apply_file_name = null;
    }
    return cols;
  }

  async function addJob(data) {
    if (!currentUser) return { ok: false, error: "Not signed in." };
    let cols;
    try { cols = await jobCols(data); }
    catch (e) { return { ok: false, error: "Upload failed: " + e.message }; }
    const { data: row, error } = await supabase
      .from("jobs")
      .insert({ ...cols, posted_by: currentUser.id, posted_by_name: currentUser.name })
      .select("code")
      .single();
    if (error) return { ok: false, error: error.message };
    await loadJobs();
    return { ok: true, id: row.code };
  }
  async function updateJob(id, data) {
    const prev = jobs.find((j) => j.id === id);
    let cols;
    try { cols = await jobCols(data); }
    catch (e) { return { ok: false, error: "Upload failed: " + e.message }; }
    // .select() so an RLS-blocked (0-row) update surfaces as an error, not a
    // silent false success.
    const { data: rows, error } = await supabase.from("jobs").update(cols).eq("code", id).select("id");
    if (error) return { ok: false, error: error.message };
    if (!rows || rows.length === 0) return { ok: false, error: "You don't have permission to edit this listing." };
    // Best-effort cleanup: if the old circular was replaced or the apply method
    // moved off 'file', delete the orphaned PDF (own uploads only, per storage RLS).
    if (prev?.applyFileUrl && (data.applyMethod !== "file" || !!data.applyFile)) {
      const path = jobCircularPath(prev.applyFileUrl);
      if (path) await supabase.storage.from("job-circulars").remove([path]);
    }
    await loadJobs();
    return { ok: true };
  }
  // Poster withdraws their own listing (soft-delete via RPC).
  async function withdrawJob(id) {
    const { error } = await supabase.rpc("job_withdraw", { p_code: id });
    if (error) return { ok: false, error: error.message };
    await loadJobs();
    return { ok: true };
  }
  // Admin removes a listing with a reason (soft-delete + reason via RPC).
  async function removeJob(id, reason) {
    const { error } = await supabase.rpc("job_admin_remove", { p_code: id, p_reason: reason });
    if (error) return { ok: false, error: error.message };
    await loadJobs();
    return { ok: true };
  }
  // Admin restores a removed listing.
  async function restoreJob(id) {
    const { error } = await supabase.rpc("job_admin_restore", { p_code: id });
    if (error) return { ok: false, error: error.message };
    await loadJobs();
    return { ok: true };
  }
  // Any signed-in user flags a listing that isn't their own; one report/user
  // (the RPC enforces both; a duplicate surfaces as 23505).
  async function reportJob(id, reason, note) {
    const { error } = await supabase.rpc("job_report", { p_code: id, p_reason: reason, p_note: note || null });
    if (error) {
      return { ok: false, error: error.code === "23505" ? "You've already reported this listing." : error.message };
    }
    await loadJobs();
    return { ok: true };
  }
  // Save / unsave a listing to the user's personal shortlist (optimistic).
  async function toggleJobBookmark(jobUuid) {
    if (!currentUser) return { ok: false, error: "Not signed in." };
    const saved = jobBookmarks.includes(jobUuid);
    const { error } = saved
      ? await supabase.from("job_bookmarks").delete().eq("user_id", currentUser.id).eq("job_id", jobUuid)
      : await supabase.from("job_bookmarks").insert({ user_id: currentUser.id, job_id: jobUuid });
    if (error) return { ok: false, error: error.message };
    setJobBookmarks((s) => (saved ? s.filter((x) => x !== jobUuid) : [...s, jobUuid]));
    return { ok: true };
  }

  // ---- ride share (LIVE Supabase) ----
  async function addRide(data) {
    if (!currentUser) return { ok: false, error: "Not signed in." };
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
    if (ride.requesterIds.length >= ride.seatsTotal) return { ok: false, error: "This ride is full." };
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
    if (!currentUser) return { ok: false, error: "Not signed in." };
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
    if (!currentUser) return { ok: false, error: "Not signed in." };
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

  // ---- faculty directory (LIVE Supabase) ----
  // Admin-only: upload a photo file to storage and set photo_url on the faculty row.
  async function uploadFacultyPhoto(facultyId, file) {
    const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
    const path = `faculty/${facultyId}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("photos")
      .upload(path, file, { cacheControl: "3600", upsert: true });
    if (upErr) return { ok: false, error: upErr.message };
    // Deterministic path + upsert overwrites the object, so add a cache-buster —
    // otherwise a re-uploaded same-name photo keeps showing the old cached image.
    const publicUrl = `${supabase.storage.from("photos").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
    const { error: dbErr } = await supabase.from("faculty").update({ photo_url: publicUrl }).eq("id", facultyId);
    if (dbErr) return { ok: false, error: dbErr.message };
    setFaculty((prev) => prev.map((f) => f.id === facultyId ? { ...f, photo: publicUrl } : f));
    return { ok: true, url: publicUrl };
  }

  // Admin-only: update editable fields on a faculty row (linkedin_url, photo_url, etc.).
  async function updateFaculty(id, updates) {
    // Allowlist the columns the admin editor may write — never trust a raw object.
    const patch = {};
    for (const k of ["linkedin_url", "photo_url"]) if (k in updates) patch[k] = updates[k];
    const { error } = await supabase.from("faculty").update(patch).eq("id", id);
    if (error) return { ok: false, error: error.message };
    setFaculty((prev) => prev.map((f) => {
      if (f.id !== id) return f;
      return {
        ...f,
        ...(updates.photo_url !== undefined && { photo: updates.photo_url || null }),
        ...(updates.linkedin_url !== undefined && {
          links: { ...f.links, linkedin: updates.linkedin_url || null },
        }),
      };
    }));
    return { ok: true };
  }

  // Save / unsave a teacher for this user (faculty_bookmarks join table).
  async function toggleFacultyBookmark(facultyId) {
    if (!currentUser) return { ok: false, error: "Not signed in." };
    const saved = facultyBookmarks.includes(facultyId);
    const { error } = saved
      ? await supabase.from("faculty_bookmarks").delete().eq("user_id", currentUser.id).eq("faculty_id", facultyId)
      : await supabase.from("faculty_bookmarks").insert({ user_id: currentUser.id, faculty_id: facultyId });
    if (error) return { ok: false, error: error.message };
    setFacultyBookmarks((s) => (saved ? s.filter((x) => x !== facultyId) : [...s, facultyId]));
    return { ok: true };
  }

  // ---- prayer times (LIVE Supabase) ----
  // Admin-only (RLS): set the jamaat (congregation) time for one prayer.
  async function updatePrayerJamaat(key, jamaat) {
    const { error } = await supabase.from("prayer_times").update({ jamaat }).eq("key", key);
    if (error) return { ok: false, error: error.message };
    await loadPrayer();
    return { ok: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Study Hub (LIVE Supabase, migration 0046)
  // ══════════════════════════════════════════════════════════════════════════

  // --- selectors (derive the screen shapes from the loaded, RLS-scoped slices)
  const studyCoursesIn = (sectionId) => studyCourses.filter((c) => c.sectionId === sectionId);
  const studyCourseById = (id) => studyCourses.find((c) => c.id === id);
  const studyFilesIn = (courseId) => studyMaterials.filter((m) => m.courseId === courseId);
  // Per-subject (course-scoped) — questions & books live inside a subject.
  // studyQuestionBankIn stays section-scoped for the home "Question papers" stat
  // (relies on uploadStudyQB back-filling section_id).
  const studyQuestionBankIn = (sectionId) => studyQuestionBank.filter((q) => q.sectionId === sectionId);
  const studyQuestionsIn = (courseId) => studyQuestionBank.filter((q) => q.courseId === courseId);
  const studyBooksInCourse = (courseId) => studyBooks.filter((b) => b.courseId === courseId);
  const studyPinsIn = (sectionId) => studyPins.filter((p) => p.sectionId === sectionId);
  const studyIntakesIn = (deptId) => studyIntakes.filter((i) => i.deptId === deptId).sort((a, b) => b.number - a.number);
  const studyPersonName = (id) => users.find((u) => u.id === id)?.name || "A classmate";
  const studyAllFilesInSection = (sectionId) => studyCoursesIn(sectionId).flatMap((c) => studyFilesIn(c.id));
  const studySectionFileCount = (section) => studyAllFilesInSection(section.id).length;

  const myStudyMemberships = () => studyMembers.filter((m) => m.userId === currentUser?.id && m.status === "approved");

  // Enrich a raw section row with the view-derived fields the screens expect.
  // crIds/editorIds are only populated for sections whose roster RLS exposes
  // (your own); other sections come back with empty rosters but a roster-
  // independent hasCR (via the study_sections_with_cr RPC).
  const studyCRSet = new Set(studyCRSections);
  function studyDeriveSection(sec) {
    if (!sec) return sec;
    const mems = studyMembers.filter((m) => m.sectionId === sec.id && m.status === "approved");
    const myApproved = new Set(myStudyMemberships().map((m) => m.sectionId));
    return {
      ...sec,
      deptId: studyIntakes.find((i) => i.id === sec.intakeId)?.deptId,
      crIds: mems.filter((m) => m.role === "cr").map((m) => m.userId), // only populated for rosters you can see
      editorIds: mems.filter((m) => m.role === "editor").map((m) => m.userId),
      hasCR: studyCRSet.has(sec.id), // roster-independent: true even when the roster is RLS-hidden
      isMine: myApproved.has(sec.id),
    };
  }
  const studySectionsIn = (intakeId) =>
    studySections.filter((s) => s.intakeId === intakeId).sort((a, b) => a.number - b.number).map(studyDeriveSection);
  const studySectionById = (id) => studyDeriveSection(studySections.find((s) => s.id === id));

  const studySectionStats = (section) => ({
    courses: studyCoursesIn(section.id).length,
    files: studyAllFilesInSection(section.id).length,
    questions: studyQuestionBankIn(section.id).length, // section-scoped via the back-filled section_id
  });

  const studyRecentActivity = (section, limit = 5) => {
    const byCourse = Object.fromEntries(studyCoursesIn(section.id).map((c) => [c.id, c]));
    const files = studyAllFilesInSection(section.id).map((f) => ({ id: `act_${f.id}`, kind: "file", title: f.title, context: byCourse[f.courseId]?.code || "", byId: f.byId, createdAt: f.createdAt }));
    const pins = studyPinsIn(section.id).map((p) => ({ id: `act_${p.id}`, kind: "pin", title: p.message, context: "Pinned", byId: p.byId, createdAt: p.createdAt }));
    return [...files, ...pins].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit);
  };

  // The signed-in student's home section (their approved membership), or null
  // (→ the first-run "request to join" state).
  const resolveMySection = () => {
    const mine = myStudyMemberships()[0];
    if (!mine) return null;
    const sec = studySections.find((s) => s.id === mine.sectionId);
    const intake = sec && studyIntakes.find((i) => i.id === sec.intakeId);
    const dept = intake && departments.find((d) => d.id === intake.deptId);
    if (!sec || !intake || !dept) return null;
    return {
      section: studyDeriveSection(sec),
      deptName: dept.name,
      deptCode: deptAcronym(dept.name),
      intakeNumber: intake.number,
      sectionNumber: sec.number,
      myRole: mine.role,
    };
  };

  // --- file helpers (private 'study-materials' bucket; objects live under `${uid}/…`)
  async function uploadStudyFile(file) {
    if (!currentUser) throw new Error("Not signed in.");
    const ext = (file.name?.split(".").pop() || "bin").toLowerCase();
    const path = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("study-materials").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    return path;
  }
  async function getStudyFileUrl(pathOrUrl) {
    if (!pathOrUrl) return null;
    if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
    const { data } = await supabase.storage.from("study-materials").createSignedUrl(pathOrUrl, 3600);
    return data?.signedUrl || null;
  }
  async function removeStudyFile(path) {
    if (!path || /^https?:\/\//.test(path)) return;
    try { await supabase.storage.from("study-materials").remove([path]); } catch { /* best-effort */ }
  }

  // --- membership (student requests; CR approves/promotes/removes) ---
  async function requestJoinSection(sectionId) {
    if (!currentUser) return { ok: false, error: "Not signed in." };
    const { error } = await supabase.from("study_section_members")
      .insert({ section_id: sectionId, user_id: currentUser.id, role: "member", status: "pending" });
    if (error) return { ok: false, error: error.code === "23505" ? "You've already requested to join this section." : error.message };
    await loadStudyHub();
    return { ok: true };
  }
  async function approveMember(memberId) {
    const { error } = await supabase.from("study_section_members").update({ status: "approved" }).eq("id", memberId);
    if (error) return { ok: false, error: error.message };
    await loadStudyHub();
    return { ok: true };
  }
  async function setMemberRole(memberId, role) {
    // CRs may only set member/editor; the CR role is admin-assigned (DB guard enforces).
    if (!["member", "editor"].includes(role)) return { ok: false, error: "Invalid role." };
    const { error } = await supabase.from("study_section_members").update({ role }).eq("id", memberId);
    if (error) return { ok: false, error: error.message };
    await loadStudyHub();
    return { ok: true };
  }
  async function removeMember(memberId) {
    const { error } = await supabase.from("study_section_members").delete().eq("id", memberId);
    if (error) return { ok: false, error: error.message };
    await loadStudyHub();
    return { ok: true };
  }

  // --- courses ---
  async function addStudyCourse(sectionId, { code, name }) {
    if (!currentUser) return { ok: false, error: "Not signed in." };
    const { error } = await supabase.from("study_courses")
      .insert({ section_id: sectionId, code: code.trim(), name: name.trim(), created_by: currentUser.id });
    if (error) return { ok: false, error: error.message };
    await loadStudyHub();
    return { ok: true };
  }
  async function deleteStudyCourse(courseId) {
    // Fetch storage paths fresh from the DB before deleting, so we catch files
    // uploaded by other users since the last data refresh (stale in-memory list
    // would miss them and leave orphaned storage objects).
    const [
      { data: matRows, error: matErr },
      { data: qbRows,  error: qbErr  },
      { data: bookRows, error: bookErr },
    ] = await Promise.all([
      supabase.from("study_materials").select("storage_path").eq("course_id", courseId),
      supabase.from("study_question_bank").select("storage_path").eq("course_id", courseId),
      supabase.from("study_books").select("storage_path").eq("course_id", courseId),
    ]);
    if (matErr || qbErr || bookErr) {
      return { ok: false, error: "Couldn't read course files before deleting. Try again." };
    }
    const paths = [
      ...(matRows || []),
      ...(qbRows  || []),
      ...(bookRows || []),
    ].map((r) => r.storage_path).filter(Boolean);

    const { error } = await supabase.from("study_courses").delete().eq("id", courseId);
    if (error) return { ok: false, error: error.message };
    await Promise.all(paths.map((p) => removeStudyFile(p)));
    await loadStudyHub();
    return { ok: true };
  }

  // --- materials (upload to bucket, then insert the row; roll back on failure) ---
  async function uploadStudyMaterial(courseId, { title, type, file }) {
    if (!currentUser) return { ok: false, error: "Not signed in." };
    let path;
    try { path = await uploadStudyFile(file); } catch (e) { return { ok: false, error: "Upload failed: " + e.message }; }
    const { error } = await supabase.from("study_materials").insert({
      course_id: courseId, title: title.trim(), type, storage_path: path,
      file_kind: fileKindFromName(file.name), size_bytes: file.size, uploaded_by: currentUser.id,
    });
    if (error) { await removeStudyFile(path); return { ok: false, error: error.message }; }
    await loadStudyHub();
    return { ok: true };
  }
  async function deleteStudyMaterial(materialId) {
    const m = studyMaterials.find((x) => x.id === materialId);
    const { error } = await supabase.from("study_materials").delete().eq("id", materialId);
    if (error) return { ok: false, error: error.message };
    if (m?.path) await removeStudyFile(m.path);
    await loadStudyHub();
    return { ok: true };
  }

  // --- question bank (per-course; section_id derived from the course for integrity) ---
  async function uploadStudyQB(courseId, { exam, title, file }) {
    if (!currentUser) return { ok: false, error: "Not signed in." };
    const sectionId = studyCourseById(courseId)?.sectionId;
    if (!sectionId) return { ok: false, error: "Course not found." };
    let path;
    try { path = await uploadStudyFile(file); } catch (e) { return { ok: false, error: "Upload failed: " + e.message }; }
    const { error } = await supabase.from("study_question_bank").insert({
      course_id: courseId, section_id: sectionId, exam, title: title.trim(), storage_path: path,
      file_kind: fileKindFromName(file.name), size_bytes: file.size, uploaded_by: currentUser.id,
    });
    if (error) { await removeStudyFile(path); return { ok: false, error: error.message }; }
    await loadStudyHub();
    return { ok: true };
  }
  async function setQBVerified(qbId, verified) {
    const { error } = await supabase.from("study_question_bank").update({ verified }).eq("id", qbId);
    if (error) return { ok: false, error: error.message };
    await loadStudyHub();
    return { ok: true };
  }
  async function deleteStudyQB(qbId) {
    const q = studyQuestionBank.find((x) => x.id === qbId);
    const { error } = await supabase.from("study_question_bank").delete().eq("id", qbId);
    if (error) return { ok: false, error: error.message };
    if (q?.path) await removeStudyFile(q.path);
    await loadStudyHub();
    return { ok: true };
  }

  // --- books (per-course; file OR url; intake_id derived from the course) ---
  async function addStudyBook(courseId, { title, kind, author, courseCode, file, url }) {
    if (!currentUser) return { ok: false, error: "Not signed in." };
    const course = studyCourseById(courseId);
    const intakeId = course && studySections.find((s) => s.id === course.sectionId)?.intakeId;
    if (!intakeId) return { ok: false, error: "Course not found." };
    let path = null;
    if (file) { try { path = await uploadStudyFile(file); } catch (e) { return { ok: false, error: "Upload failed: " + e.message }; } }
    const { error } = await supabase.from("study_books").insert({
      course_id: courseId, intake_id: intakeId, title: title.trim(), kind, author: author?.trim() || null,
      course_code: courseCode?.trim() || null, storage_path: path, url: url?.trim() || null, added_by: currentUser.id,
    });
    if (error) { if (path) await removeStudyFile(path); return { ok: false, error: error.message }; }
    await loadStudyHub();
    return { ok: true };
  }
  async function deleteStudyBook(bookId) {
    const b = studyBooks.find((x) => x.id === bookId);
    const { error } = await supabase.from("study_books").delete().eq("id", bookId);
    if (error) return { ok: false, error: error.message };
    if (b?.path) await removeStudyFile(b.path);
    await loadStudyHub();
    return { ok: true };
  }

  // --- pins (CR only; text or file) ---
  async function addStudyPin(sectionId, { kind, message, file }) {
    if (!currentUser) return { ok: false, error: "Not signed in." };
    let path = null, fileName = null;
    if (kind === "file" && file) {
      try { path = await uploadStudyFile(file); } catch (e) { return { ok: false, error: "Upload failed: " + e.message }; }
      fileName = file.name;
    }
    const { error } = await supabase.from("study_pins").insert({
      section_id: sectionId, kind, message: message.trim(), storage_path: path, file_name: fileName, pinned_by: currentUser.id,
    });
    if (error) { if (path) await removeStudyFile(path); return { ok: false, error: error.message }; }
    await loadStudyHub();
    return { ok: true };
  }
  async function deleteStudyPin(pinId) {
    const p = studyPins.find((x) => x.id === pinId);
    const { error } = await supabase.from("study_pins").delete().eq("id", pinId);
    if (error) return { ok: false, error: error.message };
    if (p?.path) await removeStudyFile(p.path);
    await loadStudyHub();
    return { ok: true };
  }

  // --- admin: catalogue + CR assignment ---
  async function addStudyIntake(deptId, number, years) {
    const { error } = await supabase.from("study_intakes").insert({ department_id: deptId, number, years: years || null });
    if (error) return { ok: false, error: error.code === "23505" ? "That intake already exists." : error.message };
    await loadStudyHub();
    return { ok: true };
  }
  async function addStudySection(intakeId, number) {
    const { error } = await supabase.from("study_sections").insert({ intake_id: intakeId, number });
    if (error) return { ok: false, error: error.code === "23505" ? "That section already exists." : error.message };
    await loadStudyHub();
    return { ok: true };
  }
  async function assignSectionCR(sectionId, userId) {
    const { error } = await supabase.from("study_section_members")
      .upsert({ section_id: sectionId, user_id: userId, role: "cr", status: "approved" }, { onConflict: "section_id,user_id" });
    if (error) return { ok: false, error: error.message };
    await loadStudyHub();
    return { ok: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Club Hub — selectors + actions (migration 0053)
  // ══════════════════════════════════════════════════════════════════════════

  // --- selectors ---
  const myClubs = () => {
    const myIds = new Set(clubMembers.filter((m) => m.userId === currentUser?.id).map((m) => m.clubId));
    return clubs.filter((c) => c.isActive && myIds.has(c.id));
  };
  const clubById = (id) => clubs.find((c) => c.id === id);
  const ROLE_ORDER = { president: 0, vp: 1, editor: 2, member: 3 };
  const clubMembersIn = (clubId) =>
    clubMembers.filter((m) => m.clubId === clubId)
      .sort((a, b) => (ROLE_ORDER[a.role] ?? 4) - (ROLE_ORDER[b.role] ?? 4));
  const clubPostsIn = (clubId) => {
    const all = clubPosts.filter((p) => p.clubId === clubId);
    const pinned = all.filter((p) => p.isPinned);
    const rest   = all.filter((p) => !p.isPinned);
    return [...pinned, ...rest];
  };
  const userRoleIn    = (clubId) => clubMembers.find((m) => m.clubId === clubId && m.userId === currentUser?.id)?.role ?? null;
  const canPostIn     = (clubId) => ["president", "vp", "editor"].includes(userRoleIn(clubId));
  const canManageClub = (clubId) => ["president", "vp"].includes(userRoleIn(clubId));
  const isPresident   = (clubId) => userRoleIn(clubId) === "president";

  // --- upload a file attachment to club-attachments bucket ---
  async function uploadClubAttachment(file, clubId) {
    if (!currentUser) throw new Error("Not signed in.");
    const ext = (file.name?.split(".").pop() || "bin").toLowerCase();
    const path = `${clubId}/${currentUser.id}_${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("club-attachments").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    return { path, name: file.name };
  }

  // Generate a short-lived signed URL for a club attachment.
  async function getClubFileUrl(path) {
    if (!path) return null;
    const { data } = await supabase.storage.from("club-attachments").createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  }

  // --- member management ---
  async function addClubMembers(clubId, userIds) {
    const rows = userIds.map((userId) => ({ club_id: clubId, user_id: userId, role: "member", added_by: currentUser.id }));
    const { error } = await supabase.from("club_members").insert(rows);
    if (error) return { ok: false, error: error.code === "23505" ? "One or more users are already members." : error.message };
    await loadClubs();
    return { ok: true };
  }
  async function removeClubMember(clubId, userId) {
    const { data: rows, error } = await supabase.from("club_members").delete().match({ club_id: clubId, user_id: userId }).select("id");
    if (error) return { ok: false, error: error.message };
    if (!rows || rows.length === 0) return { ok: false, error: "You don't have permission to remove this member." };
    await loadClubs();
    return { ok: true };
  }
  async function updateClubMemberRole(clubId, userId, role) {
    const { data: rows, error } = await supabase.from("club_members").update({ role }).match({ club_id: clubId, user_id: userId }).select("id");
    if (error) return { ok: false, error: error.message };
    if (!rows || rows.length === 0) return { ok: false, error: "Only the president can change member roles." };
    await loadClubs();
    return { ok: true };
  }
  async function leaveClub(clubId) {
    const { error } = await supabase.from("club_members").delete().match({ club_id: clubId, user_id: currentUser.id });
    if (error) return { ok: false, error: error.message };
    await loadClubs();
    return { ok: true };
  }

  // --- posts ---
  async function addClubPost(clubId, data) {
    let imageUrl = null, fileUrl = null, fileName = null;
    try {
      // Post images go to the PRIVATE, member-gated club-attachments bucket
      // (stored as a path, rendered via a signed URL) so non-members can't see
      // them — posts are member-only by design.
      if (data.imageFile) {
        const img = await uploadClubAttachment(data.imageFile, clubId);
        imageUrl = img.path;
      }
      if (data.attachmentFile) {
        const att = await uploadClubAttachment(data.attachmentFile, clubId);
        fileUrl = att.path; fileName = att.name;
      }
    } catch (e) { return { ok: false, error: "Upload failed: " + e.message }; }
    const { error } = await supabase.from("club_posts").insert({
      club_id: clubId, author_id: currentUser.id,
      title: data.title.trim(), body: data.body?.trim() || null,
      image_url: imageUrl, file_url: fileUrl, file_name: fileName,
      is_pinned: data.isPinned || false,
    });
    if (error) return { ok: false, error: error.message };
    await loadClubs();
    return { ok: true };
  }
  async function updateClubPost(postId, data) {
    const prev = clubPosts.find((p) => p.id === postId);
    const updates = {
      title: data.title.trim(), body: data.body?.trim() || null,
      is_pinned: data.isPinned || false,
    };
    try {
      if (data.imageFile) {
        const img = await uploadClubAttachment(data.imageFile, data.clubId);
        updates.image_url = img.path;
      } else if (data.removeImage) {
        updates.image_url = null;
      }
      if (data.attachmentFile) {
        const att = await uploadClubAttachment(data.attachmentFile, data.clubId);
        updates.file_url = att.path; updates.file_name = att.name;
      } else if (data.removeAttachment) {
        updates.file_url = null; updates.file_name = null;
      }
    } catch (e) { return { ok: false, error: "Upload failed: " + e.message }; }
    // .select() so an RLS-blocked (0-row) update surfaces as an error, not a
    // silent false success.
    const { data: rows, error } = await supabase.from("club_posts").update(updates).eq("id", postId).select("id");
    if (error) return { ok: false, error: error.message };
    if (!rows || rows.length === 0) return { ok: false, error: "You don't have permission to edit this post." };
    // best-effort cleanup of replaced/removed files (own uploads only per storage RLS).
    const stale = [];
    if (prev?.imageUrl && (data.imageFile || data.removeImage)) stale.push(prev.imageUrl);
    if (prev?.fileUrl && (data.attachmentFile || data.removeAttachment)) stale.push(prev.fileUrl);
    if (stale.length) await supabase.storage.from("club-attachments").remove(stale);
    await loadClubs();
    return { ok: true };
  }
  async function deleteClubPost(postId) {
    const post = clubPosts.find((p) => p.id === postId);
    const { data: rows, error } = await supabase.from("club_posts").delete().eq("id", postId).select("id");
    if (error) return { ok: false, error: error.message };
    if (!rows || rows.length === 0) return { ok: false, error: "You don't have permission to delete this post." };
    const stale = [post?.imageUrl, post?.fileUrl].filter(Boolean);
    if (stale.length) await supabase.storage.from("club-attachments").remove(stale);
    await loadClubs();
    return { ok: true };
  }
  async function toggleClubPin(postId) {
    const post = clubPosts.find((p) => p.id === postId);
    if (!post) return { ok: false, error: "Post not found." };
    const { data: rows, error } = await supabase.from("club_posts").update({ is_pinned: !post.isPinned }).eq("id", postId).select("id");
    if (error) return { ok: false, error: error.message };
    if (!rows || rows.length === 0) return { ok: false, error: "You don't have permission to pin this post." };
    await loadClubs();
    return { ok: true };
  }

  // --- admin: club management ---
  async function createClub(data) {
    let coverUrl = null;
    try {
      if (data.coverFile) {
        const ext = (data.coverFile.name?.split(".").pop() || "jpg").toLowerCase();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: ue } = await supabase.storage.from("club-covers").upload(path, data.coverFile, { cacheControl: "3600", upsert: false });
        if (ue) return { ok: false, error: "Cover upload failed: " + ue.message };
        coverUrl = supabase.storage.from("club-covers").getPublicUrl(path).data.publicUrl;
      }
    } catch (e) { return { ok: false, error: e.message }; }
    const { data: club, error } = await supabase.from("clubs").insert({
      name: data.name.trim(), tagline: data.tagline?.trim() || null,
      about: data.about?.trim() || null, cover_url: coverUrl,
      category: data.category, faculty_advisor_id: data.facultyAdvisorId || null,
      created_by: currentUser.id,
    }).select().single();
    if (error) return { ok: false, error: error.message };
    if (data.presidentId) {
      const { error: pe } = await supabase.from("club_members")
        .insert({ club_id: club.id, user_id: data.presidentId, role: "president", added_by: currentUser.id });
      if (pe) {
        // roll back so we never leave a president-less, half-created club
        await supabase.from("clubs").delete().eq("id", club.id);
        return { ok: false, error: "President assignment failed: " + pe.message };
      }
    }
    await loadClubs();
    return { ok: true, id: club.id };
  }
  async function updateClubDetails(clubId, data) {
    // Cover upload stays admin-gated (club-covers storage policy is admin-only),
    // so only the admin path passes a coverFile. A new cover yields a public
    // URL; null leaves the existing cover unchanged (RPC coalesces).
    let coverUrl = null;
    try {
      if (data.coverFile) {
        const ext = (data.coverFile.name?.split(".").pop() || "jpg").toLowerCase();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: ue } = await supabase.storage.from("club-covers").upload(path, data.coverFile, { cacheControl: "3600", upsert: false });
        if (ue) return { ok: false, error: "Cover upload failed: " + ue.message };
        coverUrl = supabase.storage.from("club-covers").getPublicUrl(path).data.publicUrl;
      }
    } catch (e) { return { ok: false, error: e.message }; }
    // Routed through a SECURITY DEFINER RPC (migration 0054) so a President/VP
    // — not just an admin — can edit their club. The RPC authorizes
    // club_can_manage OR is_admin and writes only safe columns.
    const { error } = await supabase.rpc("club_update_details", {
      p_club_id: clubId,
      p_name: data.name.trim(),
      p_tagline: data.tagline?.trim() || null,
      p_about: data.about?.trim() || null,
      p_category: data.category,
      p_advisor: data.facultyAdvisorId || null,
      p_cover_url: coverUrl,
    });
    if (error) return { ok: false, error: error.message };
    await loadClubs();
    return { ok: true };
  }
  async function setClubActive(clubId, isActive) {
    const { error } = await supabase.from("clubs").update({ is_active: isActive }).eq("id", clubId);
    if (error) return { ok: false, error: error.message };
    await loadClubs();
    return { ok: true };
  }
  async function assignClubPresident(clubId, newPresidentId) {
    // Atomic demote-then-promote inside a SECURITY DEFINER RPC (migration 0054)
    // so a failure can never leave a club president-less or with two presidents.
    const { error } = await supabase.rpc("club_set_president", {
      p_club_id: clubId, p_user_id: newPresidentId,
    });
    if (error) return { ok: false, error: error.message };
    await loadClubs();
    return { ok: true };
  }

  const value = {
    users, reports, items, claims,
    announcements, addAnnouncement, markAnnouncementRead, deleteAnnouncement,
    listings, addListing, updateListing, deleteListing, markListingSold, getListingContact,
    events, canCreateEvents, addEvent, toggleRSVP, deleteEvent,
    jobs, jobReports, jobBookmarks, canPostJobs, addJob, updateJob, withdrawJob, removeJob, restoreJob, reportJob, toggleJobBookmark,
    rides, addRide, requestSeat, deleteRide, getRideContact,
    bloodRequests, donors, addBloodRequest, pledgeBlood, registerDonor, getDonorContact, getBloodRequesterContact,
    doctors, doctorById, appointments, addAppointment, cancelAppointment, setAppointmentStatus, getBookedSlots,
    busRoutes, busById, savedBusRoutes, toggleBusSave, addBusRoute, updateBusRoute,
    prayerTimes, updatePrayerJamaat,
    departments, faculty, facultyBookmarks, facultyById, departmentByNumber, departmentById, toggleFacultyBookmark, updateFaculty, uploadFacultyPhoto,
    // study hub (data)
    studyIntakes, studySections, studyMembers, studyCourses, studyMaterials, studyQuestionBank, studyBooks, studyPins,
    // study hub (selectors)
    studyCoursesIn, studyCourseById, studyFilesIn, studyQuestionBankIn, studyQuestionsIn, studyBooksInCourse, studyPinsIn, studyIntakesIn,
    studySectionsIn, studySectionById, studyPersonName, studySectionFileCount, studySectionStats, studyRecentActivity, resolveMySection,
    // study hub (files)
    getStudyFileUrl,
    // study hub (actions)
    requestJoinSection, approveMember, setMemberRole, removeMember,
    addStudyCourse, deleteStudyCourse, uploadStudyMaterial, deleteStudyMaterial,
    uploadStudyQB, setQBVerified, deleteStudyQB, addStudyBook, deleteStudyBook, addStudyPin, deleteStudyPin,
    addStudyIntake, addStudySection, assignSectionCR,
    // club hub (data)
    clubs, clubMembers, clubPosts,
    // club hub (selectors)
    myClubs, clubById, clubMembersIn, clubPostsIn, userRoleIn, canPostIn, canManageClub, isPresident,
    // club hub (files)
    getClubFileUrl,
    // club hub (actions)
    addClubMembers, removeClubMember, updateClubMemberRole, leaveClub,
    addClubPost, updateClubPost, deleteClubPost, toggleClubPin,
    createClub, updateClubDetails, setClubActive, assignClubPresident,
    currentUser, sessionUserId, loading, dataLoading, profileError, retryProfile, dataError, retryData,
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
