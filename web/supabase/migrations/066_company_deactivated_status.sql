-- 066: Allow 'deactivated' status on companies (used to deactivate authority orgs)
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_status_check;
ALTER TABLE companies ADD CONSTRAINT companies_status_check
  CHECK (status IN ('pending_verification','verified','rejected','needs_update','deactivated'));

CREATE INDEX IF NOT EXISTS idx_companies_authority_org ON companies(is_authority_org) WHERE is_authority_org = true;
