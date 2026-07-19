import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { createNotification, notificationBuilders, notifyUsers } from '@/lib/notify';

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
      .select('id, status, project_id, counterparty_id, project:projects(developer_id)')
      .eq('id', id)
      .single();

    if (fetchErr || !engagement) return badRequest('Engagement not found');

    if (TERMINAL_STATES.includes(engagement.status as TerminalState)) {
      return badRequest('Engagement is already in a terminal state');
    }

    const before = { status: engagement.status };

    const { error } = await admin
      .from('engagements')
      .update({ status, updated_at: new Date().toISOString() })
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

    // Resolve counterparty company_id from the partner record
    let counterpartyCompanyId: string | null = null;
    const counterpartyId = engagement.counterparty_id as string;
    const { data: cpPartner } = await admin
      .from('capital_partners')
      .select('company_id')
      .eq('id', counterpartyId)
      .maybeSingle();
    if (cpPartner) {
      counterpartyCompanyId = cpPartner.company_id;
    } else {
      const { data: tpPartner } = await admin
        .from('technical_partners')
        .select('company_id')
        .eq('id', counterpartyId)
        .maybeSingle();
      counterpartyCompanyId = tpPartner?.company_id ?? null;
    }

    // Notify both org owners (in-app + email)
    const developerId = (engagement.project as any)?.developer_id;
    const orgIds = [developerId, counterpartyCompanyId].filter(Boolean) as string[];
    if (orgIds.length > 0) {
      const { data: members } = await admin
        .from('company_members')
        .select('user_id')
        .is('deleted_at', null)
        .in('company_id', orgIds)
        .eq('role', 'OWNER');

      const userIds = (members ?? []).map(m => m.user_id);
      if (userIds.length > 0) {
        const { data: profiles } = await admin
          .from('user_profiles')
          .select('id, email')
          .in('id', userIds);

        const emailMap: Record<string, string> = {};
        for (const p of profiles ?? []) {
          if (p.email) emailMap[p.id] = p.email;
        }

        const payload = notificationBuilders.systemAnnouncement({
          title: `Engagement ${status.toLowerCase()} by admin`,
          body: `An engagement has been ${status.toLowerCase()} by a platform administrator. Reason: ${reason}`,
        });

        await notifyUsers({
          userIds,
          payload,
          channel: 'both',
          emailMap,
          emailTemplate: {
            subject: `Engagement ${status.toLowerCase()}: platform admin action`,
            html: `<p>An engagement has been <strong>${status.toLowerCase()}</strong> by a platform administrator.</p><p>Reason: ${reason}</p>`,
          },
          emailLogType: 'engagement_admin_override',
          emailEntityId: id,
        });
      }
    }

    return Response.json({ data: { id, status } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
