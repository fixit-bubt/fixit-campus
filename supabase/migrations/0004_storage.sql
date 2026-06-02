-- ============================================================================
-- FixIt — Migration 0004: photo storage
-- A single public bucket "photos" for report images, lost & found item
-- images, and claim proof images. Files get unguessable random paths.
--   • Read:   public (so <img src> works without signed URLs)
--   • Upload: signed-in users only
--   • Edit/Delete: only the user who uploaded the file
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Public read of files in the photos bucket
create policy "photos: public read"
  on storage.objects for select
  using (bucket_id = 'photos');

-- Signed-in users can upload to the photos bucket
create policy "photos: authenticated upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos');

-- Uploaders can update their own files
create policy "photos: owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'photos' and owner = auth.uid());

-- Uploaders can delete their own files
create policy "photos: owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and owner = auth.uid());
