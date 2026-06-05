-- ============================================================================
-- FixIt — Migration 0041: LinkedIn URLs for BUBT Finance faculty
-- Both from JSON seed data. IS NULL guard makes UPDATEs safe to re-run.
-- ============================================================================

DO $$
DECLARE
  fin_id uuid;
BEGIN
  SELECT id INTO fin_id
  FROM departments
  WHERE name ILIKE '%Finance%'
  LIMIT 1;

  IF fin_id IS NULL THEN
    RAISE EXCEPTION 'Finance department not found';
  END IF;

  -- From JSON seed data
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/md-zakir-hosain-ph-d-18aa5b3a1'
    WHERE name ILIKE '%Zakir Hosain%' AND department_id = fin_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/md-sayeem-bin-hafiz-540a4328'
    WHERE name ILIKE '%Sayeem Bin Hafiz%' AND department_id = fin_id AND linkedin_url IS NULL;

END $$;
