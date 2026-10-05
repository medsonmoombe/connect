import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { createNotification, notificationBuilders, notifyUsers } from '@/lib/notify';
import type { EngagementStatus } from '@/types';

type Params = { params: Promise<{ id: string }> };

const TERMINAL_STATES = ['CLOSED', 'DROPPED'] as const;
type TerminalState = typeof TERMINAL_STATES[number];

/**
 * PATCH /api/admin/engagements/[id]
 *
 * Platform admin override for engagements. Supports two modes:
 * 1. Force to CLOSED or DROPPED (terminal states) — for dispute resolution
 * 2. Revive from DROPPED back to any previous valid state
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden('Only platform administrators can manage engagements from the admin panel. Contact your platform support team if you need to make changes.');

    const { id } = await params;
    const { status, reason } = await req.json() as { status: string; reason: string };

    if (!reason?.trim()) return badRequest('A reason is required for engagement overrides');

    const admin = getSupabaseAdmin();

    const { data: engagement, error: fetchErr } = await admin
      .from('engagements')
      .select('id, status, project_id, counterparty_id, project:projects(developer_id)')
      .eq('id', id)
      .single();

    if (fetchErr || !engagement) return badRequest('Engagement not found');

    const currentStatus = engagement.status as EngagementStatus;
    const before = { status: currentStatus };

    // Mode 1: Force to terminal state (CLOSED or DROPPED)
    if ((TERMINAL_STATES as readonly string[]).includes(status)) {
      if (status === currentStatus) {
        return badRequest(`Engagement is already ${status}`);
      }
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
        blocking: true,
      });

      await notifyEngagementParties(admin, engagement, status, reason);
      return Response.json({ data: { id, status } });
    }

    // Mode 2: Revive from DROPPED back to a previous state
    if (currentStatus !== 'DROPPED') {
      return badRequest('Only dropped engagements can be revived. Use CLOSED or DROPPED for other overrides.');
    }

    const validStatuses: EngagementStatus[] = [
      'INTRO_SENT', 'INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE',
      'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED',
    ];

    if (!validStatuses.includes(status as EngagementStatus)) {
      return badRequest(`Invalid revival status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const { error } = await admin
      .from('engagements')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[Admin/Engagements] Revive error:', error.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'ENGAGEMENT_ADMIN_REVIVED',
      entityType: 'engagements',
      entityId: id,
      before,
      after: { status, reason },
      req,
      blocking: true,
    });

    await notifyEngagementParties(admin, engagement, status, reason, true);
    return Response.json({ data: { id, status } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

async function notifyEngagementParties(
  admin: ReturnType<typeof getSupabaseAdmin>,
  engagement: any,
  status: string,
  reason: string,
  revived = false,
) {
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

  const developerId = (engagement.project as any)?.developer_id;
  const orgIds = [developerId, counterpartyCompanyId].filter(Boolean) as string[];
  if (orgIds.length === 0) return;

  const { data: members } = await admin
    .from('company_members')
    .select('user_id')
    .is('deleted_at', null)
    .in('company_id', orgIds)
    .eq('role', 'OWNER');

  const userIds = (members ?? []).map(m => m.user_id);
  if (userIds.length === 0) return;

  const { data: profiles } = await admin
    .from('user_profiles')
    .select('id, email')
    .in('id', userIds);

  const emailMap: Record<string, string> = {};
  for (const p of profiles ?? []) {
    if (p.email) emailMap[p.id] = p.email;
  }

  const label = revived ? 'revived' : `${status.toLowerCase()}`;
  const payload = notificationBuilders.systemAnnouncement({
    title: `Engagement ${label} by admin`,
    body: `An engagement has been ${label} by a platform administrator. Reason: ${reason}`,
  });

  await notifyUsers({
    userIds,
    payload,
    channel: 'both',
    emailMap,
    emailTemplate: {
      subject: `Engagement ${label}: platform admin action`,
      html: `<p>An engagement has been <strong>${label}</strong> by a platform administrator.</p><p>Reason: ${reason}</p>`,
    },
    emailLogType: 'engagement_admin_override',
    emailEntityId: engagement.id,
  });
}
