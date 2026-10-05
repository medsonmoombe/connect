import { NextRequest } from 'next/server';
import { getAuthenticatedUser, handleRouteError, badRequest } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { DigestFrequency } from '@/types';

/** GET: Fetch the authenticated user's digest preferences */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('matching_digests')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      // Return defaults
      return Response.json({
        data: {
          user_id: user.id,
          frequency: 'weekly',
          last_sent_at: null,
          next_scheduled_at: null,
        },
      });
    }

    return Response.json({ data });
  } catch (e) {
    return handleRouteError(e);
  }
}

/** PATCH: Update digest frequency */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json();
    const frequency = body.frequency as DigestFrequency;

    if (!frequency || !['daily', 'weekly', 'monthly', 'off'].includes(frequency)) {
      return badRequest('frequency must be daily, weekly, monthly, or off');
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // Compute next_scheduled_at based on frequency
    let nextScheduledAt: string | null = null;
    if (frequency !== 'off') {
      const next = new Date();
      if (frequency === 'daily') next.setDate(next.getDate() + 1);
      else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
      else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
      // Schedule for 8:00 AM UTC
      next.setUTCHours(8, 0, 0, 0);
      nextScheduledAt = next.toISOString();
    }

    const { data, error } = await supabase
      .from('matching_digests')
      .upsert({
        user_id: user.id,
        frequency,
        next_scheduled_at: nextScheduledAt,
        updated_at: now,
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('[Digests] Update error:', error.message);
      return badRequest('Failed to update digest preferences');
    }

    return Response.json({ data });
  } catch (e) {
    return handleRouteError(e);
  }
}
