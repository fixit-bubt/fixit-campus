-- ============================================================================
-- FixIt — Migration 0027: guard appointment updates
-- ----------------------------------------------------------------------------
-- appts_update (0016) allowed the owning student to update their row with no
-- column/transition guard (unlike reports/claims). Two reachable abuses:
--   • a student could self-advance status Booked -> Confirmed/Completed via a
--     direct API call, forging a clinic decision that only an admin should make;
--   • a student could change doctor_id/date/slot after booking, but the queue
--     token (set only on INSERT, per-doctor-per-day) was never recomputed — so
--     a moved appointment could collide with another patient's token (the same
--     class of bug 0024 fixed for cancel+rebook).
-- This adds a BEFORE UPDATE guard (mirroring guard_claim_update /
-- guard_report_update): non-admins may ONLY cancel — booking identity
-- (doctor/date/slot/token/code) is frozen, and the only status they may set is
-- 'Cancelled'. Admins (the DoctorQueue path) keep full freedom via the early
-- return. Rescheduling = cancel + rebook, which keeps tokens correct.
-- ============================================================================
create or replace function public.guard_appointment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.doctor_id  is distinct from old.doctor_id
     or new.student_id is distinct from old.student_id
     or new.date     is distinct from old.date
     or new.slot     is distinct from old.slot
     or new.token    is distinct from old.token
     or new.code     is distinct from old.code then
    raise exception 'Only the appointment status may be changed';
  end if;
  if new.status is distinct from old.status then
    if old.status in ('Completed', 'Cancelled') then
      raise exception 'This appointment is closed';
    end if;
    if new.status <> 'Cancelled' then
      raise exception 'You can only cancel your appointment';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_appointment_update() from public, anon, authenticated;

drop trigger if exists appointments_guard_update on public.appointments;
create trigger appointments_guard_update
  before update on public.appointments
  for each row execute function public.guard_appointment_update();
