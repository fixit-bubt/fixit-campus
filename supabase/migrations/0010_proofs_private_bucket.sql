-- ============================================================================
-- FixIt — Migration 0010: private bucket for Lost & Found claim proofs
-- Report/item photos stay in the public "photos" bucket. Claim PROOF images
-- (which may show IDs, receipts, serial numbers) move to a PRIVATE "proofs"
-- bucket, viewable only by:
--   • the uploader (the claimant), and
--   • the poster of the item the proof's claim belongs to.
-- The app stores the object PATH in claims.proof_url and views it through a
-- short-lived signed URL (see store.jsx getProofUrl).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', false)
on conflict (id) do nothing;

-- Upload: any signed-in user may upload a proof (the claim insert itself is
-- separately gated by the claims RLS policy).
create policy "proofs: authenticated upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs');

-- Read: the uploader, or the poster of the item this proof's claim is on.
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
          and i.poster_id = auth.uid()
      )
    )
  );

-- The uploader can replace / delete their own proof files.
create policy "proofs: owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'proofs' and owner = auth.uid());

create policy "proofs: owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and owner = auth.uid());
