-- ============================================================================
-- FixIt — Migration 0077: optional course code on marketplace listings
-- ----------------------------------------------------------------------------
-- Books/Notes listings can carry the course they belong to (e.g. "CSE 101").
-- Study Hub course pages surface matching Available listings, connecting the
-- used-textbook market to the course it serves. Nullable; no RLS change —
-- listings already grant full column access to authenticated with row policies.
-- ============================================================================

alter table public.listings add column if not exists course_code text;

create index if not exists listings_course_code_idx
  on public.listings (course_code) where course_code is not null;
