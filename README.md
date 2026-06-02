# FixIt — Campus Management (BUBT)

A responsive web app for the **Bangladesh University of Business & Technology (BUBT)**
community to **report campus issues** and run a **Lost & Found** board, with
role-based dashboards for **Students**, **Staff**, and **Admins**.

Built with **React + Vite + Tailwind CSS** and **lucide-react** icons. No UI library —
every component is plain HTML + Tailwind, so the design stays fully portable.

> Course project for **SDP IV**. This repository currently runs entirely on the
> frontend with mock data (persisted to `localStorage`); a real backend
> (Supabase Auth + Postgres + RLS) and image uploads (Cloudinary) are planned next.

---

## Features

1. **Auth & role-based access** — register / log in; three roles (Student, Staff, Admin),
   each with its own dashboard and navigation.
2. **Campus issue reporting** — students file reports (category, description, location,
   photo) and track them through **Open → In Progress → Resolved**. Admins assign reports
   to staff; staff advance the status; admins can also Reject / Close. Full CRUD.
3. **Lost & Found** — post lost or found items, browse and search the board, and submit a
   claim (Found) or notification (Lost). **Contact details are revealed only after an admin
   approves the claim.**

---

## Getting started

```bash
npm install
npm run dev      # start the dev server (Vite) — http://localhost:5173
npm run build    # production build
npm run preview  # preview the production build
```

No backend is required to run the demo — all data lives in `src/data/store.jsx`
and persists to `localStorage`.

### Demo accounts

All demo passwords are `password123` (the login screen has one-tap chips to fill these in):

| Role    | Email                |
| ------- | -------------------- |
| Student | `tahmid@bubt.edu.bd` |
| Staff   | `rahim@bubt.edu.bd`  |
| Admin   | `admin@bubt.edu.bd`  |

Register creates a new **Student** account.

---

## Tech stack

- **React 18** + **Vite 6**
- **Tailwind CSS** (stock palette; brand primary `blue-600`, **Inter** font)
- **lucide-react** icons
- Tiny custom **hash router** (`src/lib/router.jsx`)
- State + mock data via React Context (`src/data/store.jsx`)

## Project structure

```
src/
  data/store.jsx     # the only stateful module — users/reports/items/claims + auth (swap for a real API to go live)
  lib/               # router + helpers (categories, icon maps, date formatting)
  components/         # design system (ui.jsx) + shared pieces (AppShell, ReportsTable, ItemBits, …)
  screens/            # one file per screen, grouped by area: public / student / staff / admin / lostfound
  App.jsx             # routes
```

Presentation is fully decoupled from data: every screen reads/writes through `useApp()`
and never touches storage directly, so wiring a real backend means replacing
`src/data/store.jsx` while keeping the same shape.

---

## Roadmap

- [x] UI for all 17 screens / 3 roles on mock data
- [ ] Supabase backend (Auth + Postgres + Row-Level Security)
- [ ] Cloudinary image uploads
- [ ] Deploy to Vercel

---

© 2026 FixIt · Bangladesh University of Business & Technology
