-- ============================================================================
-- FixIt — Migration 0021: seed the medical center doctors
-- ----------------------------------------------------------------------------
-- 0016 created the public.doctors table (admin-managed reference data) but left
-- it empty; the doctor list lived as an in-screen DOCTORS constant. This seeds
-- those six doctors into the table so Medical Center runs on live data. The
-- store now reads doctors from here; an admin can add/edit/deactivate more.
-- Idempotent: re-running won't duplicate (on conflict do nothing).
-- ============================================================================
insert into public.doctors (id, name, specialty, days, start_time, end_time, room) values
  ('d1', 'Dr. Farhana Haque',    'General Physician', '{Sat,Sun,Mon,Tue,Wed}', '09:00', '13:00', 'Medical Center · Room 1'),
  ('d2', 'Dr. Imran Chowdhury',  'Medicine',          '{Sat,Sun,Mon,Tue,Wed}', '10:00', '14:00', 'Medical Center · Room 2'),
  ('d3', 'Dr. Sabrina Akter',    'Gynecology',        '{Sun,Tue,Thu}',         '11:00', '14:00', 'Medical Center · Room 3'),
  ('d4', 'Dr. Mahmudul Hasan',   'Dental',            '{Sat,Sun,Mon,Tue,Wed}', '09:30', '13:30', 'Dental Unit'),
  ('d5', 'Dr. Nasreen Sultana',  'ENT',               '{Mon,Wed}',             '10:00', '13:00', 'Medical Center · Room 4'),
  ('d6', 'Dr. Rafiqul Islam',    'Orthopedics',       '{Sat,Mon,Wed}',         '10:00', '13:00', 'Medical Center · Room 5')
on conflict (id) do nothing;
