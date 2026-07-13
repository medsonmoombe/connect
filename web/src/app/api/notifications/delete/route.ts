import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { deleteNotifications } from '@/lib/notify';

// POST /api/notifications/delete — delete specific notifications
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const { notificationIds } = await req.json();

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return Response.json({ error: 'notificationIds required' }, { status: 400 });
    }

    const result = await deleteNotifications(user.id, notificationIds);
    if (!result.success) return serverError();

    await writeAuditLog({ userId: user.id, action: 'NOTIFICATIONS_DELETED', entityType: 'notifications', entityId: user.id, after: { notificationIds }, req });

    return Response.json({ data: { success: true } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
