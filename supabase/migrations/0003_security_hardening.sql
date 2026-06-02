-- ============================================================================
-- FixIt — Migration 0003: security hardening
--  1. Smarter role-change guard: blocks logged-in non-admins from changing
--     roles, but allows the database console (no auth.uid) to seed the first
--     admin and allows logged-in admins to manage roles in-app.
--  2. Lock down SECURITY DEFINER functions so the public/anon role can't call
--     them directly (clears the "Public Can Execute SECURITY DEFINER Function"
--     advisory). Trigger functions need no EXECUTE grant — triggers still fire.
-- ============================================================================

-- 1. Improved guard (idempotent — safe to re-run) -----------------------------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.role is distinct from old.role)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

-- 2. Restrict who can EXECUTE the SECURITY DEFINER functions ------------------
-- Trigger-only functions: nobody needs direct execute.
revoke execute on function public.set_updated_at()         from public, anon, authenticated;
revoke execute on function public.handle_new_user()        from public, anon, authenticated;
revoke execute on function public.log_report_event()       from public, anon, authenticated;
revoke execute on function public.prevent_role_escalation() from public, anon, authenticated;
revoke execute on function public.stamp_claim_decision()   from public, anon, authenticated;

-- is_admin() is used inside RLS policies, so signed-in users must run it;
-- the public/anon role does not.
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;

-- ============================================================================
-- Note: the public_profiles view is intentionally a SECURITY DEFINER view —
-- it exposes ONLY non-sensitive columns (id, full_name, role, department) and
-- never email. The advisor may still flag it; that is an accepted, documented
-- exception (it must bypass row RLS to show names across the app).
-- ============================================================================
