-- Migration 037: Secure realtime messaging policies
-- Fixes realtime visibility for partners because engagements.counterparty_id
-- stores capital_partners.id / technical_partners.id, not company_members.company_id.

CREATE INDEX IF NOT EXISTS idx_messages_engagement_created
  ON messages (engagement_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_capital_partners_company_id
  ON capital_partners (company_id);

CREATE INDEX IF NOT EXISTS idx_technical_partners_company_id
  ON technical_partners (company_id);

DROP POLICY IF EXISTS "parties_read_engagements" ON engagements;
CREATE POLICY "parties_read_engagements" ON engagements
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id
      FROM projects p
      JOIN company_members cm
        ON cm.company_id = p.developer_id
      WHERE cm.user_id = auth.uid()
        AND cm.deleted_at IS NULL
    )
    OR (
      counterparty_type = 'CAPITAL'
      AND counterparty_id IN (
        SELECT cp.id
        FROM capital_partners cp
        JOIN company_members cm
          ON cm.company_id = cp.company_id
        WHERE cm.user_id = auth.uid()
          AND cm.deleted_at IS NULL
      )
    )
    OR (
      counterparty_type = 'TECHNICAL'
      AND counterparty_id IN (
        SELECT tp.id
        FROM technical_partners tp
        JOIN company_members cm
          ON cm.company_id = tp.company_id
        WHERE cm.user_id = auth.uid()
          AND cm.deleted_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "parties_read_messages" ON messages;
CREATE POLICY "parties_read_messages" ON messages
  FOR SELECT TO authenticated
  USING (
    engagement_id IN (
      SELECT e.id
      FROM engagements e
      WHERE e.project_id IN (
        SELECT p.id
        FROM projects p
        JOIN company_members cm
          ON cm.company_id = p.developer_id
        WHERE cm.user_id = auth.uid()
          AND cm.deleted_at IS NULL
      )
      OR (
        e.counterparty_type = 'CAPITAL'
        AND e.counterparty_id IN (
          SELECT cp.id
          FROM capital_partners cp
          JOIN company_members cm
            ON cm.company_id = cp.company_id
          WHERE cm.user_id = auth.uid()
            AND cm.deleted_at IS NULL
        )
      )
      OR (
        e.counterparty_type = 'TECHNICAL'
        AND e.counterparty_id IN (
          SELECT tp.id
          FROM technical_partners tp
          JOIN company_members cm
            ON cm.company_id = tp.company_id
          WHERE cm.user_id = auth.uid()
            AND cm.deleted_at IS NULL
        )
      )
    )
  );

ALTER TABLE messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;
