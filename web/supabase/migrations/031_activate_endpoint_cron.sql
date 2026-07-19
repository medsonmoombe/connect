-- Migration 031: Update cron to call the activate API endpoint (handles status + notifications)

CREATE OR REPLACE FUNCTION activate_due_projects()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project     RECORD;
  v_count       int := 0;
  v_app_url     TEXT := COALESCE(current_setting('app.settings.app_url', true), 'http://localhost:3001');
  v_service_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
  FOR v_project IN
    SELECT id, name
    FROM   projects
    WHERE  status              = 'pending_live'
      AND  scores_visible_at   <= now()
      AND  deleted_at          IS NULL
  LOOP
    v_count := v_count + 1;

    -- Call the activate endpoint which handles status update + notifications
    BEGIN
      PERFORM net.http_post(
        url     := v_app_url || '/api/projects/' || v_project.id || '/activate',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body    := '{}'
      );
    EXCEPTION WHEN OTHERS THEN
      -- If the API call fails, fall back to direct update (no notifications)
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
        jsonb_build_object('project_id', v_project.id, 'activated_at', now(), 'fallback', true)
      );
    END;
  END LOOP;

  INSERT INTO cron_logs (function_name, message, details)
  VALUES ('activate_due_projects', 'CRON_COMPLETED', jsonb_build_object(
    'activated_count', v_count,
    'completed_at', now()
  ));
END;
$$;

-- Reschedule with the new function
DO $$
BEGIN
  PERFORM cron.unschedule('activate-due-projects');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'activate-due-projects',
  '*/3 * * * *',
  $$ SELECT activate_due_projects(); $$
);
