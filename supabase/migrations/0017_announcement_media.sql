-- ============================================================================
-- FixIt — Migration 0017: announcement media
-- ----------------------------------------------------------------------------
-- BUBT usually posts notices as a scanned IMAGE on letterhead, so give each
-- announcement an inline image (shown in the card + detail). Also store the
-- original attachment filename so the PDF download has a real, named file.
-- Images go to the existing public "photos" bucket; PDFs to "attachments"
-- (both created earlier). Columns are nullable — text-only notices still work.
-- ============================================================================
alter table public.announcements
  add column if not exists image_url       text,   -- inline notice image (photo/scan)
  add column if not exists attachment_name text;   -- original PDF filename for display
