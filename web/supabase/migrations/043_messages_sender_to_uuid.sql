-- Migration 043: Fix messages↔user_profiles relationship (schema cache error)
--
-- PostgreSQL blocks ALTER COLUMN TYPE when ANY policy references the column.
-- We must DROP the policies first, alter the columns, then recreate them.
-- The recreated policies match the canonical definitions from migration 047.

-- 0. Drop ALL policies on messages that reference sender_id or deleted_by.
DROP POLICY IF EXISTS messages_select ON messages;
DROP POLICY IF EXISTS messages_insert ON messages;
DROP POLICY IF EXISTS messages_update ON messages;
DROP POLICY IF EXISTS messages_delete ON messages;
-- Also drop any policy with a different naming convention
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT polname
    FROM pg_policy
    WHERE polrelid = 'messages'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON messages', pol.polname);
  END LOOP;
END $$;

-- 1. Drop the old auto-named FK on messages.sender_id -> users(id).
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT con.conname
    INTO fk_name
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_class refcls ON refcls.oid = con.confrelid
    WHERE cls.relname = 'messages'
      AND con.conkey = ARRAY[(
        SELECT attnum FROM pg_attribute
        WHERE attrelid = con.conrelid AND attname = 'sender_id'
      )]
      AND refcls.relname = 'users';
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE messages DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

-- 2. Drop the supporting index before the column type changes.
DROP INDEX IF EXISTS idx_messages_sender_id;

-- 3. Cast sender_id to UUID. Guard against non-UUID legacy values.
UPDATE messages
   SET sender_id = NULL
 WHERE sender_id IS NOT NULL
   AND sender_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

ALTER TABLE messages
  ALTER COLUMN sender_id DROP NOT NULL,
  ALTER COLUMN sender_id TYPE UUID USING sender_id::uuid;

-- 3b. Orphan cleanup BEFORE adding the FK.
DELETE FROM messages
 WHERE sender_id IS NOT NULL
   AND sender_id NOT IN (SELECT id FROM user_profiles);

ALTER TABLE messages
  ALTER COLUMN sender_id SET NOT NULL;

-- 4. Add the FK to user_profiles.
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT con.conname
    INTO fk_name
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_attribute a
      ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE cls.relname = 'messages' AND con.contype = 'f' AND a.attname = 'sender_id';
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE messages DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE messages
  ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

-- 5. Same treatment for messages.deleted_by.
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT con.conname
    INTO fk_name
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_attribute a
      ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE cls.relname = 'messages' AND con.contype = 'f' AND a.attname = 'deleted_by';
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE messages DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

UPDATE messages
   SET deleted_by = NULL
 WHERE deleted_by IS NOT NULL
   AND deleted_by::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

ALTER TABLE messages
  ALTER COLUMN deleted_by TYPE UUID USING deleted_by::uuid;

ALTER TABLE messages
  ADD CONSTRAINT messages_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES user_profiles(id) ON DELETE SET NULL;

-- 6. Recreate the sender lookup index (now over UUID).
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages (sender_id);

-- 7. Recreate RLS policies. Matches the canonical policies from migration 047:
--    - Join through engagements → projects to check developer_id
--    - Use helper functions is_platform_admin() and user_org_id()
CREATE POLICY messages_select ON messages
  FOR SELECT USING (
    public.is_platform_admin()
    OR sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.engagements e
      JOIN public.projects p ON p.id = e.project_id
      WHERE e.id = messages.engagement_id
        AND (
          p.developer_id = public.user_org_id()
          OR EXISTS (
            SELECT 1 FROM public.capital_partners cp
            WHERE cp.id = e.counterparty_id AND cp.company_id = public.user_org_id()
          )
          OR EXISTS (
            SELECT 1 FROM public.technical_partners tp
            WHERE tp.id = e.counterparty_id AND tp.company_id = public.user_org_id()
          )
        )
    )
  );

CREATE POLICY messages_insert ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.engagements e
      JOIN public.projects p ON p.id = e.project_id
      WHERE e.id = messages.engagement_id
        AND (
          p.developer_id = public.user_org_id()
          OR EXISTS (
            SELECT 1 FROM public.capital_partners cp
            WHERE cp.id = e.counterparty_id AND cp.company_id = public.user_org_id()
          )
          OR EXISTS (
            SELECT 1 FROM public.technical_partners tp
            WHERE tp.id = e.counterparty_id AND tp.company_id = public.user_org_id()
          )
        )
    )
  );

-- 8. Refresh the PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
