-- ============================================================================
-- FixIt — Migration 0043: LinkedIn URLs for BUBT Law & Justice faculty
-- All 4 from JSON seed data. IS NULL guard makes UPDATEs safe to re-run.
-- ============================================================================

DO $$
DECLARE
  law_id uuid;
BEGIN
  SELECT id INTO law_id
  FROM departments
  WHERE name ILIKE '%Law%Justice%'
  LIMIT 1;

  IF law_id IS NULL THEN
    RAISE EXCEPTION 'Law & Justice department not found';
  END IF;

  -- From JSON seed data
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/professor-syed-sarfaraj-hamid-phd-a94243146'
    WHERE name ILIKE '%Sarfaraj Hamid%' AND department_id = law_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/dr-milan-hossain-7210b842'
    WHERE name ILIKE '%Milan Hossain%' AND department_id = law_id AND linkedin_url IS NULL;

  -- UTM params stripped from original JSON entry
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/subrina-akter-3512a11b4'
    WHERE name ILIKE '%Subrina Akter%' AND department_id = law_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/helal-morshed-omiyo'
    WHERE name ILIKE '%Helal Morshed Omiyo%' AND department_id = law_id AND linkedin_url IS NULL;

END $$;
