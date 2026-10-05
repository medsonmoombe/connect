import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { createNotification, notificationBuilders } from '@/lib/notify';
import { unlockAccount } from '@/lib/lockout';

type Params = { params: Promise<{ id: string }> };

// ── PATCH /api/admin/users/[id]
// action: 'suspend'    — suspend a user (blocks login via suspended_at check)
// action: 'reactivate' — lift suspension
// action: 'unlock'     — unlock a locked account (too many failed logins)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const { id } = await params;
    const body = await req.json();
    const { action, reason } = body;

    if (!['suspend', 'reactivate', 'unlock', 'toggle_mfa'].includes(action)) {
      return badRequest('action must be suspend, reactivate, unlock, or toggle_mfa');
    }

    // Cannot suspend yourself
    if (id === user.id && action === 'suspend') return badRequest('You cannot suspend your own account');

    const admin = getSupabaseAdmin();

    if (action === 'toggle_mfa') {
      const { mfa_enabled } = body;

      // Fetch current state for audit before update
      const { data: currentProfile } = await admin
        .from('user_profiles')
        .select('mfa_enabled')
        .eq('id', id)
        .single();

      const { error } = await admin
        .from('user_profiles')
        .update({ mfa_enabled: !!mfa_enabled })
        .eq('id', id);

      if (error) {
        console.error('[Admin/Users] MFA toggle error:', error.message);
        return serverError();
      }

      await writeAuditLog({
        userId: user.id,
        action: mfa_enabled ? 'USER_MFA_ENABLED' : 'USER_MFA_DISABLED',
        entityType: 'user_profiles',
        entityId: id,
        before: { mfa_enabled: currentProfile?.mfa_enabled ?? null },
        after: { mfa_enabled: !!mfa_enabled },
        req,
        blocking: true,
      });

      return Response.json({ success: true, action: 'toggle_mfa', mfa_enabled: !!mfa_enabled });
    }

    if (action === 'unlock') {
      await unlockAccount(id, user.id);

      await writeAuditLog({
        userId: user.id,
        action: 'USER_UNLOCKED',
        entityType: 'user_profiles',
        entityId: id,
        req,
        blocking: true,
      });

      await createNotification({
        userId: id,
        payload: notificationBuilders.systemAnnouncement({
          title: 'Account unlocked',
          body: 'Your account has been unlocked by an administrator. You can now log in.',
        }),
      });

      return Response.json({ success: true, action: 'unlock' });
    }

    const update =
      action === 'suspend'
        ? { suspended_at: new Date().toISOString(), suspended_by: user.id, suspension_reason: reason ?? null }
        : { suspended_at: null, suspended_by: null, suspension_reason: null };

    // Fetch current state for audit before update
    const { data: currentProfile } = await admin
      .from('user_profiles')
      .select('suspended_at')
      .eq('id', id)
      .single();

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
      before: { suspended_at: currentProfile?.suspended_at ?? null },
      after: update,
      req,
      blocking: true,
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
