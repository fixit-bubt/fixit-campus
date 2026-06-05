-- ============================================================================
-- FixIt — Migration 0040: LinkedIn URLs for BUBT Marketing faculty
-- 2 from JSON seed data + 1 web-confirmed (Omar Faruck Ansari, Chairman).
-- IS NULL guard makes all UPDATEs safe to re-run.
-- ============================================================================

DO $$
DECLARE
  mkt_id uuid;
BEGIN
  SELECT id INTO mkt_id
  FROM departments
  WHERE name ILIKE '%Marketing%'
  LIMIT 1;

  IF mkt_id IS NULL THEN
    RAISE EXCEPTION 'Marketing department not found';
  END IF;

  -- From JSON seed data
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/md-aslam-uddin-ph-d-57523622'
    WHERE name ILIKE '%Aslam Uddin%' AND department_id = mkt_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/dil-afrooz-khushee-5a09421a9'
    WHERE name ILIKE '%Dil Afrooz Khushee%' AND department_id = mkt_id AND linkedin_url IS NULL;

  -- Web-confirmed: LinkedIn title "Assistant Professor of Marketing at BUBT"
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/omar-faruck-ansari-4b157025'
    WHERE name ILIKE '%Omar Faruck Ansari%' AND department_id = mkt_id AND linkedin_url IS NULL;

END $$;
