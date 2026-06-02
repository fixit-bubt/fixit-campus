-- ============================================================================
-- FixIt — Migration 0002: Row-Level Security (RLS) + access rules
-- Every table is locked by default; these policies open exactly the right
-- doors per role. Security is enforced by the DATABASE, not the UI.
-- Roles: a signed-in user is "authenticated"; not-signed-in is "anon".
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can read role without tripping
-- the very policies they support — avoids infinite recursion).
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- Lock everything down: no anonymous (not-signed-in) access at all.
-- ----------------------------------------------------------------------------
revoke all on public.profiles         from anon;
revoke all on public.reports          from anon;
revoke all on public.report_events    from anon;
revoke all on public.lost_found_items from anon;
revoke all on public.claims           from anon;

alter table public.profiles         enable row level security;
alter table public.reports          enable row level security;
alter table public.report_events    enable row level security;
alter table public.lost_found_items enable row level security;
alter table public.claims           enable row level security;

-- Signed-in users may call these tables/sequences; ROW access is still gated
-- by the policies below. (Code defaults call nextval, so grant sequence usage.)
grant select, update                 on public.profiles         to authenticated;
grant select, insert, update         on public.reports          to authenticated;
grant select                         on public.report_events    to authenticated;
grant select, insert, update         on public.lost_found_items to authenticated;
grant select, insert, update         on public.claims           to authenticated;
grant usage on sequence public.report_code_seq to authenticated;
grant usage on sequence public.item_code_seq   to authenticated;
grant usage on sequence public.claim_code_seq  to authenticated;

-- ============================================================================
-- profiles
-- Full row (incl. email) is readable only by: yourself, an admin, or the
-- matched party of an APPROVED claim. Everyone else reads names via the
-- public_profiles view below (which never exposes email).
-- ============================================================================
create policy profiles_select_self_admin_or_matched
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.claims c
      join public.lost_found_items i on i.id = c.item_id
      where c.status = 'Approved'
        and (
          (i.poster_id = profiles.id and c.claimant_id = auth.uid())
          or (c.claimant_id = profiles.id and i.poster_id = auth.uid())
        )
    )
  );

-- You may update your own profile; admins may update anyone.
create policy profiles_update_self_or_admin
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Prevent privilege escalation: only admins may change a role.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.role is distinct from old.role) and not public.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

create trigger profiles_no_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- Safe public directory of names/roles — NO email. Bypasses row RLS on
-- purpose, but exposes only non-sensitive columns. Used for showing the
-- reporter/staff/claimant names across the app.
create or replace view public.public_profiles as
  select id, full_name, role, department from public.profiles;

revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

-- ============================================================================
-- reports
-- ============================================================================
-- Read: your own, ones assigned to you (staff), or anything (admin).
create policy reports_select
  on public.reports for select to authenticated
  using (
    deleted_at is null
    and (reporter_id = auth.uid() or assigned_staff_id = auth.uid() or public.is_admin())
  );

-- Create: a signed-in user files a report as themselves, status Open.
create policy reports_insert
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'Open');

-- Update: owner (while Open), the assigned staff, or an admin.
create policy reports_update
  on public.reports for update to authenticated
  using (
    public.is_admin()
    or (reporter_id = auth.uid() and status = 'Open')
    or assigned_staff_id = auth.uid()
  )
  with check (
    public.is_admin()
    or reporter_id = auth.uid()
    or assigned_staff_id = auth.uid()
  );
-- (Deleting a report = setting deleted_at, covered by the update policy.
--  No hard-DELETE policy exists, so rows can never be truly erased.)

-- ============================================================================
-- report_events  (status history — read-only to users)
-- ============================================================================
-- Visible if you can see the parent report. Inserts happen only via the
-- log_report_event() trigger (SECURITY DEFINER), so history can't be faked.
create policy report_events_select
  on public.report_events for select to authenticated
  using (
    exists (
      select 1 from public.reports r
      where r.id = report_events.report_id
        and r.deleted_at is null
        and (r.reporter_id = auth.uid() or r.assigned_staff_id = auth.uid() or public.is_admin())
    )
  );

-- ============================================================================
-- lost_found_items
-- ============================================================================
-- Any signed-in user can browse non-deleted items.
create policy items_select
  on public.lost_found_items for select to authenticated
  using (deleted_at is null);

-- Create: post as yourself.
create policy items_insert
  on public.lost_found_items for insert to authenticated
  with check (poster_id = auth.uid());

-- Update: the poster or an admin (delete = setting deleted_at).
create policy items_update
  on public.lost_found_items for update to authenticated
  using (poster_id = auth.uid() or public.is_admin())
  with check (poster_id = auth.uid() or public.is_admin());

-- ============================================================================
-- claims
-- ============================================================================
-- Read: the claimant, the item's poster, or an admin.
create policy claims_select
  on public.claims for select to authenticated
  using (
    claimant_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.lost_found_items i
      where i.id = claims.item_id and i.poster_id = auth.uid()
    )
  );

-- Create: claim as yourself, status Pending, and not on your own item.
create policy claims_insert
  on public.claims for insert to authenticated
  with check (
    claimant_id = auth.uid()
    and status = 'Pending'
    and not exists (
      select 1 from public.lost_found_items i
      where i.id = item_id and i.poster_id = auth.uid()
    )
  );

-- Update (approve/reject): admins only.
create policy claims_update_admin
  on public.claims for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Stamp who decided a claim and when (integrity, not trusting the client).
create or replace function public.stamp_claim_decision()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.status is distinct from old.status and new.status in ('Approved','Rejected')) then
    new.decided_by = auth.uid();
    new.decided_at = now();
  end if;
  return new;
end;
$$;

create trigger claims_stamp_decision
  before update on public.claims
  for each row execute function public.stamp_claim_decision();

-- ============================================================================
-- End of 0002. Tables are now open exactly as much as each role needs —
-- and no more. Run Supabase's Security Advisor to confirm a clean bill.
-- ============================================================================
