-- 077_project_draft_step.sql
-- Step-position persistence for the project submission wizard.
--
-- The wizard auto-saves form fields and tech requirements, but a returning
-- developer always landed back on step 1 and had to click through to find
-- their place. `draft_step` records the last step worked on (1-5) so a draft
-- reopens exactly where the developer left off. Pure UI state: it is ignored
-- by scoring, matching and review, and is overwritten on every auto-save.

alter table projects
  add column if not exists draft_step smallint;

comment on column projects.draft_step is
  'Wizard UI state: last step (1-5) the developer worked on in the submission form. Restored when a draft reopens; ignored by scoring and review.';
