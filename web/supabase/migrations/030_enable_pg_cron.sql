-- Migration 030: Re-enable pg_cron + schedule job properly
-- Previous migrations may have failed silently. This ensures extensions exist and job is scheduled.

-- 1. Ensure extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Ensure the function exists (in case migration 028 was applied but 024 wasn't)
CREATE OR REPLACE FUNCTION activate_due_projects()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project     RECORD;
  v_count       int := 0;
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
    v_count := v_count + 1;

    UPDATE projects
    SET    status = 'live',
           is_visible_to_investors = true
    WHERE  id = v_project.id;

    INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id, after_state)
    VALUES (
      NULL,
      'CRON_PROJECT_ACTIVATED',
      'projects',
      v_project.id,
      jsonb_build_object('project_id', v_project.id, 'activated_at', now())
    );

    BEGIN
      PERFORM net.http_post(
        url     := v_app_url || '/api/matching/run',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body    := jsonb_build_object('project_id', v_project.id, '_internal', true)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- matching trigger failed, don't block activation
    END;
  END LOOP;

  INSERT INTO cron_logs (function_name, message, details)
  VALUES ('activate_due_projects', 'CRON_COMPLETED', jsonb_build_object(
    'activated_count', v_count,
    'completed_at', now()
  ));
END;
$$;

-- 3. Remove any existing job with this name
DO $$
BEGIN
  PERFORM cron.unschedule('activate-due-projects');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- 4. Schedule the job: every hour on the hour
SELECT cron.schedule(
  'activate-due-projects',
  '0 * * * *',
  $$ SELECT activate_due_projects(); $$
);

-- 5. Function to reschedule the cron with a custom interval (called by the app)
CREATE OR REPLACE FUNCTION reschedule_activation_cron(interval_minutes int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_schedule text;
BEGIN
  -- Build cron expression: */N * * * *
  v_schedule := '*/' || interval_minutes || ' * * * *';

  -- Remove existing job
  BEGIN
    PERFORM cron.unschedule('activate-due-projects');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Schedule with new interval
  PERFORM cron.schedule(
    'activate-due-projects',
    v_schedule,
    'SELECT activate_due_projects()'
  );

  INSERT INTO cron_logs (function_name, message, details)
  VALUES ('reschedule_activation_cron', 'RESCHEDULED', jsonb_build_object(
    'interval_minutes', interval_minutes,
    'schedule', v_schedule
  ));
END;
$$;
