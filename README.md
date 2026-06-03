# FixIt — Campus Management (BUBT)

A responsive web app for the **Bangladesh University of Business & Technology (BUBT)**
community to **report campus issues** and run a **Lost & Found** board, with
role-based dashboards for **Students**, **Staff**, and **Admins**.

Built with **React + Vite + Tailwind CSS** and **lucide-react** icons, backed by
**Supabase** (Postgres + Auth + Row-Level Security + Storage). Course project for **SDP IV**.

🔗 **Live:** https://fixit-campus-theta.vercel.app

---

## Features

1. **Auth & role-based access** — three roles, each with its own dashboard and navigation.
   - **Students self-register.** **Staff and Admin accounts are created by an Admin** from
     Manage Users (the first Admin is seeded once via SQL). Passwords are hashed by Supabase Auth.
2. **Campus issue reporting** — students file reports (category, description, location, photo)
   and track them **Open → In Progress → Resolved**. Admins assign reports to staff; staff
   advance the status; admins can also Reject / Close. Status history is recorded automatically.
3. **Lost & Found** *(students only)* — post lost/found items, browse and search, and claim an
   item. **The item's poster** (not an admin) approves or rejects each claim; once approved,
   the two students see each other's **email + WhatsApp**. Contact stays private until then.
4. **Profiles** — every user can set a photo, WhatsApp number, and (students) intake & section.

Security is enforced in the database with Row-Level Security, not just the UI.

---

## Tech stack

- **React 18** + **Vite 6**, **Tailwind CSS** (stock palette; primary `blue-600`, **Inter** font)
- **lucide-react** icons · tiny custom **hash router** (`src/lib/router.jsx`)
- **Supabase**: Auth, Postgres, Row-Level Security, Storage (photos)
- Hosting: **Vercel** (auto-deploys from `main`)

## Project structure

```
src/
  data/store.jsx      # the data layer — all Supabase reads/writes + auth; screens use useApp()
  lib/                # supabase client, hash router, helpers (categories, icon maps, dates)
  components/         # design system (ui.jsx) + shared pieces (AppShell, ReportsTable, ItemBits, …)
  screens/            # one file per screen: public / student / staff / admin / lostfound + Profile
  App.jsx             # routes + role guards (RequireAuth / RequireRole)
supabase/migrations/  # numbered SQL: schema, RLS, storage, hardening (0001 → 0009)
```

---

## Getting started

```bash
npm install
npm run dev      # dev server (Vite) — http://localhost:5173
npm run build    # production build
npm run preview  # preview the production build
```

### 1. Configure Supabase

Copy `.env.example` to `.env` and fill in your project's values (Supabase → Project Settings → API):

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon / publishable key>
```

The anon/publishable key is safe for the browser. **Never** put the `service_role`/secret key here.

### 2. Set up the database

In the Supabase **SQL Editor**, run the migrations in `supabase/migrations/` in order
(`0001` → `0009`). They create the tables, Row-Level Security policies, the storage bucket,
and the security hardening.

### 3. Create the first admin

There are **no seeded demo accounts** — register yourself (you'll start as a Student), then
promote your account once in the SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

After that, that Admin can create Staff and Admin accounts from **Manage Users**.

---

## Deploying

Hosted on **Vercel**: import the repo, add the two `VITE_SUPABASE_*` environment variables,
and deploy. Every push to `main` redeploys automatically.

---

© 2026 FixIt · Bangladesh University of Business & Technology
