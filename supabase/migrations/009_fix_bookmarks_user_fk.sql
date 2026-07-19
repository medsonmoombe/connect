-- Fix project_bookmarks.user_id to reference auth.users (Supabase auth UUIDs)
-- instead of the legacy users table (Firebase TEXT ids).

ALTER TABLE project_bookmarks DROP CONSTRAINT IF EXISTS project_bookmarks_user_id_fkey;

-- Cast existing TEXT values to UUID (will fail if any non-UUID values exist — safe on fresh data)
ALTER TABLE project_bookmarks
  ALTER COLUMN user_id TYPE UUID USING user_id::UUID;

ALTER TABLE project_bookmarks
  ADD CONSTRAINT project_bookmarks_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
