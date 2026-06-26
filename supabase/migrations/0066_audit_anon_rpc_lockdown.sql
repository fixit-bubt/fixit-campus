-- 0066: lock down anon access to data-returning SECURITY DEFINER RPCs, and make
-- the unused public_profiles view honor RLS (security_invoker).
--
-- Audit 2026-06-26: these were callable with the public anon key (no login),
-- because EXECUTE defaults to PUBLIC (which includes the anon role):
--   campus_reports()  -> dumped every non-deleted report + reporter name,
--                        bypassing the owner/assigned/admin reports RLS.
--   donor_contact()   -> returned any user's WhatsApp where show_whatsapp=true.
-- claim_contact()/student_directory() already self-gate on auth.uid() (anon got
-- nothing back) but are tidied the same way. email_is_registered() is left as-is
-- on purpose: the registration screen calls it before the user is signed in.

-- Revoke the implicit PUBLIC grant (covers anon) and re-grant only signed-in users.
revoke execute on function public.campus_reports(integer) from public, anon;
grant  execute on function public.campus_reports(integer) to authenticated;

revoke execute on function public.donor_contact(uuid)     from public, anon;
grant  execute on function public.donor_contact(uuid)     to authenticated;

revoke execute on function public.claim_contact(uuid)     from public, anon;
grant  execute on function public.claim_contact(uuid)     to authenticated;

revoke execute on function public.student_directory()     from public, anon;
grant  execute on function public.student_directory()     to authenticated;

-- public_profiles is unused by app code, policies, views and functions, yet as a
-- SECURITY DEFINER view any authenticated user could read every profile row
-- (name / department / program / blood_group), bypassing the profiles RLS
-- policy (self / admin / approved-claim only). security_invoker makes the view
-- run under the caller's own RLS instead.
alter view public.public_profiles set (security_invoker = on);
