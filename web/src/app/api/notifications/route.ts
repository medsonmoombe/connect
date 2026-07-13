import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, handleRouteError } from '@/lib/api-helpers';
import { getNotifications, getUnreadCount } from '@/lib/notify';

// GET /api/notifications — fetch current user's notifications
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const [notifications, unreadCount] = await Promise.all([
      getNotifications(user.id, limit, offset),
      getUnreadCount(user.id),
    ]);

    return Response.json({ data: notifications, unreadCount });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
