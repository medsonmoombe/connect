-- Migration 029: Add cron_logs table + logging to activate_due_projects
-- This lets us see exactly when the cron fires, what it finds, and any errors

-- 1. Create cron_logs table
CREATE TABLE IF NOT EXISTS cron_logs (
  id          bigserial PRIMARY KEY,
  run_at      timestamptz DEFAULT now(),
  function_name text,
  message     text,
  details     jsonb
);

-- 2. Update the cron function with full logging
CREATE OR REPLACE FUNCTION activate_due_projects()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project       RECORD;
  v_count         int := 0;
  v_found         int := 0;
  v_app_url       TEXT := 'https://sawqtppqrslmlwwaaiyy.supabase.co';
  v_service_key   TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhd3F0cHBxcnNsbWx3d2FhaXl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzIyMjUxNCwiZXhwIjoyMDk4Nzk4NTE0fQ.DCMnnGzQE98NhO3wjeVrTuipzmtMnd2JR3mnjlQmE8A';
BEGIN
  -- Log: cron started
  INSERT INTO cron_logs (function_name, message, details)
  VALUES ('activate_due_projects', 'CRON_STARTED', jsonb_build_object(
    'checked_at', now()
  ));

  -- Log: how many candidates exist
  SELECT count(*) INTO v_found
  FROM projects
  WHERE status = 'pending_live'
    AND scores_visible_at <= now()
    AND deleted_at IS NULL;

  INSERT INTO cron_logs (function_name, message, details)
  VALUES ('activate_due_projects', 'CANDIDATES_FOUND', jsonb_build_object(
    'count', v_found,
    'checked_at', now()
  ));

  IF v_found = 0 THEN
    INSERT INTO cron_logs (function_name, message, details)
    VALUES ('activate_due_projects', 'NO_CANDIDATES', jsonb_build_object(
      'reason', 'No projects with status=pending_live AND scores_visible_at <= now()',
      'checked_at', now()
    ));
    RETURN;
  END IF;

  FOR v_project IN
    SELECT id, name, developer_id, scores_visible_at
    FROM   projects
    WHERE  status              = 'pending_live'
      AND  scores_visible_at   <= now()
      AND  deleted_at          IS NULL
  LOOP
    v_count := v_count + 1;

    -- Log: activating this project
    INSERT INTO cron_logs (function_name, message, details)
    VALUES ('activate_due_projects', 'ACTIVATING_PROJECT', jsonb_build_object(
      'project_id', v_project.id,
      'project_name', v_project.name,
      'scores_visible_at', v_project.scores_visible_at,
      'now', now()
    ));

    -- 1. Transition to live
    UPDATE projects
    SET    status = 'live',
           is_visible_to_investors = true
    WHERE  id = v_project.id;

    -- Log: update done
    INSERT INTO cron_logs (function_name, message, details)
    VALUES ('activate_due_projects', 'STATUS_UPDATED', jsonb_build_object(
      'project_id', v_project.id,
      'new_status', 'live',
      'is_visible', true
    ));

    -- 2. Write audit log
    INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id, after_state)
    VALUES (
      NULL,
      'CRON_PROJECT_ACTIVATED',
      'projects',
      v_project.id,
      jsonb_build_object('project_id', v_project.id, 'activated_at', now())
    );

    -- 3. Trigger matching (fire-and-forget, don't fail if unreachable)
    BEGIN
      PERFORM net.http_post(
        url     := v_app_url || '/api/matching/run',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body    := jsonb_build_object('project_id', v_project.id, '_internal', true)
      );

      INSERT INTO cron_logs (function_name, message, details)
      VALUES ('activate_due_projects', 'MATCHING_TRIGGERED', jsonb_build_object(
        'project_id', v_project.id,
        'url', v_app_url || '/api/matching/run'
      ));
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO cron_logs (function_name, message, details)
      VALUES ('activate_due_projects', 'MATCHING_TRIGGER_FAILED', jsonb_build_object(
        'project_id', v_project.id,
        'error', SQLERRM
      ));
    END;

  END LOOP;

  -- Log: summary
  INSERT INTO cron_logs (function_name, message, details)
  VALUES ('activate_due_projects', 'CRON_COMPLETED', jsonb_build_object(
    'activated_count', v_count,
    'completed_at', now()
  ));
END;
$$;
