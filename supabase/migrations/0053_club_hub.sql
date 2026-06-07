-- ============================================================================
-- FixIt — Migration 0053: Club Hub
-- ----------------------------------------------------------------------------
-- A private operational home for BUBT's existing student clubs.
-- Recruitment stays offline (yearly drive) — this is where clubs live once
-- their members are in: announcements, pinned notices, member management,
-- and yearly handover.
--
-- Design rules:
--   • Privacy-first  — non-members see NOTHING (posts, roster, activity)
--   • No self-join   — officers add members; no application flow
--   • Admin manages structure (create clubs, assign President) but cannot
--     read member-only content — consistent with the Study Hub rule
--   • 4-tier roles: president | vp | editor | member
--     president : full control
--     vp        : post, edit any post, pin, add/remove members
--     editor    : post, edit own posts, pin
--     member    : read-only inside the club
--
-- Tables:    clubs, club_members, club_posts
-- Helpers:   club_is_member(), club_can_post(), club_can_manage(),
--            club_is_president()
-- Changes:   events.club_id FK added; can_create_events() extended
-- Storage:   club-covers (public), club-attachments (private, member-gated)
--
-- ┌───────────────────────────────────────────────────────────────────────┐
-- │ ACTION REQUIRED before applying:                                      │
-- │   Create these two storage buckets in the Supabase dashboard:         │
-- │     club-covers      → Public bucket                                  │
-- │     club-attachments → Private bucket                                 │
-- └───────────────────────────────────────────────────────────────────────┘
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. clubs — one row per student club                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create table public.clubs (
  id                 uuid        primary key default gen_random_uuid(),
  name               text        not null check (char_length(name) >= 2),
  tagline            text,
  about              text,
  cover_url          text,                   -- public URL (club-covers bucket)
  category           text        not null
                     check (category in ('Tech','Cultural','Sports','Professional','Social')),
  faculty_advisor_id uuid        references public.faculty (id) on delete set null,
  is_active          boolean     not null default true,
  created_by         uuid        references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now()
);

create index clubs_active_idx    on public.clubs (is_active);
create index clubs_category_idx  on public.clubs (category);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. club_members — membership roster + roles                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create table public.club_members (
  id        uuid        primary key default gen_random_uuid(),
  club_id   uuid        not null references public.clubs   (id) on delete cascade,
  user_id   uuid        not null references public.profiles (id) on delete cascade,
  role      text        not null default 'member'
            check (role in ('president','vp','editor','member')),
  added_by  uuid        references public.profiles (id) on delete set null,
  joined_at timestamptz not null default now(),
  unique (club_id, user_id)
);

create index club_members_club_idx on public.club_members (club_id);
create index club_members_user_idx on public.club_members (user_id);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. club_posts — announcements & pinned notices                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create table public.club_posts (
  id         uuid        primary key default gen_random_uuid(),
  club_id    uuid        not null references public.clubs   (id) on delete cascade,
  author_id  uuid        not null references public.profiles (id) on delete cascade,
  title      text        not null check (char_length(title) >= 1),
  body       text,
  image_url  text,                           -- public URL (photos bucket)
  file_url   text,                           -- storage path (club-attachments)
  file_name  text,
  is_pinned  boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index club_posts_feed_idx   on public.club_posts (club_id, created_at desc);
create index club_posts_pinned_idx on public.club_posts (club_id, is_pinned)
  where is_pinned = true;

-- auto-bump updated_at on edit
create trigger club_posts_updated_at
  before update on public.club_posts
  for each row execute function public.set_updated_at();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Helper functions                                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Is the caller a member (any role) of club cid?
create or replace function public.club_is_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_members
    where club_id = cid and user_id = auth.uid()
  );
$$;
revoke execute on function public.club_is_member(uuid) from public, anon;
grant  execute on function public.club_is_member(uuid) to authenticated;

-- Can the caller post (president | vp | editor)?
create or replace function public.club_can_post(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_members
    where club_id = cid and user_id = auth.uid()
      and role in ('president','vp','editor')
  );
$$;
revoke execute on function public.club_can_post(uuid) from public, anon;
grant  execute on function public.club_can_post(uuid) to authenticated;

-- Can the caller manage members (president | vp)?
create or replace function public.club_can_manage(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_members
    where club_id = cid and user_id = auth.uid()
      and role in ('president','vp')
  );
$$;
revoke execute on function public.club_can_manage(uuid) from public, anon;
grant  execute on function public.club_can_manage(uuid) to authenticated;

-- Is the caller the president of club cid?
create or replace function public.club_is_president(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_members
    where club_id = cid and user_id = auth.uid()
      and role = 'president'
  );
$$;
revoke execute on function public.club_is_president(uuid) from public, anon;
grant  execute on function public.club_is_president(uuid) to authenticated;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. RLS — clubs                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Any authenticated user can read the clubs list (needed for the My Clubs
-- home; non-members simply have no clubs). Only admin writes.
revoke all on public.clubs from anon;
alter table public.clubs enable row level security;
grant select, insert, update, delete on public.clubs to authenticated;

create policy clubs_select on public.clubs
  for select to authenticated using (true);

create policy clubs_insert on public.clubs
  for insert to authenticated with check (public.is_admin());

create policy clubs_update on public.clubs
  for update to authenticated
  using  (public.is_admin())
  with check (public.is_admin());

create policy clubs_delete on public.clubs
  for delete to authenticated using (public.is_admin());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. RLS — club_members                                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- SELECT  — member of same club, or admin (for user searches)
-- INSERT  — president/VP adds OTHER users only (no self-join)
-- UPDATE  — president changes roles (not their own); admin changes any
-- DELETE  — leave (own row) | kick (president/VP removes others) | admin
revoke all on public.club_members from anon;
alter table public.club_members enable row level security;
grant select, insert, update, delete on public.club_members to authenticated;

create policy club_members_select on public.club_members
  for select to authenticated
  using (public.club_is_member(club_id) or public.is_admin());

create policy club_members_insert on public.club_members
  for insert to authenticated
  with check (
    (public.club_can_manage(club_id) and user_id <> auth.uid())
    or public.is_admin()
  );

create policy club_members_update on public.club_members
  for update to authenticated
  using  ((public.club_is_president(club_id) and user_id <> auth.uid()) or public.is_admin())
  with check ((public.club_is_president(club_id) and user_id <> auth.uid()) or public.is_admin());

create policy club_members_delete on public.club_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or (public.club_can_manage(club_id) and user_id <> auth.uid())
    or public.is_admin()
  );


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. RLS — club_posts                                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- SELECT  — members only (admin deliberately excluded, matching Study Hub)
-- INSERT  — officer (president/vp/editor), must be own author_id
-- UPDATE  — author (if still an officer) or president (edits any post)
-- DELETE  — author or president/VP
revoke all on public.club_posts from anon;
alter table public.club_posts enable row level security;
grant select, insert, update, delete on public.club_posts to authenticated;

create policy club_posts_select on public.club_posts
  for select to authenticated
  using (public.club_is_member(club_id));

create policy club_posts_insert on public.club_posts
  for insert to authenticated
  with check (
    public.club_can_post(club_id)
    and author_id = auth.uid()
  );

create policy club_posts_update on public.club_posts
  for update to authenticated
  using  (
    (author_id = auth.uid() and public.club_can_post(club_id))
    or public.club_is_president(club_id)
  )
  with check (
    (author_id = auth.uid() and public.club_can_post(club_id))
    or public.club_is_president(club_id)
  );

create policy club_posts_delete on public.club_posts
  for delete to authenticated
  using (
    author_id = auth.uid()
    or public.club_can_manage(club_id)
  );


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 8. Events integration                                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Add a nullable club_id FK on events so club officers can tag events to
-- their club. Tagged events appear in the main feed with a club badge.
alter table public.events
  add column if not exists club_id uuid references public.clubs (id) on delete set null;

create index if not exists events_club_id_idx on public.events (club_id);

-- Extend can_create_events() to include club presidents and VPs.
-- Prior definition: is_admin() OR in event_organizers.
-- Now adds: any active president or VP of any club.
create or replace function public.can_create_events()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.event_organizers  where user_id = auth.uid())
      or exists (select 1 from public.club_members
                 where user_id = auth.uid() and role in ('president','vp'));
$$;
-- Grant already exists from 0016 — no change needed.


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 9. Storage policies                                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── club-covers (public bucket — covers are branding, not sensitive) ────────
create policy "club-covers: authenticated read"
  on storage.objects for select to authenticated
  using (bucket_id = 'club-covers');

create policy "club-covers: admin upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'club-covers' and public.is_admin());

create policy "club-covers: admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'club-covers' and public.is_admin());

create policy "club-covers: admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'club-covers' and public.is_admin());

-- ── club-attachments (private — PDFs / docs on club posts) ──────────────────
-- Path convention enforced by the app: {club_id}/{user_id}_{uuid}.{ext}
-- (storage.foldername(name))[1] = club_id (first path segment)
create policy "club-attachments: member read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'club-attachments'
    and public.club_is_member((storage.foldername(name))[1]::uuid)
  );

create policy "club-attachments: officer upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'club-attachments'
    and public.club_can_post((storage.foldername(name))[1]::uuid)
  );

create policy "club-attachments: owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'club-attachments' and owner = auth.uid());

-- ============================================================================
-- End of migration 0053
-- ============================================================================
