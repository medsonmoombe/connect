import { getSupabaseAdmin } from './supabase-server';

let cronEnsured = false;

/**
 * Ensures the pg_cron activation job is scheduled with the interval
 * from CRON_CHECK_INTERVAL_MINUTES env var. Runs once per server process.
 */
export async function ensureActivationCron(): Promise<void> {
  if (cronEnsured) return;

  const intervalMinutes = parseInt(process.env.CRON_CHECK_INTERVAL_MINUTES || '60', 10);
  if (isNaN(intervalMinutes) || intervalMinutes < 1) return;

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.rpc('reschedule_activation_cron', {
      interval_minutes: intervalMinutes,
    });
    if (error) {
      console.error('[Cron] Failed to reschedule activation cron:', error.message);
      return;
    }
    console.log(`[Cron] Activation cron scheduled: every ${intervalMinutes} minutes`);
    cronEnsured = true;
  } catch (e: any) {
    console.error('[Cron] Failed to ensure activation cron:', e.message);
  }
}
