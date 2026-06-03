-- ============================================================================
-- FixIt — Migration 0008: harden Lost & Found claim decisions
-- The poster owns claim decisions (0005), but nothing constrained WHAT could
-- change. This adds a BEFORE UPDATE trigger so that:
--   • the claimant-authored fields (claimant_id, item_id, kind, message,
--     proof_url, code) can never be edited by the poster;
--   • a claim can only move Pending -> Approved/Rejected, exactly once
--     (no re-deciding / toggling the contact reveal on and off);
--   • at most ONE claim per item can be Approved (prevents a poster from
--     approving many claims to harvest several students' private contacts),
--     and none once the item is Resolved.
-- Runs alongside the existing stamp_claim_decision trigger (which sets
-- decided_by/decided_at); this guard fires first and only validates.
-- ============================================================================

create or replace function public.guard_claim_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Claimant-authored content is immutable; only the decision may change.
  if new.claimant_id is distinct from old.claimant_id
     or new.item_id   is distinct from old.item_id
     or new.kind      is distinct from old.kind
     or new.message   is distinct from old.message
     or new.proof_url is distinct from old.proof_url
     or new.code      is distinct from old.code then
    raise exception 'Only a claim''s status can be changed';
  end if;

  if new.status is distinct from old.status then
    -- One-time decision: only an undecided (Pending) claim can be decided.
    if old.status <> 'Pending' then
      raise exception 'This claim has already been decided';
    end if;
    if new.status not in ('Approved', 'Rejected') then
      raise exception 'A claim can only be Approved or Rejected';
    end if;

    -- Only one approval per item, and not after the item is resolved.
    if new.status = 'Approved' then
      if exists (
        select 1 from public.lost_found_items i
        where i.id = new.item_id and i.status = 'Resolved'
      ) then
        raise exception 'This item is already resolved';
      end if;
      if exists (
        select 1 from public.claims c
        where c.item_id = new.item_id and c.id <> new.id and c.status = 'Approved'
      ) then
        raise exception 'Another claim on this item is already approved';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_claim_update() from public, anon, authenticated;

drop trigger if exists claims_guard_update on public.claims;
create trigger claims_guard_update
  before update on public.claims
  for each row execute function public.guard_claim_update();
