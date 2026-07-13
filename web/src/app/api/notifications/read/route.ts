import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { markAsRead } from '@/lib/notify';

// PATCH /api/notifications/read — mark notifications as read
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const { notificationIds } = await req.json();

    const result = await markAsRead(user.id, notificationIds);
    if (!result.success) return serverError();

    await writeAuditLog({ userId: user.id, action: 'NOTIFICATIONS_READ', entityType: 'notifications', entityId: user.id, after: { notificationIds }, req });

    return Response.json({ data: { success: true } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
