-- ============================================================================
-- FixIt — Migration 0030: notice attachment files are admin-only to modify
-- ----------------------------------------------------------------------------
-- 0028 locked announcement row edit/delete to is_admin() (so a demoted ex-admin
-- can't keep editing official notices). The parallel STORAGE policies for the
-- notice PDFs in the "attachments" bucket (0016) still gate update/delete on
-- `owner = auth.uid()`, so a demoted ex-admin who uploaded a notice PDF can still
-- replace or delete that file via a direct Storage API call — the same residual,
-- left open at the storage layer. Re-gate both on is_admin(). Upload was already
-- admin-only; the `bucket_id = 'attachments'` qualifier keeps the shared "photos"
-- bucket (student-owned listing/event images) unaffected.
-- ============================================================================
drop policy if exists "attachments: owner update" on storage.objects;
create policy "attachments: admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and public.is_admin())
  with check (bucket_id = 'attachments' and public.is_admin());

drop policy if exists "attachments: owner delete" on storage.objects;
create policy "attachments: admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and public.is_admin());
