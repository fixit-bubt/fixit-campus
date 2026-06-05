-- ============================================================================
-- FixIt — Migration 0035: LinkedIn URLs for BUBT Civil Engineering faculty
-- 1 new via web search + 9 from JSON seed data (included with IS NULL guard).
-- ============================================================================

DO $$
DECLARE
  civil_id uuid;
BEGIN
  SELECT id INTO civil_id
  FROM departments
  WHERE name ILIKE '%Civil Engineering%'
  LIMIT 1;

  IF civil_id IS NULL THEN
    RAISE EXCEPTION 'Civil Engineering department not found';
  END IF;

  -- ── Professors ──────────────────────────────────────────────────────────────
  -- "Dean of Faculty of Engineering & Applied Sciences, BUBT" per LinkedIn;
  -- also listed as Treasurer, ASCE Fellow — confirmed unique match
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/prof-dr-ali-ahmed-08776322'
    WHERE name ILIKE '%Ali Ahmed%' AND department_id = civil_id AND linkedin_url IS NULL;

  -- ── Lecturers (from JSON seed data, IS NULL guard) ───────────────────────────
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/ragib-noor-21a103172'
    WHERE name ILIKE '%Ragib Noor%' AND department_id = civil_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/zahedce91'
    WHERE name ILIKE '%Zahed Hossain%' AND department_id = civil_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/mahmudur-0-rahman'
    WHERE name ILIKE '%Mahmudur Rahman%' AND department_id = civil_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/jobayer-islam-7397b927b'
    WHERE name ILIKE '%Jobayer Islam%' AND department_id = civil_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/siyamjunaid'
    WHERE name ILIKE '%Junaid Ul Islam%' AND department_id = civil_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/md-tanzil-h-33a549307'
    WHERE name ILIKE '%Tanzil Hawlader%' AND department_id = civil_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/ahmedjarif'
    WHERE name ILIKE '%Ahmed Jarif%' AND department_id = civil_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/raas-sarker-tomal'
    WHERE name ILIKE '%Raas Sarker Tomal%' AND department_id = civil_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/faiyazshahriar2627'
    WHERE name ILIKE '%Faiyaz Shahriar%' AND department_id = civil_id AND linkedin_url IS NULL;

END $$;
