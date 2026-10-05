-- 058: Add GRANT_PROVIDER to company_type enum so grant providers can self-register
-- via the onboarding flow (previously the enum only had DEVELOPER/CAPITAL/TECHNICAL/
-- POWER_TRADER/CONSULTANT, which made GRANT_PROVIDER companies impossible to create).

ALTER TYPE company_type ADD VALUE IF NOT EXISTS 'GRANT_PROVIDER';

-- Store the profile type chosen during self-registration so the onboarding flow
-- can pre-select the correct company type for the user.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS registration_type TEXT;