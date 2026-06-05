-- ============================================================================
-- FixIt — Migration 0038: LinkedIn URLs for BUBT Management faculty
-- 4 from JSON seed data + 1 web-confirmed (Tahsina Tabassum).
-- IS NULL guard makes all UPDATEs safe to re-run.
-- ============================================================================

DO $$
DECLARE
  mgmt_id uuid;
BEGIN
  SELECT id INTO mgmt_id
  FROM departments
  WHERE name ILIKE '%Management%'
  LIMIT 1;

  IF mgmt_id IS NULL THEN
    RAISE EXCEPTION 'Management department not found';
  END IF;

  -- From JSON seed data
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/zannatul-ferdus-7879494a'
    WHERE name ILIKE '%Zannatul Ferdus%' AND department_id = mgmt_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/capshimanto'
    WHERE name ILIKE '%Shimanto Saha%' AND department_id = mgmt_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/fardin-helal'
    WHERE name ILIKE '%Fardin Helal%' AND department_id = mgmt_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/enzamamul-haque-5254b8205'
    WHERE name ILIKE '%Enzamamul Haque%' AND department_id = mgmt_id AND linkedin_url IS NULL;

  -- Web-confirmed: LinkedIn title "Assistant Professor at Bangladesh University of Business and Technology"
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/tahsina-tabassum-b17a4b169'
    WHERE name ILIKE '%Tahsina Tabassum%' AND department_id = mgmt_id AND linkedin_url IS NULL;

END $$;
