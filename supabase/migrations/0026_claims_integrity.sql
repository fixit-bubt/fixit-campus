-- ============================================================================
-- FixIt — Migration 0026: Lost & Found claim integrity
-- ----------------------------------------------------------------------------
-- Two gaps the prior review confirmed:
--   1) "One claim per claimant per item" was UI-only — a direct API caller could
--      POST unlimited Pending claims on the same item. Add a partial UNIQUE index
--      over ACTIVE claims (Pending/Approved) so a rejected claimant can still
--      re-submit, but no one can spam duplicate live claims.
--   2) Approving a claim never moved the parent item to 'Resolved', so the
--      item stayed Open forever and other students kept claiming it (and the
--      0008 "not after Resolved" guards were dead code). Add an AFTER UPDATE
--      trigger that flips the item to Resolved on approval — authoritative in
--      the DB, no client change needed (setClaimStatus already reloads items).
--
-- NOTE: if the table already contains duplicate active claims from before this
-- fix, the index creation will fail — de-dupe those rows first, then re-run.
-- ============================================================================

create unique index if not exists claims_one_active_per_claimant_per_item
  on public.claims (item_id, claimant_id)
  where status in ('Pending', 'Approved');

create or replace function public.resolve_item_on_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Approved' and old.status is distinct from 'Approved' then
    update public.lost_found_items
       set status = 'Resolved'
     where id = new.item_id and status <> 'Resolved';
  end if;
  return new;
end;
$$;
revoke execute on function public.resolve_item_on_approval() from public, anon, authenticated;

drop trigger if exists claims_resolve_item on public.claims;
create trigger claims_resolve_item
  after update on public.claims
  for each row execute function public.resolve_item_on_approval();
