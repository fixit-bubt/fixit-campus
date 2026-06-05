-- ============================================================================
-- FixIt — Migration 0033: LinkedIn URLs for BUBT CSE faculty
-- Web-searched and cross-verified (university + designation + email/username).
-- Only high-confidence matches included; ambiguous name collisions skipped.
-- ============================================================================

DO $$
DECLARE
  cse_id uuid;
BEGIN
  SELECT id INTO cse_id
  FROM departments
  WHERE name ILIKE '%Computer Science%Engineering%'
  LIMIT 1;

  IF cse_id IS NULL THEN
    RAISE EXCEPTION 'CSE department not found';
  END IF;

  -- Professors / Associate Professors
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/shawkat'
    WHERE name ILIKE '%Shawkat Ali%' AND department_id = cse_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/muhammad-aminur-rahaman-055a22a7'
    WHERE name ILIKE '%Aminur Rahaman%' AND department_id = cse_id AND linkedin_url IS NULL;

  -- Assistant Professors
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/mir-ripon'
    WHERE name ILIKE '%Mijanur Rahaman%' AND department_id = cse_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/shamim-ahmed-47222656'
    WHERE name = 'Shamim Ahmed' AND department_id = cse_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/md-masudul-islam-90981510a'
    WHERE name ILIKE '%Masudul Islam%' AND department_id = cse_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/sudipto-chaki'
    WHERE name ILIKE '%Sudipto Chaki%' AND department_id = cse_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/sondip-poul-singh-756036118'
    WHERE name ILIKE '%Sondip%Singh%' AND department_id = cse_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/most-jannatul-ferdous-60b176171'
    WHERE name ILIKE '%Jannatul Ferdous%' AND department_id = cse_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/md-mahbub-or-rashid-707040a3'
    WHERE name ILIKE '%Mahbub%Rashid%' AND department_id = cse_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/nahid-anwar007'
    WHERE name ILIKE '%Nahid Anwar%' AND department_id = cse_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/milon-biswas'
    WHERE name ILIKE '%Milon Biswas%' AND department_id = cse_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/fadl-rabbi'
    WHERE name ILIKE '%Fazle Rabbi%' AND department_id = cse_id AND linkedin_url IS NULL;

END $$;
