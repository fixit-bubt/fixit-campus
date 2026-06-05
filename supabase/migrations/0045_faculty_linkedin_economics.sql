-- ============================================================================
-- FixIt — Migration 0045: LinkedIn URLs for BUBT Economics faculty
-- 6 from JSON seed data + 3 web-confirmed (Mahmudul Hassan, Mahboob Ali, Rejaul Karim).
-- IS NULL guard makes all UPDATEs safe to re-run.
-- ============================================================================

DO $$
DECLARE
  eco_id uuid;
BEGIN
  SELECT id INTO eco_id
  FROM departments
  WHERE name ILIKE '%Economics%'
  LIMIT 1;

  IF eco_id IS NULL THEN
    RAISE EXCEPTION 'Economics department not found';
  END IF;

  -- Web-confirmed: LinkedIn shows "Associate Professor & Chairman, Dept of Economics, BUBT"
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/md-mahmudul-hassan-a13389243'
    WHERE name ILIKE '%Mahmudul Hassan%' AND department_id = eco_id AND linkedin_url IS NULL;

  -- Web-confirmed: confirmed BUBT Economics Professor per LinkedIn + BUBT faculty page
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/muhammad-mahboob-ali-05764a11'
    WHERE name ILIKE '%Muhammad Mahboob Ali%' AND department_id = eco_id AND linkedin_url IS NULL;

  -- Web-confirmed: LinkedIn title "Assistant Professor - Bangladesh University of Business and Technology (BUBT)"
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/md-rejaul-karim-765a60334'
    WHERE name ILIKE '%Rejaul Karim%' AND department_id = eco_id AND linkedin_url IS NULL;

  -- From JSON seed data
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/md-rakibul-islam-sabbir-4444bb60'
    WHERE name ILIKE '%Rakibul Islam%' AND department_id = eco_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/mst-amina-khatun-486999125'
    WHERE name ILIKE '%Amina Khatun%' AND department_id = eco_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/k-m-rahmatullah-rahat-614973343'
    WHERE name ILIKE '%Rahmatullah Rahat%' AND department_id = eco_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/tasfiunnoor-pinky-0a6720287'
    WHERE name ILIKE '%Tasfiunnoor Pinky%' AND department_id = eco_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/asma-ul-husna'
    WHERE name ILIKE '%Asma-Ul-Husna%' AND department_id = eco_id AND linkedin_url IS NULL;

  -- UTM params stripped from original JSON entry
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/mizanur-rahman-b3648b269'
    WHERE name ILIKE '%Mizanur Rahman%' AND department_id = eco_id AND linkedin_url IS NULL;

END $$;
