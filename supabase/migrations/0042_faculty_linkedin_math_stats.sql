-- ============================================================================
-- FixIt — Migration 0042: LinkedIn URLs for BUBT Mathematics & Statistics faculty
-- All 5 from JSON seed data. IS NULL guard makes UPDATEs safe to re-run.
-- ============================================================================

DO $$
DECLARE
  math_id uuid;
BEGIN
  SELECT id INTO math_id
  FROM departments
  WHERE name ILIKE '%Mathematics%Statistics%'
  LIMIT 1;

  IF math_id IS NULL THEN
    RAISE EXCEPTION 'Mathematics & Statistics department not found';
  END IF;

  -- From JSON seed data
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/dr-m-k-hasan-90037a95'
    WHERE name ILIKE '%Kamrul Hasan%' AND department_id = math_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/atiqur-rahman-77b4b4371'
    WHERE name ILIKE '%Atiqur Rahman%' AND department_id = math_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/md-farooq-hasan-19a1b9146'
    WHERE name ILIKE '%Farooq Hasan%' AND department_id = math_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/mohammad-saifuddin-29997b98'
    WHERE name ILIKE '%Saifuddin%' AND department_id = math_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/joyprokashpaul'
    WHERE name ILIKE '%Joy Prokash Paul%' AND department_id = math_id AND linkedin_url IS NULL;

END $$;
