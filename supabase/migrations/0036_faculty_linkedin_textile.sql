-- ============================================================================
-- FixIt — Migration 0036: LinkedIn URLs for BUBT Textile Engineering faculty
-- All 4 from JSON seed data; included with IS NULL guard as safety.
-- ============================================================================

DO $$
DECLARE
  tex_id uuid;
BEGIN
  SELECT id INTO tex_id
  FROM departments
  WHERE name ILIKE '%Textile Engineering%'
  LIMIT 1;

  IF tex_id IS NULL THEN
    RAISE EXCEPTION 'Textile Engineering department not found';
  END IF;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/razib-sheikh-67aaa1126'
    WHERE name ILIKE '%Razib Sheikh%' AND department_id = tex_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/taspiashawkat'
    WHERE name ILIKE '%Taspia Shawkat%' AND department_id = tex_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/md-merajur-rahman-46879b13b'
    WHERE name ILIKE '%Merajur Rahman%' AND department_id = tex_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/emran-hassan-bejoy-a5745a191'
    WHERE name ILIKE '%Emran Hassan Bejoy%' AND department_id = tex_id AND linkedin_url IS NULL;

END $$;
