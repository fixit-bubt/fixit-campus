-- ============================================================================
-- FixIt — Migration 0044: LinkedIn URLs for BUBT English faculty
-- 3 from JSON seed data + 1 web-confirmed (Mohammad Shawkat Ali, Assoc Prof).
-- IS NULL guard makes all UPDATEs safe to re-run.
-- ============================================================================

DO $$
DECLARE
  eng_id uuid;
BEGIN
  SELECT id INTO eng_id
  FROM departments
  WHERE name ILIKE '%English%'
  LIMIT 1;

  IF eng_id IS NULL THEN
    RAISE EXCEPTION 'English department not found';
  END IF;

  -- From JSON seed data
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/prof-dr-k-ahmed-alam-6270731a9'
    WHERE name ILIKE '%K Ahmed Alam%' AND department_id = eng_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/mahmud-sazzad'
    WHERE name ILIKE '%Mahmud Sazzad%' AND department_id = eng_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/nadia-afroze-6321a9295'
    WHERE name ILIKE '%Nadia Afroze%' AND department_id = eng_id AND linkedin_url IS NULL;

  -- Web-confirmed: LinkedIn title "Associate Professor" at BUBT English Dept
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/mohammad-shawkat-ali-093573207'
    WHERE name ILIKE '%Mohammad Shawkat Ali%' AND department_id = eng_id AND linkedin_url IS NULL;

END $$;
