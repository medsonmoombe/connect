-- 076_onboarding_draft.sql
-- Step-wise form persistence for onboarding.
--
-- The onboarding wizard only wrote to the database on final submit (name on
-- "Continue", the company on "Save & Continue", preferences on the last step).
-- A user who closed the tab mid-way — or whose session died on step 3 of the
-- company form — lost everything and had to start over. This adds a single
-- jsonb draft column to user_profiles that the wizard writes to on every step
-- (debounced), so the application can be completed later with the earlier
-- inputs populated. The draft is cleared when onboarding completes.

alter table user_profiles
  add column if not exists onboarding_draft jsonb not null default '{}'::jsonb;

comment on column user_profiles.onboarding_draft is
  'In-progress onboarding wizard state (step, company form, role preferences). Written by the client on every step change; cleared by complete_onboarding.';
