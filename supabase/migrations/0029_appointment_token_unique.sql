-- ============================================================================
-- FixIt — Migration 0029: back the queue token with a unique constraint
-- ----------------------------------------------------------------------------
-- 0024 made set_appointment_token() derive the next token from max(token)+1 per
-- (doctor_id, date), fixing reuse after a cancellation. But the trigger reads
-- the max and writes the new token without a unique constraint, so two
-- CONCURRENT inserts for the same doctor+day (different slots) can both read the
-- same max and derive the same 'T-NN' — two live patients with one queue number.
-- This adds a partial unique index over live (non-cancelled) appointments so the
-- second concurrent insert fails with 23505; addAppointment() already maps that
-- to a friendly "slot was just taken — please pick another" so the user retries
-- and gets a fresh token. Cancelled rows are excluded so a freed number can be
-- re-issued monotonically.
-- ============================================================================
create unique index if not exists appointments_token_unique
  on public.appointments (doctor_id, date, token)
  where status <> 'Cancelled';
