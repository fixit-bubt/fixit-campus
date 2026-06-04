-- ============================================================================
-- FixIt — Migration 0024: monotonic appointment tokens (fix duplicate tokens)
-- ----------------------------------------------------------------------------
-- BUG: the original set_appointment_token() (0016) computed the token as
-- count(non-cancelled appointments for doctor+date) + 1. Because cancelled rows
-- were excluded from the count, cancelling an earlier booking let a later
-- booking re-derive an already-issued number — so two LIVE appointments on the
-- same doctor+day could share a token (the token is the patient's queue id, so
-- two people get told to present the same number).
--
-- FIX: derive the next number from the MAX token ever issued for that
-- (doctor_id, date) across ALL rows (including cancelled), so numbers are
-- monotonic and never reused. Re-creating the function is enough; the existing
-- BEFORE INSERT trigger (appointments_set_token) already calls it by name.
-- ============================================================================
create or replace function public.set_appointment_token()
returns trigger language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  select coalesce(max(nullif(regexp_replace(token, '\D', '', 'g'), '')::int), 0) + 1
    into n
  from public.appointments
  where doctor_id = new.doctor_id and date = new.date;
  new.token := 'T-' || lpad(n::text, 2, '0');
  return new;
end; $$;
