-- ============================================================================
-- FixIt — Migration 0039: LinkedIn URLs for BUBT Accounting faculty
-- 3 from JSON seed data + 1 web-confirmed (Mustafizur Rahaman, PhD Fellow UQ).
-- IS NULL guard makes all UPDATEs safe to re-run.
-- ============================================================================

DO $$
DECLARE
  acc_id uuid;
BEGIN
  SELECT id INTO acc_id
  FROM departments
  WHERE name ILIKE '%Accounting%'
  LIMIT 1;

  IF acc_id IS NULL THEN
    RAISE EXCEPTION 'Accounting department not found';
  END IF;

  -- From JSON seed data
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/md-tanim-ul-islam-845986110'
    WHERE name ILIKE '%Tanim%Islam%' AND department_id = acc_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/shahnag-akter-bb55b865'
    WHERE name ILIKE '%Shahnag Akter%' AND department_id = acc_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/sumon-sheikh'
    WHERE name ILIKE '%Sumon Sheikh%' AND department_id = acc_id AND linkedin_url IS NULL;

  -- Web-confirmed: "PhD Fellow at UQ Australia; Former Chair, Dept of Accounting, BUBT"
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/md-mustafizur-rahaman-367371200'
    WHERE name ILIKE '%Mustafizur Rahaman%' AND department_id = acc_id AND linkedin_url IS NULL;

END $$;
