-- Migration 044: Repoint messages.sender_id FK to user_profiles(id)
--
-- Background:
--   Migration 043 changed messages.sender_id from TEXT to UUID and added a FK
--   to auth.users(id). PostgREST embeds only follow FK direction from the
--   source table, so `sender:user_profiles(...)` on messages can never resolve
--   via auth.users because user_profiles.id -> auth.users, not the reverse.
--
-- This migration:
--   1. Drops the auth.users FK if present.
--   2. Adds a FK from messages.sender_id -> user_profiles(id).
--   3. Refreshes the PostgREST schema cache so the embed resolves immediately.
--
-- Safe to re-run; all actions are idempotent.

-- 1. Drop auth.users FK from messages.sender_id if it exists.
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
     AND refcls.relname = 'auth_users';
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE messages DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

-- 2. Add FK to user_profiles(id) so PostgREST can resolve sender:user_profiles(...)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
   WHERE cls.relname = 'messages' AND con.conname = 'messages_sender_id_user_profiles_fkey'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_sender_id_user_profiles_fkey
      FOREIGN KEY (sender_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Refresh PostgREST schema cache so the embed resolves immediately.
NOTIFY pgrst, 'reload schema';
