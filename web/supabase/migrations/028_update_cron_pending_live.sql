-- Migration 028: Update cron function to use pending_live status
-- The old function checked status = 'live' AND is_visible_to_investors = false
-- The new function checks status = 'pending_live' and transitions to live

CREATE OR REPLACE FUNCTION activate_due_projects()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project     RECORD;
  v_app_url     TEXT := 'https://sawqtppqrslmlwwaaiyy.supabase.co';
  v_service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhd3F0cHBxcnNsbWx3d2FhaXl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzIyMjUxNCwiZXhwIjoyMDk4Nzk4NTE0fQ.DCMnnGzQE98NhO3wjeVrTuipzmtMnd2JR3mnjlQmE8A';
BEGIN

  FOR v_project IN
    SELECT id, name, developer_id
    FROM   projects
    WHERE  status              = 'pending_live'
      AND  scores_visible_at   <= now()
      AND  deleted_at          IS NULL
  LOOP
    -- 1. Transition to live and flip the visibility flag
    UPDATE projects
    SET    status = 'live',
           is_visible_to_investors = true
    WHERE  id = v_project.id;

    -- 2. Write audit log
    INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id, after_state)
    VALUES (
      NULL,
      'CRON_PROJECT_ACTIVATED',
      'projects',
      v_project.id,
      jsonb_build_object('project_id', v_project.id, 'activated_at', now())
    );

    -- 3. Trigger matching engine via HTTP (fire-and-forget)
    PERFORM net.http_post(
      url     := v_app_url || '/api/matching/run',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body    := jsonb_build_object('project_id', v_project.id, '_internal', true)
    );

  END LOOP;
END;
$$;
