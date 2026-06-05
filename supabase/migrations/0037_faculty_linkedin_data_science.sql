-- ============================================================================
-- FixIt — Migration 0037: LinkedIn URLs for BUBT Data Science & Engineering faculty
-- All 5 from JSON seed data; same people as CSE but different department_id row.
-- IS NULL guard makes this safe even if seed already populated these.
-- ============================================================================

DO $$
DECLARE
  ds_id uuid;
BEGIN
  SELECT id INTO ds_id
  FROM departments
  WHERE name ILIKE '%Data Science%Engineering%'
  LIMIT 1;

  IF ds_id IS NULL THEN
    RAISE EXCEPTION 'Data Science & Engineering department not found';
  END IF;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/muhammad-aminur-rahaman-055a22a7'
    WHERE name ILIKE '%Aminur Rahaman%' AND department_id = ds_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/rajibul'
    WHERE name ILIKE '%Rajibul Islam%' AND department_id = ds_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/shawkat'
    WHERE name ILIKE '%Shawkat Ali%' AND department_id = ds_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/ahmed-shafkat-b29422108'
    WHERE name ILIKE '%Ahmed Shafkat%' AND department_id = ds_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/humayra-ferdous-41b284164'
    WHERE name ILIKE '%Humayra Ferdous%' AND department_id = ds_id AND linkedin_url IS NULL;

END $$;
