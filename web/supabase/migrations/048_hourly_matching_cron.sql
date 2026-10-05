-- Migration 048: Hourly matching engine cron
-- Runs the matching engine for all live projects every hour so partners
-- don't have to manually trigger matching.
-- Uses pg_net to call the matching API endpoint (same pattern as 031_activate_endpoint_cron).

-- ── 1. Create the cron function ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION run_matching_engine()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count       int := 0;
  v_app_url     TEXT := COALESCE(current_setting('app.settings.app_url', true), 'http://localhost:3001');
  v_service_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
  -- Call the matching run API endpoint which handles full matrix matching
  -- (all live projects × all verified partners) + notifications.
  BEGIN
    PERFORM net.http_post(
      url     := v_app_url || '/api/matching/run',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body    := jsonb_build_object('run_all', true, '_internal', true)::text
    );

    INSERT INTO cron_logs (function_name, message, details)
    VALUES ('run_matching_engine', 'CRON_TRIGGERED', jsonb_build_object(
      'triggered_at', now()
    ));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO cron_logs (function_name, message, details)
    VALUES ('run_matching_engine', 'CRON_ERROR', jsonb_build_object(
      'error', SQLERRM,
      'failed_at', now()
    ));
  END;
END;
$$;

-- ── 2. Schedule the job: every hour ──────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('run-matching-engine');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'run-matching-engine',
  '0 * * * *',  -- Every hour at the top of the hour
  $$ SELECT run_matching_engine(); $$
);

-- ── 3. Function to reschedule with a custom interval (called by the app) ─
CREATE OR REPLACE FUNCTION reschedule_matching_cron(interval_minutes int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_schedule text;
BEGIN
  -- Build cron expression: */N * * * *
  v_schedule := '*/' || interval_minutes || ' * * * *';

  -- Unschedule existing
  BEGIN
    PERFORM cron.unschedule('run-matching-engine');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Schedule with new interval
  PERFORM cron.schedule(
    'run-matching-engine',
    v_schedule,
    $$ SELECT run_matching_engine(); $$
  );

  INSERT INTO cron_logs (function_name, message, details)
  VALUES ('reschedule_matching_cron', 'RESCHEDULED', jsonb_build_object(
    'interval_minutes', interval_minutes,
    'schedule', v_schedule
  ));
END;
$func$;
