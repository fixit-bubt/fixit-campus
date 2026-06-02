-- ============================================================================
-- FixIt — Migration 0005: Lost & Found is students-only & poster-governed
-- Admins/staff have no part in Lost & Found. The person who POSTED an item
-- approves/rejects claims on it (no admin verification). Contact reveal between
-- the two students on approval is already handled by the profiles policy
-- (profiles_select_self_admin_or_matched), so that is left unchanged.
-- ============================================================================

-- Helper: is the current user a student?
create or replace function public.is_student()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'student');
$$;
revoke execute on function public.is_student() from public, anon;
grant execute on function public.is_student() to authenticated;

-- ---- lost_found_items: students only ----
drop policy if exists items_select on public.lost_found_items;
drop policy if exists items_insert on public.lost_found_items;
drop policy if exists items_update on public.lost_found_items;

create policy items_select on public.lost_found_items for select to authenticated
  using (deleted_at is null and public.is_student());

create policy items_insert on public.lost_found_items for insert to authenticated
  with check (poster_id = auth.uid() and public.is_student());

create policy items_update on public.lost_found_items for update to authenticated
  using (poster_id = auth.uid())
  with check (poster_id = auth.uid());

-- ---- claims: claimant + the item's poster (no admin) ----
drop policy if exists claims_select on public.claims;
drop policy if exists claims_insert on public.claims;
drop policy if exists claims_update_admin on public.claims;
drop policy if exists claims_update_poster on public.claims;

create policy claims_select on public.claims for select to authenticated
  using (
    claimant_id = auth.uid()
    or exists (
      select 1 from public.lost_found_items i
      where i.id = claims.item_id and i.poster_id = auth.uid()
    )
  );

create policy claims_insert on public.claims for insert to authenticated
  with check (
    claimant_id = auth.uid()
    and status = 'Pending'
    and public.is_student()
    and not exists (
      select 1 from public.lost_found_items i
      where i.id = item_id and i.poster_id = auth.uid()
    )
  );

-- Only the item's poster can approve / reject claims on it.
create policy claims_update_poster on public.claims for update to authenticated
  using (
    exists (
      select 1 from public.lost_found_items i
      where i.id = claims.item_id and i.poster_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.lost_found_items i
      where i.id = claims.item_id and i.poster_id = auth.uid()
    )
  );
