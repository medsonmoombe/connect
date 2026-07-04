-- Matching Engine & PRD Updates

-- Project stage support for current project submission flow
ALTER TYPE project_stage ADD VALUE IF NOT EXISTS 'CONCEPT';

-- 1. Alter Tables
-- companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_new_company_with_experienced_team BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS management_team_experience JSONB DEFAULT '{}';

-- capital_partners
ALTER TABLE capital_partners ADD COLUMN IF NOT EXISTS preferred_project_stage project_stage[];
ALTER TABLE capital_partners ADD COLUMN IF NOT EXISTS expected_return_profile TEXT;
ALTER TABLE capital_partners ADD COLUMN IF NOT EXISTS preferred_capital_structure capital_structure_type[];

-- technical_partners
ALTER TABLE technical_partners ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE technical_partners ADD COLUMN IF NOT EXISTS project_type_experience TEXT[];
ALTER TABLE technical_partners ADD COLUMN IF NOT EXISTS min_ticket_size_zmw BIGINT;
ALTER TABLE technical_partners ADD COLUMN IF NOT EXISTS max_ticket_size_zmw BIGINT;
ALTER TABLE technical_partners ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;
ALTER TABLE technical_partners ADD COLUMN IF NOT EXISTS company_experience_doc_url TEXT;

-- technical_match_results
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_status') THEN
        CREATE TYPE match_status AS ENUM ('active', 'inactive');
    END IF;
END $$;

ALTER TABLE technical_match_results ADD COLUMN IF NOT EXISTS status match_status DEFAULT 'active';

-- 2. RLS & Permissions
-- Update RLS for project_scores to restrict SELECT access for users with TECHNICAL_PARTNER role.
DROP POLICY IF EXISTS "project_scores_select" ON project_scores;
CREATE POLICY "project_scores_select" ON project_scores FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id::text = auth.uid()::text 
    AND (
      u.role = 'ADMIN' OR 
      (u.role = 'DEVELOPER' AND EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id::text = project_scores.project_id::text 
        AND p.developer_id::text = u.company_id::text
      )) OR
      (u.role = 'CAPITAL_PARTNER' AND EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.project_id::text = project_scores.project_id::text 
        AND e.counterparty_id::text = u.company_id::text
        AND e.status::text NOT IN ('INTRO_SENT')
      ))
    )
  )
);

-- Allow project owners or Admins to insert and update project scores
DROP POLICY IF EXISTS "project_scores_insert" ON project_scores;
CREATE POLICY "project_scores_insert" ON project_scores FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id::text = auth.uid()::text 
    AND (
      u.role = 'ADMIN' OR 
      (u.role = 'DEVELOPER' AND EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id::text = project_scores.project_id::text 
        AND p.developer_id::text = u.company_id::text
      ))
    )
  )
);

DROP POLICY IF EXISTS "project_scores_update" ON project_scores;
CREATE POLICY "project_scores_update" ON project_scores FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id::text = auth.uid()::text 
    AND (
      u.role = 'ADMIN' OR 
      (u.role = 'DEVELOPER' AND EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id::text = project_scores.project_id::text 
        AND p.developer_id::text = u.company_id::text
      ))
    )
  )
);

DROP POLICY IF EXISTS "capital_match_results_select" ON capital_match_results;
CREATE POLICY "capital_match_results_select" ON capital_match_results FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id::text = auth.uid()::text
    AND (
      u.role = 'ADMIN'
      OR EXISTS (SELECT 1 FROM capital_partners cp WHERE cp.id::text = capital_match_results.capital_partner_id::text AND cp.company_id::text = u.company_id::text)
      OR EXISTS (SELECT 1 FROM projects p WHERE p.id::text = capital_match_results.project_id::text AND p.developer_id::text = u.company_id::text)
    )
  )
);

DROP POLICY IF EXISTS "technical_match_results_select" ON technical_match_results;
CREATE POLICY "technical_match_results_select" ON technical_match_results FOR SELECT USING (
  technical_match_results.status::text = 'active'
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.id::text = auth.uid()::text
    AND (
      u.role = 'ADMIN'
      OR EXISTS (SELECT 1 FROM technical_partners tp WHERE tp.id::text = technical_match_results.technical_partner_id::text AND tp.company_id::text = u.company_id::text)
      OR EXISTS (SELECT 1 FROM projects p WHERE p.id::text = technical_match_results.project_id::text AND p.developer_id::text = u.company_id::text)
    )
  )
);
