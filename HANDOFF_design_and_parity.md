# FixIt-Campus Web — Design Reskin + Feature Parity Handoff

You are updating the **fixit-campus web app** (React + Vite + Tailwind + Supabase, JavaScript)
to match its sibling **CampusOne mobile app**. Two independent jobs, do them in order:

- **PART A — Reskin** (visual only): adopt the app's design tokens/fonts/dark mode.
- **PART B — Feature parity** (build missing UI): the app gained features the web lacks;
  the database already has everything, you only build web UI.

> **Both apps share ONE Supabase backend** (project `fixit-campus`,
> `xhgpxvyqrufbbuivttmi`). Every table/column/RPC named below **already exists in
> production** — do NOT write migrations, do NOT change the schema. Read/write only.

═══════════════════════════════════════════════════════════════════════════════
## GLOBAL SAFETY RULES (read first — this is the "bulletproof" part)
═══════════════════════════════════════════════════════════════════════════════
1. **Never touch the database.** No migrations, no `alter`, no new tables. The schema
   is shared with a live mobile app; a schema change can break the app. UI + queries only.
2. **Work incrementally, screen by screen.** After each screen: run `npm run build`,
   open it in the browser, verify it renders in **both light and dark**, and that the
   feature still works. Only then move on. Never do a mass find-replace across all files.
3. **Do not delete Tailwind's default palette during Part A.** Add the new tokens
   alongside it so half-migrated screens keep working; convert screens one at a time.
4. **Preserve all existing behavior, routes, and page layouts.** This is a reskin +
   additive features, not a rewrite. If a change isn't in this doc, don't make it.
5. **Keep it web-native.** Real hover states, mouse-sized targets, page scrolling.
   Do NOT copy the mobile tab-bar / gestures / bottom-sheet navigation onto the web.
6. **RLS is enforced server-side.** Every query already runs under the signed-in user's
   permissions. Don't try to bypass it; if a query returns nothing, that's usually RLS
   working, not a bug. Match the mobile app's query shape.
7. **Test as each role** (student / staff / admin) where a screen is role-gated — the
   mobile app gates by `profiles.role`.
8. **When unsure how a feature should behave, the mobile app is the source of truth.**
   Mirror its rules exactly (they're specified below).

═══════════════════════════════════════════════════════════════════════════════
## PART A — DESIGN RESKIN
═══════════════════════════════════════════════════════════════════════════════
The web currently uses **stock Tailwind** (Inter font, `blue-600`/`slate-*`, light-only,
no tokens). Replace with the app's system below.

### A1. Fonts
```
npm i @fontsource/plus-jakarta-sans @fontsource/hind-siliguri
```
In `src/index.css` import the weights (400/500/600/700/800 Jakarta; 400/500/600/700 Hind),
then:
```css
html { font-family: "Plus Jakarta Sans", "Hind Siliguri", ui-sans-serif, system-ui, sans-serif; }
```
Headings: 700/800, tight tracking (h1 −0.02em, h2 −0.01em). Uppercase labels: 700, +0.06em.
Bengali text: Hind Siliguri, ~1.6 line-height (matras need vertical room).

### A2. Color tokens as CSS variables (`src/index.css`)
```css
:root{
  --brand:#2b5be3; --brand-700:#1f47c4; --brand-50:#eef3ff; --brand-100:#dde7ff;
  --bg:#f5f7fb; --surface:#ffffff; --surface-2:#eef2f8; --surface-3:#e6ebf3;
  --border:#e4e9f1; --border-2:#d4dce8;
  --text:#0f1a2e; --text-2:#46536e; --text-3:#8693aa;
  --success:#12915e; --success-bg:#e3f5ec;
  --warn:#b9760a;    --warn-bg:#fbefdb;
  --danger:#d63d35;  --danger-bg:#fbe7e5;
  --info:#2b5be3;    --info-bg:#eef3ff;
}
.dark{
  --brand:#6a8cf2; --brand-700:#8aa4f7; --brand-50:#1a2340; --brand-100:#222d4e;
  --bg:#0a0f1c; --surface:#111829; --surface-2:#182034; --surface-3:#202a42;
  --border:#232f48; --border-2:#2e3b58;
  --text:#e9eefb; --text-2:#a4b1cc; --text-3:#6c7a99;
  --success:#36c98a; --success-bg:#0d2e20;
  --warn:#e0a23c;    --warn-bg:#2e1e05;
  --danger:#f0685e;  --danger-bg:#2e0d0b;
  --info:#6a8cf2;    --info-bg:#1a2340;
}
body{ background:var(--bg); color:var(--text); }
```

### A3. `tailwind.config.js`
```js
export default {
  content: ["./index.html","./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: { extend: {
    fontFamily: { sans:["Plus Jakarta Sans","Hind Siliguri","ui-sans-serif","system-ui","sans-serif"] },
    colors: {
      brand:{ DEFAULT:"var(--brand)",700:"var(--brand-700)",50:"var(--brand-50)",100:"var(--brand-100)" },
      bg:"var(--bg)", surface:"var(--surface)", "surface-2":"var(--surface-2)", "surface-3":"var(--surface-3)",
      brd:"var(--border)", "brd-2":"var(--border-2)",
      ink:"var(--text)", "ink-2":"var(--text-2)", "ink-3":"var(--text-3)",
      success:{ DEFAULT:"var(--success)", bg:"var(--success-bg)" },
      warn:{ DEFAULT:"var(--warn)", bg:"var(--warn-bg)" },
      danger:{ DEFAULT:"var(--danger)", bg:"var(--danger-bg)" },
      info:{ DEFAULT:"var(--info)", bg:"var(--info-bg)" },
      sector:{ reports:"#4f6bed", lostfound:"#c77d1a", clubs:"#8b5cf0", events:"#e0568a",
        jobs:"#0e9c8a", announce:"#3e7de0", study:"#2ba0c9", bus:"#e08a2b", medical:"#e2483d",
        market:"#2e9e63", ride:"#6e8b1f", blood:"#c7344a", directory:"#5b6b86", prayer:"#1f8a5b",
        faculty:"#0e9c8a", calendar:"#d4553a", routines:"#5c6bc0", coverpage:"#00838f" },
    },
    borderRadius:{ xs:"8px", sm:"10px", md:"14px", lg:"18px", xl:"22px", "2xl":"26px", "3xl":"32px", full:"999px" },
    boxShadow:{ sm:"0 1px 2px rgba(15,26,46,.05)", md:"0 2px 6px rgba(15,26,46,.06)",
      lg:"0 6px 16px rgba(15,26,46,.10)", xl:"0 12px 32px rgba(15,26,46,.18)" },
    fontSize:{ xs:"11px", sm:"12px", base:"13px", md:"14px", lg:"15px", xl:"16px",
      "2xl":"18px", "3xl":"21px", "4xl":"26px", "5xl":"32px" },
  }},
};
```

### A4. Component recipes — rewrite `src/components/ui.jsx` onto the tokens
| Element | Classes |
|---|---|
| Button primary | `bg-brand text-white hover:bg-brand-700 rounded-md shadow-sm h-11 px-4 font-bold` |
| Button secondary | `bg-surface text-ink-2 border border-brd hover:bg-surface-2 rounded-md` |
| Button destructive | `bg-danger text-white hover:brightness-95 rounded-md` |
| Button ghost | `text-ink-3 hover:bg-surface-2` |
| Card | `bg-surface border border-brd rounded-lg shadow-sm p-4` |
| Input | `h-12 rounded-md border border-brd bg-surface text-ink px-3.5` |
| Pill/badge | `rounded-full px-2.5 py-0.5 text-xs font-bold` (semantic: `bg-success/bg text-success` etc.) |
| Section label | `text-xs font-bold uppercase tracking-[0.06em] text-ink-3` |
| Focus ring | `ring-2 ring-brand ring-offset-2` |
Gutter 16px (`p-4`). Card radius `lg`, buttons/inputs `md`, chips `full`.
Body text `text-ink`, secondary `text-ink-2`, muted `text-ink-3`.

### A5. Sector accents
Each feature has an accent (`sector.*`). Use it for that feature's icon tint, chips,
header accent. e.g. Blood `sector-blood #c7344a`, Study `sector-study #2ba0c9`. Icons stay
`lucide-react`.

### A6. Dark-mode toggle
Add a toggle that sets/removes `class="dark"` on `<html>`, persists to `localStorage`,
and respects `prefers-color-scheme` on first load.

### A7. Sweep order (so nothing looks half-done)
Convert in this order, building + eyeballing (both themes) after each group:
`components/ui.jsx` → `components/AppShell.jsx` → auth (`public/*`) → dashboards
(`admin/`, `staff/`, `student/`) → each feature folder. Replace `slate-*`→`ink*`/`surface*`,
`blue-600`→`brand`, `red-600`→`danger`, `emerald`→`success`, `amber`→`warn`.

═══════════════════════════════════════════════════════════════════════════════
## PART B — FEATURE PARITY (build missing UI; DB already exists)
═══════════════════════════════════════════════════════════════════════════════
The mobile app gained these; the web has ZERO of them (verified). Build the web UI.
Every DB object below is live in the shared backend.

### B1. Blood donation v2 — eligibility, confirm, close
Web `blood/Blood.jsx` is the old version. Add:

**Eligibility rule (mirror app exactly):** a donor is *eligible* if `donors.last_donated`
is null OR ≥ 90 days ago. If ineligible, show a countdown pill "Eligible in N days"
(`N = 90 − daysSince`) and **disable the Contact button** for that donor. A donor viewing
their own row gets an **"I donated"** action → `update donors set last_donated = <today,
local Asia/Dhaka date> where user_id = me` (RLS allows own-row update).

**Requester manages responders + closes the request.** On a request the current user owns:
- List responders via RPC `donor_pledges_for_request(p_request_id uuid)`
  → rows `{ donor_id, full_name, blood_group, last_donated, fulfilled_at, pledged_at }`.
  (This RPC is requester-gated; returns nothing for non-owners.)
- Per responder, a **"Confirm donated"** button → RPC
  `confirm_blood_donation(p_request_id uuid, p_donor_id uuid)` → returns `json {ok, error?}`.
  It stamps that donor's `last_donated` + marks the pledge `fulfilled_at` + notifies the donor.
- A **"Mark fulfilled"** button → `update blood_requests set fulfilled_at = now() where id = ...`
  (RLS allows the requester).

**Feed filtering (mirror app):** the requests list must hide fulfilled + stale requests:
`.is('fulfilled_at', null).gte('created_at', <now − 21 days>)`.

**Contact reveal RPCs (already used by app):**
`donor_contact(p_user_id uuid)` → `json { whatsapp }` (only if donor opted in);
`blood_requester_contact(p_code text)` → `table(name, whatsapp)` (only to donors who pledged).

### B2. Study Hub — file metadata, search, filters, bookmarks
Web `studyhub/StudyHub.jsx` lacks the file-management upgrade. Add on the course/files view:
- **Metadata row per file**: show `study_materials.file_kind` (or `study_question_bank.file_kind`)
  + formatted `size_bytes` + relative created_at. A file-type icon keyed off `file_kind`
  (pdf/doc/ppt/xls/img/zip → icon; default file).
- **On upload, persist `file_kind` (lowercased file extension) and `size_bytes`** — the
  columns exist but old code left them null.
- **In-course search** (filter by title), **exam filter chips** on the questions tab
  (values from `study_question_bank.exam`), **sort** (newest / name).
- **Bookmarks**: table `study_bookmarks(user_id uuid, item_type text CHECK in
  ('material','question','book'), item_id uuid, created_at)` PK `(user_id,item_type,item_id)`,
  own-only RLS. Add a bookmark toggle per file: insert/delete a row; load the user's rows
  for the current course's item ids to show saved state.

### B3. Password reset via OTP (auth — same Supabase, works on web)
Web has NO password reset. Add "Forgot password?" on Login:
1. `supabase.auth.resetPasswordForEmail(email)` (sends a 6-digit code — the dashboard
   template already renders `{{ .Token }}`; OTP length is 6).
2. Code-entry + new-password screen → `supabase.auth.verifyOtp({ email, token, type:'recovery' })`
   then `supabase.auth.updateUser({ password })`. A successful verify opens a session, so the
   user is signed in after resetting.

### B4. Signup email verification (only if the dashboard enables it)
`supabase.auth.signUp(...)` returns **no session** when "Confirm email" is on. If so, show a
6-digit code screen → `supabase.auth.verifyOtp({ email, token, type:'signup' })`. Also forward
a login attempt that errors with "Email not confirmed" to the same screen. If confirm-email is
off (current default), signup stays instant — make this conditional on the presence of a session.

### ALREADY WORKS ON WEB — do nothing
- **New in-app notification types** (blood requests, study-material uploads) already flow into
  the shared `notifications` table via DB triggers — the web's existing notifications feed shows
  them automatically. No work.
- RLS hardening, anon lockdowns, DB-type safety — backend/mobile concerns; no web action.

### MOBILE-ONLY — DO NOT PORT
- Push notifications (FCM), deep-link-from-push, cold-start tap handling — native only.
- Native Google Sign-In — on web use Supabase OAuth redirect (`signInWithOAuth`), not the
  native module.
- APK build / expo anything.

═══════════════════════════════════════════════════════════════════════════════
## DEFINITION OF DONE
═══════════════════════════════════════════════════════════════════════════════
- Every screen renders correctly in **both light and dark**; no `slate-*`/`blue-600`
  raw palette left in converted screens.
- `npm run build` passes; no console errors on any route.
- Blood: eligibility countdown + disabled contact for ineligible; requester can confirm a
  donation and mark fulfilled; feed hides fulfilled/stale.
- Study Hub: files show type/size/date + icon; search + exam filter + sort work; bookmark
  toggle persists; uploads save file_kind + size_bytes.
- Password reset works end-to-end for a real account.
- No database/schema changes were made. Existing features still work for student/staff/admin.
