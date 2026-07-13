import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { createNotification, notificationBuilders } from '@/lib/notify';

type Params = { params: Promise<{ id: string }> };

const TERMINAL_STATES = ['CLOSED', 'DROPPED'] as const;
type TerminalState = typeof TERMINAL_STATES[number];

// ── PATCH /api/admin/engagements/[id]
// Forces an engagement to CLOSED or DROPPED with a mandatory reason
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const { id } = await params;
    const { status, reason } = await req.json() as { status: TerminalState; reason: string };

    if (!TERMINAL_STATES.includes(status)) {
      return badRequest('status must be CLOSED or DROPPED');
    }
    if (!reason?.trim()) return badRequest('A reason is required for engagement overrides');

    const admin = getSupabaseAdmin();

    const { data: engagement, error: fetchErr } = await admin
      .from('engagements')
      .select('id, status, project_id, developer_org_id, partner_org_id')
      .eq('id', id)
      .single();

    if (fetchErr || !engagement) return badRequest('Engagement not found');

    if (TERMINAL_STATES.includes(engagement.status as TerminalState)) {
      return badRequest('Engagement is already in a terminal state');
    }

    const before = { status: engagement.status };

    const { error } = await admin
      .from('engagements')
      .update({ status, admin_override_reason: reason, admin_override_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[Admin/Engagements] Override error:', error.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'ENGAGEMENT_ADMIN_OVERRIDE',
      entityType: 'engagements',
      entityId: id,
      before,
      after: { status, reason },
      req,
    });

    // Notify both org owners
    const orgIds = [engagement.developer_org_id, engagement.partner_org_id].filter(Boolean);
    if (orgIds.length > 0) {
      const { data: members } = await admin
        .from('company_members')
        .select('user_id')
        .is('deleted_at', null)
        .in('company_id', orgIds)
        .eq('role', 'OWNER');

      for (const m of members ?? []) {
        await createNotification({
          userId: m.user_id,
          payload: notificationBuilders.systemAnnouncement({
            title: `Engagement ${status.toLowerCase()} by admin`,
            body: `An engagement has been ${status.toLowerCase()} by a platform administrator. Reason: ${reason}`,
          }),
        });
      }
    }

    return Response.json({ data: { id, status } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
