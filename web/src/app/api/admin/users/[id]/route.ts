import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { createNotification, notificationBuilders } from '@/lib/notify';

type Params = { params: Promise<{ id: string }> };

// ── PATCH /api/admin/users/[id]
// action: 'suspend'    — suspend a user (blocks login via suspended_at check)
// action: 'reactivate' — lift suspension
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const { id } = await params;
    const { action, reason } = await req.json();

    if (!['suspend', 'reactivate'].includes(action)) {
      return badRequest('action must be suspend or reactivate');
    }

    // Cannot suspend yourself
    if (id === user.id) return badRequest('You cannot suspend your own account');

    const admin = getSupabaseAdmin();

    const update =
      action === 'suspend'
        ? { suspended_at: new Date().toISOString(), suspended_by: user.id, suspension_reason: reason ?? null }
        : { suspended_at: null, suspended_by: null, suspension_reason: null };

    const { error } = await admin
      .from('user_profiles')
      .update(update)
      .eq('id', id);

    if (error) {
      console.error('[Admin/Users] Suspend error:', error.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: action === 'suspend' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      entityType: 'user_profiles',
      entityId: id,
      after: update,
      req,
    });

    if (action === 'suspend') {
      await createNotification({
        userId: id,
        payload: notificationBuilders.systemAnnouncement({
          title: 'Account suspended',
          body: reason
            ? `Your account has been suspended. Reason: ${reason}`
            : 'Your account has been suspended. Please contact support.',
        }),
      });
    } else {
      await createNotification({
        userId: id,
        payload: notificationBuilders.systemAnnouncement({
          title: 'Account reactivated',
          body: 'Your account has been reactivated. You now have full platform access.',
        }),
      });
    }

    return Response.json({ success: true, action });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
