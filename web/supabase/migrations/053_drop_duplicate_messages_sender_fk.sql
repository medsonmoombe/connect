-- Migration 053: Drop duplicate messages.sender_id FK
--
-- Migration 043 already created messages_sender_id_fkey → user_profiles(id).
-- Migration 044 added a second FK (messages_sender_id_user_profiles_fkey) to the
-- same target, causing PostgREST ambiguity on sender:user_profiles(...) embeds.
--
-- This migration drops the duplicate so only one FK remains.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_sender_id_user_profiles_fkey'
  ) THEN
    ALTER TABLE messages DROP CONSTRAINT messages_sender_id_user_profiles_fkey;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
