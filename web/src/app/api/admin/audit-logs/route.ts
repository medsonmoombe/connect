import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const NOISE_ACTIONS = [
  'USER_LOGGED_IN',
  'USER_LOGGED_OUT',
  'NOTIFICATIONS_READ',
  'NOTIFICATIONS_DELETED',
  'PROFILE_UPDATED',
  'PASSWORD_FORGOT_REQUESTED',
  'PASSWORD_RESET',
  'ONBOARDING_UPDATE_PROFILE',
  'ONBOARDING_SAVE_PREFERENCES',
  'PARTNER_UPSERTED',
  'PROJECT_VIEW',
  'PROJECT_SCORES_UPDATED',
  'PROJECT_TECH_UPDATED',
  'DOCUMENT_ADDED',
  'MESSAGE_SENT',
];

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = getSupabaseAdmin();
    const { data: logs, error: logsError } = await supabase
      .from('audit_logs')
      .select('*')
      .not('action_type', 'in', `(${NOISE_ACTIONS.join(',')})`)
      .order('timestamp', { ascending: false })
      .limit(30);

    if (logsError) {
      console.error('[AuditLogs] Query error:', logsError.message);
      return serverError();
    }

    const userIds = [...new Set((logs ?? []).map((l: any) => l.user_id).filter(Boolean))];
    let userMap: Record<string, { full_name: string | null; email: string }> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      for (const u of users ?? []) {
        userMap[u.id] = { full_name: u.full_name, email: u.email };
      }
    }

    const data = (logs ?? []).map((log: any) => ({
      ...log,
      user: log.user_id ? userMap[log.user_id] ?? null : null,
    }));

    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
