import React, { createContext, useContext, useState, useEffect } from "react";
import { navigate } from "../lib/router.jsx";

// ============================================================================
// MOCK DATA STORE  ⚠️  Replace this whole file when wiring a real backend.
// ----------------------------------------------------------------------------
// This is the ONLY stateful/data module. Every screen is presentational and
// reads/writes through the `useApp()` context, so to go live you only need to:
//   1. Swap the seed arrays + localStorage for API calls (fetch/react-query…).
//   2. Replace the auth functions (login/register/logout) with real auth.
//   3. Keep the same shape of the `value` object so screens keep working.
// ============================================================================

const STAFF_LIST = [
  { id: "u-staff-1", name: "Rahim Uddin", email: "rahim@bubt.edu.bd", dept: "Electrical & IT" },
  { id: "u-staff-2", name: "Shahana Akter", email: "shahana@bubt.edu.bd", dept: "Plumbing & Cleaning" },
  { id: "u-staff-3", name: "Kamrul Hasan", email: "kamrul@bubt.edu.bd", dept: "Facilities" },
];

const SEED_USERS = [
  { id: "u-stu-1", name: "Tahmid Rahman", email: "tahmid@bubt.edu.bd", role: "Student", joined: "2025-01-14" },
  { id: "u-stu-2", name: "Nusrat Jahan", email: "nusrat@bubt.edu.bd", role: "Student", joined: "2025-02-03" },
  { id: "u-stu-3", name: "Arefin Khan", email: "arefin@bubt.edu.bd", role: "Student", joined: "2025-02-20" },
  { id: "u-staff-1", name: "Rahim Uddin", email: "rahim@bubt.edu.bd", role: "Staff", joined: "2024-11-02", dept: "Electrical & IT" },
  { id: "u-staff-2", name: "Shahana Akter", email: "shahana@bubt.edu.bd", role: "Staff", joined: "2024-11-10", dept: "Plumbing & Cleaning" },
  { id: "u-staff-3", name: "Kamrul Hasan", email: "kamrul@bubt.edu.bd", role: "Staff", joined: "2025-01-05", dept: "Facilities" },
  { id: "u-adm-1", name: "Farhana Islam", email: "admin@bubt.edu.bd", role: "Admin", joined: "2024-09-01" },
];

const DEMO_PASSWORD = "password123";

const tl = (status, date) => ({ status, date });

const SEED_REPORTS = [
  { id: "R-1042", category: "IT / Network", description: "Projector in Room 402 won't connect to any laptop over HDMI. Tried three cables — no signal. Class of 60 students affected each morning.", building: "Building B", room: "402", photo: null, status: "Open", studentId: "u-stu-1", assignedStaffId: null, createdAt: "2026-05-30", timeline: [tl("Open", "2026-05-30")] },
  { id: "R-1039", category: "Electrical", description: "Two ceiling lights flickering badly in the second-floor corridor near the stairwell. Started after the last power cut.", building: "Building A", room: "Corridor 2F", photo: null, status: "In Progress", studentId: "u-stu-1", assignedStaffId: "u-staff-1", createdAt: "2026-05-27", timeline: [tl("Open", "2026-05-27"), tl("In Progress", "2026-05-28")] },
  { id: "R-1036", category: "Plumbing", description: "Tap in the ground-floor washroom is leaking continuously. Floor stays wet and slippery.", building: "Library", room: "Ground floor", photo: null, status: "Resolved", studentId: "u-stu-2", assignedStaffId: "u-staff-2", createdAt: "2026-05-22", timeline: [tl("Open", "2026-05-22"), tl("In Progress", "2026-05-23"), tl("Resolved", "2026-05-25")] },
  { id: "R-1034", category: "Furniture", description: "Three chairs in Lab 3 have broken backrests and are unsafe to sit on.", building: "Building C", room: "Lab 3", photo: null, status: "In Progress", studentId: "u-stu-3", assignedStaffId: "u-staff-3", createdAt: "2026-05-20", timeline: [tl("Open", "2026-05-20"), tl("In Progress", "2026-05-24")] },
  { id: "R-1030", category: "Cleanliness", description: "Overflowing bins outside the cafeteria haven't been cleared for two days.", building: "Cafeteria", room: "Entrance", photo: null, status: "Open", studentId: "u-stu-2", assignedStaffId: null, createdAt: "2026-05-18", timeline: [tl("Open", "2026-05-18")] },
  { id: "R-1025", category: "Safety / Security", description: "Emergency exit door on the 3rd floor is jammed and will not open from inside.", building: "Building B", room: "Exit 3F", photo: null, status: "Resolved", studentId: "u-stu-1", assignedStaffId: "u-staff-3", createdAt: "2026-05-12", timeline: [tl("Open", "2026-05-12"), tl("In Progress", "2026-05-13"), tl("Resolved", "2026-05-15")] },
  { id: "R-1019", category: "IT / Network", description: "Wi-Fi completely dead in the reading hall — no signal from any access point.", building: "Library", room: "Reading Hall", photo: null, status: "Rejected", studentId: "u-stu-3", assignedStaffId: null, createdAt: "2026-05-08", timeline: [tl("Open", "2026-05-08"), tl("Rejected", "2026-05-09")] },
  { id: "R-1015", category: "Electrical", description: "Power socket near the lab bench sparks when anything is plugged in. Stopped using it for safety.", building: "Building C", room: "Lab 1", photo: null, status: "In Progress", studentId: "u-stu-2", assignedStaffId: "u-staff-1", createdAt: "2026-05-29", timeline: [tl("Open", "2026-05-29"), tl("In Progress", "2026-05-30")] },
  { id: "R-1011", category: "IT / Network", description: "Desktop in the computer lab won't boot — fans spin but no display output.", building: "Building C", room: "Computer Lab", photo: null, status: "Resolved", studentId: "u-stu-3", assignedStaffId: "u-staff-1", createdAt: "2026-05-16", timeline: [tl("Open", "2026-05-16"), tl("In Progress", "2026-05-17"), tl("Resolved", "2026-05-19")] },
  { id: "R-1007", category: "IT / Network", description: "Projector remote missing from Room 305 — can't switch inputs during class.", building: "Building B", room: "305", photo: null, status: "Resolved", studentId: "u-stu-1", assignedStaffId: "u-staff-1", createdAt: "2026-05-10", timeline: [tl("Open", "2026-05-10"), tl("In Progress", "2026-05-11"), tl("Resolved", "2026-05-12")] },
];

const SEED_ITEMS = [
  { id: "I-301", type: "Found", title: "Black framed eyeglasses", category: "Personal", description: "Found a pair of black-framed glasses in a soft case left on a desk in Room 210 after the morning lecture.", location: "Building A, Room 210", date: "2026-05-29", photo: null, posterId: "u-stu-2" },
  { id: "I-298", type: "Lost", title: "Blue Hydro water bottle", category: "Personal", description: "Lost my navy-blue insulated water bottle, has a BUBT sticker on it. Last seen in the cafeteria around noon.", location: "Cafeteria", date: "2026-05-28", photo: null, posterId: "u-stu-1" },
  { id: "I-295", type: "Found", title: "Casio scientific calculator", category: "Electronics", description: "Found a Casio fx-991 calculator under a seat in Lab 2. Name partly scratched off the back.", location: "Building C, Lab 2", date: "2026-05-26", photo: null, posterId: "u-stu-3" },
  { id: "I-290", type: "Lost", title: "Student ID card — Nusrat J.", category: "Documents", description: "Lost my BUBT student ID card somewhere between the library and the bus stop.", location: "Library / Gate 2", date: "2026-05-24", photo: null, posterId: "u-stu-2" },
  { id: "I-286", type: "Found", title: "Set of keys with red tag", category: "Personal", description: "Bunch of three keys on a ring with a red plastic tag, found near the prayer room.", location: "Building A, Prayer room", date: "2026-05-21", photo: null, posterId: "u-stu-1" },
  { id: "I-281", type: "Lost", title: "Grey laptop sleeve", category: "Electronics", description: "Lost a grey neoprene laptop sleeve (13 inch). Has a small enamel pin on the front.", location: "Building B, 4th floor", date: "2026-05-19", photo: null, posterId: "u-stu-3" },
];

const SEED_CLAIMS = [
  { id: "C-51", itemId: "I-301", claimantId: "u-stu-1", kind: "claim", message: "Those are mine — I lost them after the 9am class in Room 210. They're black Ray-Ban frames with a small chip on the left arm and a blue cleaning cloth in the case.", proof: null, status: "Pending", createdAt: "2026-05-30" },
  { id: "C-48", itemId: "I-295", claimantId: "u-stu-2", kind: "claim", message: "I believe this is my calculator. My name 'Nusrat' was written on the back near the battery cover before it scratched. Serial sticker is partly peeled.", proof: null, status: "Pending", createdAt: "2026-05-27" },
  { id: "C-44", itemId: "I-286", claimantId: "u-stu-3", kind: "claim", message: "Those look like my house keys — red tag with a faded star sticker. I dropped them near the prayer room on Tuesday.", proof: null, status: "Approved", createdAt: "2026-05-22" },
];

const AppContext = createContext(null);

function loadPersisted(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function AppProvider({ children }) {
  const [users, setUsers] = useState(() => loadPersisted("fixit_users", SEED_USERS));
  const [reports, setReports] = useState(() => loadPersisted("fixit_reports", SEED_REPORTS));
  const [items, setItems] = useState(() => loadPersisted("fixit_items", SEED_ITEMS));
  const [claims, setClaims] = useState(() => loadPersisted("fixit_claims", SEED_CLAIMS));
  const [currentUser, setCurrentUser] = useState(() => loadPersisted("fixit_currentUser", null));

  useEffect(() => { localStorage.setItem("fixit_users", JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem("fixit_reports", JSON.stringify(reports)); }, [reports]);
  useEffect(() => { localStorage.setItem("fixit_items", JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem("fixit_claims", JSON.stringify(claims)); }, [claims]);
  useEffect(() => {
    if (currentUser) localStorage.setItem("fixit_currentUser", JSON.stringify(currentUser));
    else localStorage.removeItem("fixit_currentUser");
  }, [currentUser]);

  // ---- auth ----
  function login(email, password) {
    const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || password !== DEMO_PASSWORD) {
      return { ok: false, error: "Incorrect email or password. Try again." };
    }
    setCurrentUser(user);
    return { ok: true, user };
  }

  function register({ name, email }) {
    const exists = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (exists) return { ok: false, error: "An account with this email already exists." };
    const user = {
      id: "u-" + Math.random().toString(36).slice(2, 8),
      name: name.trim(),
      email: email.trim(),
      role: "Student",
      joined: new Date().toISOString().slice(0, 10),
    };
    setUsers((u) => [...u, user]);
    setCurrentUser(user);
    return { ok: true, user };
  }

  function logout() {
    setCurrentUser(null);
    navigate("/");
  }

  // ---- lookups ----
  const userById = (id) => users.find((u) => u.id === id);
  const dashboardPath = (role) =>
    role === "Admin" ? "/admin" : role === "Staff" ? "/staff" : "/dashboard";

  // ---- report mutations ----
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

  function setRole(userId, role) {
    setUsers((us) => us.map((u) => (u.id === userId ? { ...u, role } : u)));
    if (currentUser && currentUser.id === userId) setCurrentUser((c) => ({ ...c, role }));
  }

  // ---- lost & found mutations ----
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
    currentUser, setCurrentUser, login, register, logout,
    userById, dashboardPath, staffList: STAFF_LIST, demoPassword: DEMO_PASSWORD,
    assignReport, setRole, addItem, updateItem, deleteItem, addClaim, setClaimStatus,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}

// Wipe persisted demo data and reload (handy during development).
export function resetFixitData() {
  ["fixit_users", "fixit_reports", "fixit_items", "fixit_claims", "fixit_currentUser"].forEach((k) =>
    localStorage.removeItem(k)
  );
  location.reload();
}
