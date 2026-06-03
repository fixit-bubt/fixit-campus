# FixIt — Campus Management (BUBT)

FixIt is a responsive web app for the Bangladesh University of Business & Technology
(BUBT) community to **report campus issues** and run a **Lost & Found** board, with
separate dashboards for **Students**, **Staff**, and **Admins**.

Built as my **SDP IV** project with **React + Vite + Tailwind CSS** on the frontend and
**Supabase** (Postgres + Auth + Row-Level Security + Storage) on the backend.

- **Live:** https://fixit-campus-theta.vercel.app
- **Stack:** React 18, Vite 6, Tailwind CSS, lucide-react, Supabase, Vercel

---

## Features

**1. Authentication & roles.** Three roles, each with its own dashboard and navigation.
Students self-register; **Staff and Admin accounts are created by an Admin** from Manage
Users (the first Admin is seeded once via SQL). Passwords are handled by Supabase Auth.

**2. Campus issue reporting.** A student files a report (category, description, location,
optional photo) and tracks it **Open → In Progress → Resolved**. An Admin assigns it to a
Staff member (which moves it to In Progress); Staff advance the status; Admins can also
Reject or Close. Every status change is recorded as history, and reports can be edited or
soft-deleted while still Open.

**3. Lost & Found (students only).** A student posts a lost or found item; another student
claims it. **The item's poster** — not an admin — approves or rejects each claim. Once a
claim is approved, the two students see each other's **email and WhatsApp** so they can meet
up; until then, contact details stay private.

**4. Profiles.** Every user can set a photo and WhatsApp number; students also add their
intake and section.

Access rules are enforced in the database with **Row-Level Security**, not just hidden in
the UI — so the rules hold even if someone calls the API directly.

---

## How it works (architecture)

The UI never talks to the database directly. Every screen reads and writes through a single
React context, `useApp()`, exposed by **`src/data/store.jsx`** — the one place that knows
about Supabase:

```
Screen (e.g. MyReports)  →  useApp()  →  src/data/store.jsx  →  Supabase (Postgres + Auth + Storage)
```

- **Auth/session:** `store.jsx` listens to Supabase auth state, loads the signed-in user's
  profile, and exposes `currentUser` (with their role) that drives routing and the menu.
- **Data:** reports, items and claims are loaded per user — Row-Level Security returns only
  the rows that user may see. Mutations (`createReport`, `assignReport`, `addClaim`,
  `setClaimStatus`, …) are async functions that write to Supabase and refresh the lists.
- **Routing:** a tiny hash router (`src/lib/router.jsx`) maps `#/path` to a screen.
  `RequireAuth` / `RequireRole` in `App.jsx` keep each role to its own pages.
- **Photos:** report/item images go to a public Storage bucket; **claim proof images go to a
  private bucket** and are shown through short-lived signed URLs.
- **Security:** the SQL migrations in `supabase/migrations/` define the schema **and** the
  RLS policies — who can read/update which rows, the one-time claim decision, the
  contact-reveal-on-approval, and guards like "can't remove the last admin."

---

## Project structure

```
fixit-campus/
├─ index.html
├─ vite.config.js · tailwind.config.js · postcss.config.js
├─ .env.example                  # copy to .env and add your Supabase keys
├─ src/
│  ├─ main.jsx                    # app entry (mounts providers + App)
│  ├─ App.jsx                     # routes + role guards (RequireAuth / RequireRole)
│  ├─ index.css                   # Tailwind directives + base styles
│  ├─ lib/
│  │  ├─ supabase.js              # the Supabase client (reads VITE_ env vars)
│  │  ├─ router.jsx               # tiny hash router + <Link>
│  │  └─ helpers.js               # categories, icon maps, date formatting
│  ├─ data/
│  │  └─ store.jsx                # THE data layer — auth + all Supabase reads/writes
│  ├─ components/
│  │  ├─ ui.jsx                   # design system: Button, Input, Modal, Card, Badge, …
│  │  ├─ AppShell.jsx             # sidebar + top bar + role-based nav
│  │  ├─ Brand.jsx · FilterTabs.jsx
│  │  ├─ ReportListRow.jsx · ReportsTable.jsx · AssignModal.jsx   # reporting pieces
│  │  └─ ItemBits.jsx             # Lost & Found cards/badges
│  └─ screens/
│     ├─ public/                  # Landing, Login, Register, AuthShell
│     ├─ student/                 # StudentDashboard, MyReports, ReportIssue, EditReport, ReportForm
│     ├─ staff/                   # StaffDashboard, AssignedToMe
│     ├─ admin/                   # AdminDashboard, AllReports, ManageUsers
│     ├─ lostfound/               # LostFoundBrowse, PostItem, EditItem, ItemDetail, ItemForm
│     ├─ ReportDetail.jsx         # shared report page (role-aware)
│     ├─ Profile.jsx              # edit your own profile
│     └─ NotFound.jsx
└─ supabase/migrations/           # 0001 schema → 0010, run in order in the SQL Editor
```

---

## Running it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
npm run preview  # preview the build
```

### 1. Supabase keys

Copy `.env.example` to `.env` and fill in your project's values
(Supabase → Project Settings → API):

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon / publishable key>
```

The anon/publishable key is safe in the browser. Never commit the `service_role`/secret key.

### 2. Database

In the Supabase **SQL Editor**, run the files in `supabase/migrations/` in order
(`0001` → `0010`). They create the tables, RLS policies, the storage buckets, and the
security hardening.

### 3. First admin

There are no seeded demo logins — register yourself (you start as a Student), then run once
in the SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

That Admin can then create Staff/Admin accounts from Manage Users.

---

## Deployment

Hosted on **Vercel** — import the repo, add the two `VITE_SUPABASE_*` environment variables,
and deploy. Pushing to `main` redeploys automatically.

---

© 2026 FixIt · Bangladesh University of Business & Technology
