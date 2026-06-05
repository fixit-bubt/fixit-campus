-- ============================================================================
-- FixIt — Migration 0034: LinkedIn URLs for BUBT EEE faculty
-- Web-searched and cross-verified (university + designation + email/username).
-- Only high-confidence matches included; ambiguous name collisions skipped.
-- JSON-sourced entries (already seeded) are included safely via IS NULL guard.
-- ============================================================================

DO $$
DECLARE
  eee_id uuid;
BEGIN
  SELECT id INTO eee_id
  FROM departments
  WHERE name ILIKE '%Electrical%Electronic%Engineering%'
  LIMIT 1;

  IF eee_id IS NULL THEN
    RAISE EXCEPTION 'EEE department not found';
  END IF;

  -- ── Professors ──────────────────────────────────────────────────────────────
  -- Dean, Faculty of Engineering & Applied Sciences; LinkedIn confirmed via
  -- personal blog + Facebook video showing him as BUBT Dean
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/munmrahman'
    WHERE name ILIKE '%Munshi Mahbubur Rahman%' AND department_id = eee_id AND linkedin_url IS NULL;

  -- ── Associate Professors ─────────────────────────────────────────────────────
  -- PhD from Swinburne University; "Associate Professor, Dept. of EEE, BUBT"
  -- confirmed via ZoomInfo + Google Scholar
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/md-shamsul-arefin-phd-a58a8816'
    WHERE name ILIKE '%Shamsul Arefin%' AND department_id = eee_id AND linkedin_url IS NULL;

  -- ── Assistant Professors ─────────────────────────────────────────────────────
  -- "Assistant Professor at Bangladesh University of Business and Technology"
  -- per LinkedIn title; research: solid-state physics / solar energy materials
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/kanij-fatema-023235258'
    WHERE name ILIKE '%Kanij Fatema%' AND department_id = eee_id AND linkedin_url IS NULL;

  -- Already in JSON seed data; included with IS NULL guard as safety
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/mohammad-jahidul-islam-901359145'
    WHERE name ILIKE '%Mohammad Jahidul Islam%' AND department_id = eee_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/asifulhaq'
    WHERE name ILIKE '%Asif ul Haq%' AND department_id = eee_id AND linkedin_url IS NULL;

  -- ── Lecturers ────────────────────────────────────────────────────────────────
  -- "Lecturer at Bangladesh University of Business & Technology - BUBT" per
  -- LinkedIn title; research: Photonics, Biosensors, Hollow Core Fiber
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/abror-jawad'
    WHERE name ILIKE '%Abror Jawad%' AND department_id = eee_id AND linkedin_url IS NULL;

  -- RIS / THz / FSO communications research matches JSON research interests;
  -- profile shows West Virginia University (PhD study leave from BUBT)
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/md-abdur-rakib-64765b1ab'
    WHERE name ILIKE '%Abdur Rakib%' AND department_id = eee_id AND linkedin_url IS NULL;

  -- RUET grad → BUBT EEE Lecturer; unique name, BUBT faculty page + LinkedIn both found
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/ragib-rowshon-000465147'
    WHERE name ILIKE '%Ragib Rowshon%' AND department_id = eee_id AND linkedin_url IS NULL;

  -- Already in JSON seed data; included with IS NULL guard as safety
  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/munsi-rahi-195a52181'
    WHERE name ILIKE '%Nahid%Rahi%' AND department_id = eee_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/abdullah-al-mahmud-nafiz-7b37641bb'
    WHERE name ILIKE '%Abdullah%Nafiz%' AND department_id = eee_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/mridul-mondal'
    WHERE name ILIKE '%Mridul Mondal%' AND department_id = eee_id AND linkedin_url IS NULL;

  UPDATE faculty SET linkedin_url = 'https://www.linkedin.com/in/skhasibulalam'
    WHERE name ILIKE '%Hasibul Alam%' AND department_id = eee_id AND linkedin_url IS NULL;

END $$;
