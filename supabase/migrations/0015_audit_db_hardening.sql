-- ============================================================================
-- FixIt — Migration 0015: remaining DB hardening from the audit (medium/low)
-- All idempotent / safe to re-run.
-- ============================================================================

-- 1. handle_new_user: don't abort signup if the auth email is NULL ------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1), 'User'),
    coalesce(new.email, ''),
    'student'
  );
  return new;
end;
$$;

-- 2. set_updated_at: pin search_path (clears the advisor warning) -------------
alter function public.set_updated_at() set search_path = public;

-- 3. Storage buckets: enforce size + image-only at the server ------------------
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id in ('photos', 'proofs');

-- 4. claims_insert: can't claim a soft-deleted or already-resolved item -------
drop policy if exists claims_insert on public.claims;
create policy claims_insert on public.claims for insert to authenticated
  with check (
    claimant_id = auth.uid()
    and status = 'Pending'
    and public.is_student()
    and exists (
      select 1 from public.lost_found_items i
      where i.id = item_id
        and i.poster_id <> auth.uid()
        and i.deleted_at is null
        and i.status <> 'Resolved'
    )
  );

-- 5. items_update: keep it students-only (consistent with items_select) -------
drop policy if exists items_update on public.lost_found_items;
create policy items_update on public.lost_found_items for update to authenticated
  using (poster_id = auth.uid() and public.is_student())
  with check (poster_id = auth.uid() and public.is_student());

-- 6. Last admin can't be DELETEd either (e.g. via auth.users cascade) ---------
create or replace function public.guard_last_admin_delete()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.role = 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Cannot delete the last admin';
  end if;
  return old;
end;
$$;
revoke execute on function public.guard_last_admin_delete() from public, anon, authenticated;

drop trigger if exists profiles_guard_last_admin_delete on public.profiles;
create trigger profiles_guard_last_admin_delete
  before delete on public.profiles
  for each row execute function public.guard_last_admin_delete();

-- 7. proofs bucket: scope uploads to your own folder, and only let the poster
--    read a proof actually uploaded by that claim's claimant -----------------
drop policy if exists "proofs: authenticated upload" on storage.objects;
create policy "proofs: authenticated upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "proofs: claimant or poster read" on storage.objects;
create policy "proofs: claimant or poster read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'proofs' and (
      owner = auth.uid()
      or exists (
        select 1
        from public.claims c
        join public.lost_found_items i on i.id = c.item_id
        where c.proof_url = storage.objects.name
          and c.claimant_id = storage.objects.owner
          and i.poster_id = auth.uid()
      )
    )
  );
