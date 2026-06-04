-- ============================================================================
-- FixIt — Migration 0023: seed the campus prayer times
-- ----------------------------------------------------------------------------
-- 0016 created public.prayer_times (a tiny admin-edited config: Azan + Jamaat
-- per prayer) but left it empty; the times lived as in-screen PRAYERS/JUMMAH
-- constants and admin jamaat tweaks went to localStorage. This seeds the six
-- rows so Prayer Times runs on live data and the admin "adjust jamaat" persists
-- to the DB (RLS: everyone reads, only admins write). The month table + the
-- next-prayer countdown stay computed client-side from these base times.
-- Idempotent: on conflict do nothing.
-- ============================================================================
insert into public.prayer_times (key, en, ar, azan, jamaat, sort) values
  ('fajr',    'Fajr',    'الفجر',   '03:50', '04:15', 1),
  ('dhuhr',   'Dhuhr',   'الظهر',   '12:05', '13:15', 2),
  ('asr',     'Asr',     'العصر',   '16:35', '16:50', 3),
  ('maghrib', 'Maghrib', 'المغرب',  '18:50', '18:53', 4),
  ('isha',    'Isha',    'العشاء',  '20:15', '20:45', 5),
  ('jummah',  'Jummah',  'الجمعة',  '12:05', '13:15', 6)
on conflict (key) do nothing;
