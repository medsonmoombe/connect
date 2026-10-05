-- 073: Record who initiated an engagement (direction of the intro request).
--
-- The engagement detail screen assumed every INTRO_SENT engagement was inbound
-- partner interest ("a capital partner has expressed interest…") and gave the
-- developer the Accept/Decline buttons. That is wrong for developer-initiated
-- requests (project-creation "Contact partner" flow, Find Partners, Gap
-- Resolution) — there the COUNTERPARTY is the one who must accept.
--
-- intro_origin:
--   'developer' → the developer sent the request; the COUNTERPARTY accepts.
--   'partner'   → the partner expressed interest; the DEVELOPER accepts
--                 (previous behaviour).
--   NULL        → legacy rows created before this column existed; treated as
--                 partner-initiated so existing engagements keep working.

ALTER TABLE public.engagements
  ADD COLUMN IF NOT EXISTS intro_origin TEXT;

ALTER TABLE public.engagements
  ADD CONSTRAINT engagements_intro_origin_check
  CHECK (intro_origin IN ('developer', 'partner'));

COMMENT ON COLUMN public.engagements.intro_origin IS
  'Who initiated the introduction: developer (counterparty accepts) or partner (developer accepts). NULL = legacy row, treated as partner-initiated.';
