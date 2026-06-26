-- 0063 covering indexes for unindexed foreign keys
-- Addresses the performance advisor's unindexed_foreign_keys findings (28 tables).
-- All additive and idempotent; no behavioral change.

create index if not exists announcement_reads_user_id_idx on announcement_reads (user_id);
create index if not exists announcements_created_by_idx on announcements (created_by);
create index if not exists blood_pledges_donor_id_idx on blood_pledges (donor_id);
create index if not exists blood_requests_requester_id_idx on blood_requests (requester_id);
create index if not exists claims_decided_by_idx on claims (decided_by);
create index if not exists club_members_added_by_idx on club_members (added_by);
create index if not exists club_posts_author_id_idx on club_posts (author_id);
create index if not exists clubs_faculty_advisor_id_idx on clubs (faculty_advisor_id);
create index if not exists clubs_created_by_idx on clubs (created_by);
create index if not exists event_rsvps_user_id_idx on event_rsvps (user_id);
create index if not exists events_created_by_idx on events (created_by);
create index if not exists faculty_bookmarks_faculty_id_idx on faculty_bookmarks (faculty_id);
create index if not exists job_bookmarks_job_id_idx on job_bookmarks (job_id);
create index if not exists job_reports_reporter_id_idx on job_reports (reporter_id);
create index if not exists jobs_removed_by_idx on jobs (removed_by);
create index if not exists jobs_posted_by_idx on jobs (posted_by);
create index if not exists report_events_created_by_idx on report_events (created_by);
create index if not exists ride_requests_requester_id_idx on ride_requests (requester_id);
create index if not exists saved_bus_routes_route_id_idx on saved_bus_routes (route_id);
create index if not exists study_access_requests_requested_by_idx on study_access_requests (requested_by);
create index if not exists study_access_requests_decided_by_idx on study_access_requests (decided_by);
create index if not exists study_access_requests_to_section_id_idx on study_access_requests (to_section_id);
create index if not exists study_books_added_by_idx on study_books (added_by);
create index if not exists study_courses_created_by_idx on study_courses (created_by);
create index if not exists study_intake_vote_ballots_cr_id_idx on study_intake_vote_ballots (cr_id);
create index if not exists study_intake_votes_initiated_by_idx on study_intake_votes (initiated_by);
create index if not exists study_materials_uploaded_by_idx on study_materials (uploaded_by);
create index if not exists study_pins_pinned_by_idx on study_pins (pinned_by);
create index if not exists study_question_bank_uploaded_by_idx on study_question_bank (uploaded_by);
create index if not exists study_section_grants_to_section_id_idx on study_section_grants (to_section_id);
create index if not exists study_section_members_decided_by_idx on study_section_members (decided_by);
create index if not exists study_section_requests_resolved_by_idx on study_section_requests (resolved_by);
create index if not exists study_section_requests_section_id_idx on study_section_requests (section_id);
