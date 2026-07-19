import { NextRequest } from 'next/server';
import { getAuthenticatedUser, badRequest, forbidden, serverError, handleRouteError, verifyEngagementAccess } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/messages/{engagementId}/read
 *
 * Marks an engagement as read for the authenticated user by upserting their
 * `messages_read.last_read_at` to NOW(). Used to clear unread badges and drive
 * read receipts. Server-mediated (service_role) so enforcement is uniform and
 * the client doesn't need a direct write path through RLS.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: engagementId } = await params;
    if (!user.id) return badRequest('Session missing user id');

    if (!await verifyEngagementAccess(engagementId, user.company_id, user.is_platform_admin)) {
      return forbidden();
    }

    const now = new Date().toISOString();
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('messages_read')
      .upsert(
        { user_id: user.id, engagement_id: engagementId, last_read_at: now, updated_at: now },
        { onConflict: 'user_id,engagement_id' }
      );

    if (error) {
      console.error('[Messages] mark-read error:', error.message);
      return serverError();
    }

    return Response.json({ data: { engagement_id: engagementId, last_read_at: now } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
