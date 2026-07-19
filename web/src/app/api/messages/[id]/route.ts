import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, badRequest, serverError, handleRouteError, verifyEngagementAccess } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

/** PRD §11.1 — users may delete their OWN messages within a 5-minute window. */
const SELF_DELETE_WINDOW_MS = 5 * 60_000;

/**
 * DELETE /api/messages/{id}
 *
 * Soft-deletes a message. Enforced rules:
 *   1. Caller is authenticated and is a participant of the message's engagement
 *      (or is a platform admin).
 *   2. Caller is the sender of the message.
 *   3. The message was created within the SELF_DELETE_WINDOW_MS window.
 *
 * The soft-delete sets `deleted_at` and `deleted_by`, and blanks the body so the
 * content is no longer retrievable (audit integrity: the row is retained with a
 * tombstone). Realtime subscribers see the row drop out of the live query
 * (messages GET filters `deleted_at IS NULL`).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: messageId } = await params;
    const admin = getSupabaseAdmin();

    const { data: message, error } = await admin
      .from('messages')
      .select('id, sender_id, engagement_id, created_at, deleted_at')
      .eq('id', messageId)
      .maybeSingle();

    if (error) {
      console.error('[Messages] Lookup error:', error.message);
      return serverError();
    }
    if (!message) return badRequest('Message not found');
    if (message.deleted_at) return badRequest('Message has already been deleted');

    // Engagement-participant gate (also implicitly covers access to this message).
    if (!await verifyEngagementAccess(message.engagement_id, user.company_id, user.is_platform_admin)) {
      return forbidden();
    }

    // Ownership — only the sender may delete their own message.
    if (!user.is_platform_admin && message.sender_id !== user.id) {
      return forbidden();
    }

    // Time window — the 5-minute self-delete right. Admins override.
    if (!user.is_platform_admin) {
      const ageMs = Date.now() - new Date(message.created_at).getTime();
      if (ageMs > SELF_DELETE_WINDOW_MS) {
        return Response.json(
          { error: 'Messages can only be deleted within 5 minutes of sending.' },
          { status: 403 }
        );
      }
    }

    const { error: updateError } = await admin
      .from('messages')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id ?? null,
        message_body: 'This message was deleted.',
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('[Messages] Soft-delete error:', updateError.message);
      return serverError();
    }

    return Response.json({ data: { id: messageId, deleted: true } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
