-- ============================================================================
-- FixIt — Migration 0054: Club Hub fixes (follow-up to 0053)
-- ----------------------------------------------------------------------------
-- An adversarial review of the Club Hub feature surfaced several gaps between
-- the UI/role model and what the DB actually enforces. This migration closes
-- them WITHOUT touching 0053 (already applied to the live DB).
--
-- Fixes:
--   1. Single-president invariant — partial unique index so a club can never
--      have two presidents (defends against client races / promotion bugs).
--   2. club_update_details() RPC — lets a club's President/VP edit their club's
--      profile (name/tagline/about/category/advisor/cover). 0053's clubs UPDATE
--      policy is admin-only, so the officer "Club Settings" screen silently
--      failed (0-row UPDATE → false success). Done as a SECURITY DEFINER RPC so
--      officers can edit ONLY the safe columns (never is_active / created_by).
--   3. club_set_president() RPC — atomic demote-then-promote handover so a
--      failure can never leave a club president-less or with two presidents.
--   4. club_posts UPDATE policy widened to match the documented role model:
--      VP edits/pins ANY post; editor edits/pins OWN posts; president any.
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Single-president invariant                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- At most one president row per club. Statement-level check inside the handover
-- RPC (demote first, then promote) keeps the transaction valid.
create unique index if not exists club_members_one_president_idx
  on public.club_members (club_id)
  where role = 'president';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. club_update_details() — officer/admin edit of a club's profile          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Authorization: club President/VP (club_can_manage) OR admin. Only the safe
-- profile columns are writable here; is_active and created_by are untouched.
-- A NULL p_cover_url leaves the existing cover unchanged (coalesce).
create or replace function public.club_update_details(
  p_club_id  uuid,
  p_name     text,
  p_tagline  text,
  p_about    text,
  p_category text,
  p_advisor  uuid,
  p_cover_url text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.club_can_manage(p_club_id) or public.is_admin()) then
    raise exception 'Not authorized to edit this club.';
  end if;
  if char_length(coalesce(p_name, '')) < 2 then
    raise exception 'Club name must be at least 2 characters.';
  end if;
  if p_category not in ('Tech','Cultural','Sports','Professional','Social') then
    raise exception 'Invalid category.';
  end if;
  update public.clubs set
    name               = p_name,
    tagline            = p_tagline,
    about              = p_about,
    category           = p_category,
    faculty_advisor_id = p_advisor,
    cover_url          = coalesce(p_cover_url, cover_url)
  where id = p_club_id;
end;
$$;
revoke execute on function public.club_update_details(uuid,text,text,text,text,uuid,text) from public, anon;
grant  execute on function public.club_update_details(uuid,text,text,text,text,uuid,text) to authenticated;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. club_set_president() — atomic handover                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Admin-only (matches the admin "Reassign President" flow). Demotes any sitting
-- president FIRST (so the single-president index stays satisfied), then
-- promotes/inserts the new president — all in one transaction.
create or replace function public.club_set_president(p_club_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can reassign the president.';
  end if;
  -- demote any current president(s) other than the incoming one
  update public.club_members
    set role = 'member'
    where club_id = p_club_id and role = 'president' and user_id <> p_user_id;
  -- promote the new president (insert, or update an existing membership row)
  insert into public.club_members (club_id, user_id, role, added_by)
    values (p_club_id, p_user_id, 'president', auth.uid())
  on conflict (club_id, user_id) do update set role = 'president';
end;
$$;
revoke execute on function public.club_set_president(uuid, uuid) from public, anon;
grant  execute on function public.club_set_president(uuid, uuid) to authenticated;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. club_posts UPDATE — match the documented role model                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- 0053 allowed UPDATE only for (author AND can_post) OR president, so a VP
-- could not edit/pin others' posts and an editor's pin on another post failed
-- silently. Widen to: (author AND can_post) OR can_manage (president|vp).
drop policy if exists club_posts_update on public.club_posts;
create policy club_posts_update on public.club_posts
  for update to authenticated
  using  (
    (author_id = auth.uid() and public.club_can_post(club_id))
    or public.club_can_manage(club_id)
  )
  with check (
    (author_id = auth.uid() and public.club_can_post(club_id))
    or public.club_can_manage(club_id)
  );

-- ============================================================================
-- End of migration 0054
-- ============================================================================
