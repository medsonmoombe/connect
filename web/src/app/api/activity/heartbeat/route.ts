import { NextRequest } from 'next/server';
import { getAuthenticatedUser, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * POST /api/activity/heartbeat
 * Lightweight endpoint to update the user's last_active_at timestamp.
 * Called by the frontend periodically or on significant interactions.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();

    await supabase
      .from('user_profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', user.id);

    return Response.json({ ok: true });
  } catch (e: any) {
    // Silently fail — this is fire-and-forget
    return Response.json({ ok: true });
  }
}
