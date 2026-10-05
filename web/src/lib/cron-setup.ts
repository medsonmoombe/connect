import { getSupabaseAdmin } from './supabase-server';

let cronEnsured = false;

/**
 * Ensures the pg_cron activation and matching jobs are scheduled with the interval
 * from CRON_CHECK_INTERVAL_MINUTES env var. Runs once per server process.
 */
export async function ensureActivationCron(): Promise<void> {
  if (cronEnsured) return;

  const intervalMinutes = parseInt(process.env.CRON_CHECK_INTERVAL_MINUTES || '60', 10);
  if (isNaN(intervalMinutes) || intervalMinutes < 1) return;

  try {
    const supabase = getSupabaseAdmin();

    // Schedule activation cron (moves pending_live → live projects)
    try {
      const { error } = await supabase.rpc('reschedule_activation_cron', {
        interval_minutes: intervalMinutes,
      });
      if (error) console.error('[Cron] Failed to reschedule activation cron:', error.message);
    } catch (e: any) {
      console.error('[Cron] Failed to reschedule activation cron:', e.message);
    }

    // Schedule matching engine cron (runs matching for all live projects × verified partners)
    try {
      const { error } = await supabase.rpc('reschedule_matching_cron', {
        interval_minutes: intervalMinutes,
      });
      if (error) console.error('[Cron] Failed to reschedule matching cron:', error.message);
    } catch (e: any) {
      console.error('[Cron] Failed to reschedule matching cron:', e.message);
    }

    console.log(`[Cron] Jobs scheduled: every ${intervalMinutes} minutes`);
    cronEnsured = true;
  } catch (e: any) {
    console.error('[Cron] Failed to ensure cron jobs:', e.message);
  }
}
