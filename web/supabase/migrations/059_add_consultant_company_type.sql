-- 059: Ensure consultant organisations can be created during onboarding.
-- Some databases reached migration 058 without company_type.CONSULTANT present,
-- causing onboarding inserts to fail with:
-- invalid input value for enum company_type: "CONSULTANT"

ALTER TYPE company_type ADD VALUE IF NOT EXISTS 'CONSULTANT';

