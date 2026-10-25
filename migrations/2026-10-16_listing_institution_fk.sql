-- =====================================================================
-- listing_submissions.institution_id  (Phase 1 — FK fix)
-- Replaces the fragile name/phone/location matching with a real link.
-- Run in Supabase SQL Editor. Safe to re-run.
-- =====================================================================

-- STEP 1: add the column
ALTER TABLE listing_submissions
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS listing_submissions_institution_id_idx
  ON listing_submissions(institution_id);

-- STEP 2 (PREVIEW — run this alone first and check every row looks right)
-- Same priority as the old JS fallback: exact name -> fuzzy name -> phone -> district+upazila
WITH m AS (
  SELECT l.id AS listing_id, l.institution_name, l.contact_phone,
    COALESCE(
      (SELECT i.id FROM institutions i WHERE i.name = l.institution_name ORDER BY i.created_at LIMIT 1),
      (SELECT i.id FROM institutions i WHERE i.name ILIKE '%' || trim(l.institution_name) || '%' ORDER BY i.created_at LIMIT 1),
      (SELECT i.id FROM institutions i WHERE i.phone = l.contact_phone ORDER BY i.created_at LIMIT 1),
      (SELECT i.id FROM institutions i WHERE i.district = l.district AND i.upazila = l.upazila ORDER BY i.created_at LIMIT 1)
    ) AS matched_id
  FROM listing_submissions l
  WHERE l.institution_id IS NULL
)
SELECT m.listing_id, m.institution_name AS listing_name, m.contact_phone,
       i.name AS matched_institution, i.phone AS inst_phone, m.matched_id
FROM m LEFT JOIN institutions i ON i.id = m.matched_id
ORDER BY m.institution_name;

-- STEP 3: apply the backfill (only after the preview looks correct)
UPDATE listing_submissions l
SET institution_id = COALESCE(
  (SELECT i.id FROM institutions i WHERE i.name = l.institution_name ORDER BY i.created_at LIMIT 1),
  (SELECT i.id FROM institutions i WHERE i.name ILIKE '%' || trim(l.institution_name) || '%' ORDER BY i.created_at LIMIT 1),
  (SELECT i.id FROM institutions i WHERE i.phone = l.contact_phone ORDER BY i.created_at LIMIT 1),
  (SELECT i.id FROM institutions i WHERE i.district = l.district AND i.upazila = l.upazila ORDER BY i.created_at LIMIT 1)
)
WHERE l.institution_id IS NULL;

-- STEP 4: check — anything still unlinked needs a manual UPDATE
SELECT id, institution_name, contact_phone FROM listing_submissions WHERE institution_id IS NULL;
