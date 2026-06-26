import React, { useEffect } from "react";
import { useHashRoute, matchRoute, navigate } from "./lib/router.jsx";
import { useApp } from "./data/store.jsx";
import { Spinner } from "./components/ui.jsx";

import Landing from "./screens/public/Landing.jsx";
import Login from "./screens/public/Login.jsx";
import Register from "./screens/public/Register.jsx";

import StudentDashboard from "./screens/student/StudentDashboard.jsx";
import StudentDirectory from "./screens/student/StudentDirectory.jsx";
import MyReports from "./screens/student/MyReports.jsx";
import ReportIssue from "./screens/student/ReportIssue.jsx";
import EditReport from "./screens/student/EditReport.jsx";
import ReportDetail from "./screens/ReportDetail.jsx";

import StaffDashboard from "./screens/staff/StaffDashboard.jsx";
import AssignedToMe from "./screens/staff/AssignedToMe.jsx";

import AdminDashboard from "./screens/admin/AdminDashboard.jsx";
import AllReports from "./screens/admin/AllReports.jsx";
import ManageUsers from "./screens/admin/ManageUsers.jsx";
import ManageFaculty from "./screens/admin/ManageFaculty.jsx";
import ManageStudyHub from "./screens/admin/ManageStudyHub.jsx";

import LostFoundBrowse from "./screens/lostfound/LostFoundBrowse.jsx";
import PostItem from "./screens/lostfound/PostItem.jsx";
import EditItem from "./screens/lostfound/EditItem.jsx";
import ItemDetail from "./screens/lostfound/ItemDetail.jsx";

import Profile from "./screens/Profile.jsx";
import Onboarding from "./screens/public/Onboarding.jsx";
import NotFound from "./screens/NotFound.jsx";

import { Announcements, AnnouncementDetail, AnnouncementForm } from "./screens/announcements/Announcements.jsx";
import { Marketplace, ListingDetail, ListingForm, MyListings } from "./screens/marketplace/Marketplace.jsx";
import { BusSchedule, BusDetail, BusRouteForm } from "./screens/bus/Bus.jsx";
import { FacultyDirectory, DepartmentFaculty, FacultyProfile, SavedFaculty } from "./screens/faculty/Faculty.jsx";
import { PrayerTimes } from "./screens/prayer/Prayer.jsx";
import { Events, EventDetail, EventForm } from "./screens/events/Events.jsx";
import { RideShare, RideDetail, OfferRide } from "./screens/rides/Rides.jsx";
import { BloodDonation, RegisterDonor, RequestBlood } from "./screens/blood/Blood.jsx";
import { MedicalCenter, DoctorBooking, MyAppointments, DoctorQueue } from "./screens/medical/Medical.jsx";
import { StudyHub, StudyHubBrowse, StudyHubDept, StudyHubIntake, StudyHubSection, StudyHubCourse, StudyHubManage } from "./screens/studyhub/StudyHub.jsx";
import { ClubsHome, ClubHome, ClubMembers, ClubPostForm, ClubManage, AdminManageClubs } from "./screens/clubs/Clubs.jsx";
import { Jobs, JobDetail, JobForm, ModerateJobs, SavedJobs } from "./screens/jobs/Jobs.jsx";
import { Notifications, NotifSettings } from "./screens/notifications/Notifications.jsx";
import CoverPage from "./screens/coverpage/CoverPage.jsx";
import { AcademicCalendar } from "./screens/calendar/Calendar.jsx";
import { Routines } from "./screens/routines/Routines.jsx";

// Render-safe redirect (navigates in an effect, not during render).
function Redirect({ to }) {
  useEffect(() => { navigate(to); }, [to]);
  return null;
}

// Redirect to /login if there's no signed-in user.
function RequireAuth({ children }) {
  const { currentUser } = useApp();
  useEffect(() => {
    if (!currentUser) navigate("/login");
  }, [currentUser]);
  if (!currentUser) return null;
  return children;
}

// Restrict a route to a single role; others are redirected to their own dashboard.
function RequireRole({ role, children }) {
  const { currentUser, dashboardPath } = useApp();
  const ok = !!currentUser && currentUser.role === role;
  useEffect(() => {
    if (!currentUser) navigate("/login");
    else if (currentUser.role !== role) navigate(dashboardPath(currentUser.role));
  }, [currentUser, role]);
  if (!ok) return null;
  return children;
}

export default function App() {
  const path = useHashRoute();
  const { currentUser, dashboardPath, sessionUserId, loading, profileError, retryProfile, logout } = useApp();

  // Hold off routing while either the session check is running OR a known
  // session's profile is still loading — otherwise a refresh while signed in
  // briefly sees currentUser=null and flashes/bounces to /login.
  if (loading || (sessionUserId && !currentUser && !profileError)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner size={28} />
      </div>
    );
  }

  // Profile read failed for a valid session — recoverable, never an endless
  // spinner. Offer a retry and a way out (sign out).
  if (sessionUserId && !currentUser && profileError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-lg font-semibold text-slate-900">Couldn't load your profile</h1>
          <p className="mt-1 text-sm text-slate-500">Something went wrong fetching your account. Check your connection and try again.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={retryProfile} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">Retry</button>
          <button onClick={() => logout()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Sign out</button>
        </div>
      </div>
    );
  }

  // ---- Onboarding gate ----
  // A signed-in student can't reach any screen until they've set a Student ID.
  // Mirrors CampusOne's mandatory onboarding. Staff/admin skip it.
  if (currentUser && currentUser.role === "Student" && !currentUser.studentId) {
    return <Onboarding />;
  }

  // ---- Public routes ----
  if (path === "/" || path === "") return <Landing />;
  if (path === "/login") {
    if (currentUser) return <Redirect to={dashboardPath(currentUser.role)} />;
    return <Login />;
  }
  if (path === "/register") {
    if (currentUser) return <Redirect to={dashboardPath(currentUser.role)} />;
    return <Register />;
  }

  // ---- Student routes ----
  if (path === "/dashboard") return <RequireRole role="Student"><StudentDashboard /></RequireRole>;
  if (path === "/students") return <RequireRole role="Student"><StudentDirectory /></RequireRole>;
  if (path === "/reports") return <RequireRole role="Student"><MyReports /></RequireRole>;
  if (path === "/reports/new") return <RequireRole role="Student"><ReportIssue /></RequireRole>;
  let m;
  if ((m = matchRoute("/reports/:id/edit", path))) return <RequireRole role="Student"><EditReport id={m.id} /></RequireRole>;
  // Report Detail is shared by the reporter (student), the assigned staff, and admins.
  if ((m = matchRoute("/reports/:id", path))) return <RequireAuth><ReportDetail id={m.id} /></RequireAuth>;

  // ---- Staff routes ----
  if (path === "/staff") return <RequireRole role="Staff"><StaffDashboard /></RequireRole>;
  if (path === "/staff/assigned") return <RequireRole role="Staff"><AssignedToMe /></RequireRole>;

  // ---- Admin routes ----
  if (path === "/admin") return <RequireRole role="Admin"><AdminDashboard /></RequireRole>;
  if (path === "/admin/reports") return <RequireRole role="Admin"><AllReports /></RequireRole>;
  if (path === "/admin/users") return <RequireRole role="Admin"><ManageUsers /></RequireRole>;
  if (path === "/admin/faculty") return <RequireRole role="Admin"><ManageFaculty /></RequireRole>;
  if (path === "/admin/study-hub") return <RequireRole role="Admin"><ManageStudyHub /></RequireRole>;
  if (path === "/admin/clubs") return <RequireRole role="Admin"><AdminManageClubs /></RequireRole>;

  // ---- Notifications (any signed-in user) ----
  if (path === "/notifications") return <RequireAuth><Notifications /></RequireAuth>;
  if (path === "/notifications/settings") return <RequireAuth><NotifSettings /></RequireAuth>;

  // ---- Profile (any signed-in user) ----
  if (path === "/profile") return <RequireAuth><Profile /></RequireAuth>;

  // ---- Lost & Found (students only) ----
  if (path === "/lost-found") return <RequireRole role="Student"><LostFoundBrowse /></RequireRole>;
  if (path === "/lost-found/new") return <RequireRole role="Student"><PostItem /></RequireRole>;
  if ((m = matchRoute("/lost-found/:id/edit", path))) return <RequireRole role="Student"><EditItem id={m.id} /></RequireRole>;
  if ((m = matchRoute("/lost-found/:id", path))) return <RequireRole role="Student"><ItemDetail id={m.id} /></RequireRole>;

  // ---- Campus Life: Announcements (any signed-in user; compose is admin/staff) ----
  if (path === "/announcements") return <RequireAuth><Announcements /></RequireAuth>;
  if (path === "/announcements/new") return <RequireRole role="Admin"><AnnouncementForm /></RequireRole>;
  if ((m = matchRoute("/announcements/:id", path))) return <RequireAuth><AnnouncementDetail id={m.id} /></RequireAuth>;

  // ---- Campus Life: Bus Schedule (any signed-in user; add/edit is admin) ----
  if (path === "/bus") return <RequireAuth><BusSchedule /></RequireAuth>;
  if (path === "/bus/new") return <RequireRole role="Admin"><BusRouteForm /></RequireRole>;
  if ((m = matchRoute("/bus/:id/edit", path))) return <RequireRole role="Admin"><BusRouteForm id={m.id} /></RequireRole>;
  if ((m = matchRoute("/bus/:id", path))) return <RequireAuth><BusDetail id={m.id} /></RequireAuth>;

  // ---- Cover Page Generator (students only) ----
  if (path === "/cover-page") return <RequireRole role="Student"><CoverPage /></RequireRole>;

  // ---- Academic Calendar + Routines (any signed-in user; admin/staff curate) ----
  if (path === "/calendar") return <RequireAuth><AcademicCalendar /></RequireAuth>;
  if (path === "/routines") return <RequireAuth><Routines /></RequireAuth>;

  // ---- Campus Life: Study Hub (students only) ----
  // Section content (notes / question bank / books) is student-owned; staff and
  // admins don't get a section. More routes (browse / intake / section / course
  // / manage) are added as those screens ship.
  if (path === "/study-hub") return <RequireRole role="Student"><StudyHub /></RequireRole>;
  if (path === "/study-hub/browse") return <RequireRole role="Student"><StudyHubBrowse /></RequireRole>;
  if ((m = matchRoute("/study-hub/dept/:deptId", path))) return <RequireRole role="Student"><StudyHubDept deptId={m.deptId} /></RequireRole>;
  if ((m = matchRoute("/study-hub/intake/:intakeId", path))) return <RequireRole role="Student"><StudyHubIntake intakeId={m.intakeId} /></RequireRole>;
  if ((m = matchRoute("/study-hub/section/:sectionId/course/:courseId", path))) return <RequireRole role="Student"><StudyHubCourse sectionId={m.sectionId} courseId={m.courseId} /></RequireRole>;
  if ((m = matchRoute("/study-hub/section/:sectionId/manage", path))) return <RequireRole role="Student"><StudyHubManage sectionId={m.sectionId} /></RequireRole>;
  if ((m = matchRoute("/study-hub/section/:sectionId", path))) return <RequireRole role="Student"><StudyHubSection sectionId={m.sectionId} /></RequireRole>;

  // ---- Campus Life: Clubs (students only; officers manage their club) ----
  if (path === "/clubs") return <RequireRole role="Student"><ClubsHome /></RequireRole>;
  if ((m = matchRoute("/clubs/:id/members", path))) return <RequireRole role="Student"><ClubMembers id={m.id} /></RequireRole>;
  if ((m = matchRoute("/clubs/:id/post/:postId/edit", path))) return <RequireRole role="Student"><ClubPostForm id={m.id} postId={m.postId} /></RequireRole>;
  if ((m = matchRoute("/clubs/:id/post/new", path))) return <RequireRole role="Student"><ClubPostForm id={m.id} /></RequireRole>;
  if ((m = matchRoute("/clubs/:id/manage", path))) return <RequireRole role="Student"><ClubManage id={m.id} /></RequireRole>;
  if ((m = matchRoute("/clubs/:id", path))) return <RequireRole role="Student"><ClubHome id={m.id} /></RequireRole>;

  // ---- Campus Life: Faculty Directory (any signed-in user) ----
  // Order matters: literal /faculty/saved and /faculty/dept/:n precede /faculty/:id.
  if (path === "/faculty") return <RequireAuth><FacultyDirectory /></RequireAuth>;
  if (path === "/faculty/saved") return <RequireAuth><SavedFaculty /></RequireAuth>;
  if ((m = matchRoute("/faculty/dept/:deptNo", path))) return <RequireAuth><DepartmentFaculty deptNo={m.deptNo} /></RequireAuth>;
  if ((m = matchRoute("/faculty/:id", path))) return <RequireAuth><FacultyProfile id={m.id} /></RequireAuth>;

  // ---- Campus Life: Prayer Times (any signed-in user) ----
  if (path === "/prayer") return <RequireAuth><PrayerTimes /></RequireAuth>;

  // ---- Campus Life: Events (any signed-in user) ----
  if (path === "/events") return <RequireAuth><Events /></RequireAuth>;
  if (path === "/events/new") return <RequireAuth><EventForm /></RequireAuth>;
  if ((m = matchRoute("/events/:id", path))) return <RequireAuth><EventDetail id={m.id} /></RequireAuth>;

  // ---- Campus Life: Jobs & Internships (any signed-in user browses; posting is
  // gated by canPostJobs in the form; moderation is admin-only) ----
  // Order matters: literal /jobs/new and /jobs/moderate precede /jobs/:id.
  if (path === "/jobs") return <RequireAuth><Jobs /></RequireAuth>;
  if (path === "/jobs/new") return <RequireAuth><JobForm /></RequireAuth>;
  if (path === "/jobs/saved") return <RequireAuth><SavedJobs /></RequireAuth>;
  if (path === "/jobs/moderate") return <RequireRole role="Admin"><ModerateJobs /></RequireRole>;
  if ((m = matchRoute("/jobs/:id/edit", path))) return <RequireAuth><JobForm id={m.id} /></RequireAuth>;
  if ((m = matchRoute("/jobs/:id", path))) return <RequireAuth><JobDetail id={m.id} /></RequireAuth>;

  // ---- Community: Marketplace (any signed-in user) ----
  if (path === "/marketplace") return <RequireAuth><Marketplace /></RequireAuth>;
  if (path === "/marketplace/new") return <RequireAuth><ListingForm /></RequireAuth>;
  if (path === "/marketplace/mine") return <RequireAuth><MyListings /></RequireAuth>;
  if ((m = matchRoute("/marketplace/:id/edit", path))) return <RequireAuth><ListingForm id={m.id} /></RequireAuth>;
  if ((m = matchRoute("/marketplace/:id", path))) return <RequireAuth><ListingDetail id={m.id} /></RequireAuth>;

  // ---- Community: Ride Share (any signed-in user) ----
  if (path === "/rides") return <RequireAuth><RideShare /></RequireAuth>;
  if (path === "/rides/new") return <RequireAuth><OfferRide /></RequireAuth>;
  if ((m = matchRoute("/rides/:id", path))) return <RequireAuth><RideDetail id={m.id} /></RequireAuth>;

  // ---- Services: Medical Center (any signed-in user) ----
  if (path === "/medical") return <RequireAuth><MedicalCenter /></RequireAuth>;
  if (path === "/medical/appointments") return <RequireAuth><MyAppointments /></RequireAuth>;
  if (path === "/medical/queue") return <RequireAuth><DoctorQueue /></RequireAuth>;
  if ((m = matchRoute("/medical/:id", path))) return <RequireAuth><DoctorBooking id={m.id} /></RequireAuth>;

  // ---- Community: Blood Donation (any signed-in user) ----
  if (path === "/blood") return <RequireAuth><BloodDonation /></RequireAuth>;
  if (path === "/blood/register") return <RequireAuth><RegisterDonor /></RequireAuth>;
  if (path === "/blood/request") return <RequireAuth><RequestBlood /></RequireAuth>;

  // ---- 404 ----
  return <NotFound />;
}
