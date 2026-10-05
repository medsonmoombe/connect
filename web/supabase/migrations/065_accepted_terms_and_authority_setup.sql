-- 065_accepted_terms_and_authority_setup.sql
-- Adds T&C acceptance tracking and authority org helpers.

-- T&C acceptance timestamp on user profiles
alter table user_profiles
  add column if not exists accepted_terms_at timestamptz;

comment on column user_profiles.accepted_terms_at is
  'Timestamp when the user explicitly accepted the platform Terms & Conditions. NULL means not yet accepted.';

-- AI re-analysis rate limiting: track last manual trigger per project
alter table projects
  add column if not exists last_analysis_requested_at timestamptz;

comment on column projects.last_analysis_requested_at is
  'Timestamp of the most recent manual AI re-analysis request. Used to enforce the 24-hour rate limit.';
