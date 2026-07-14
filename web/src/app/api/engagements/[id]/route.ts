import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, forbidden, writeAuditLog, handleRouteError, pickFields, verifyEngagementAccess } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { notifyUser, notificationBuilders } from '@/lib/notify';
import * as emailTemplates from '@/lib/email-templates';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    if (!await verifyEngagementAccess(id, user.company_id, user.is_platform_admin)) return forbidden();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('engagements')
      .select('*, project:projects(*), messages(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[Engagements] Query error:', error.message);
      return serverError();
    }
    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    if (!await verifyEngagementAccess(id, user.company_id, user.is_platform_admin)) return forbidden();
    const body = await req.json();
    const supabase = getSupabaseAdmin();
    const safeFields = pickFields(body, ['status']);

    const { data, error } = await supabase
      .from('engagements')
      .update({ ...safeFields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, project:projects(id, name, developer_id)')
      .single();

    if (error) {
      console.error('[Engagements] Update error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'ENGAGEMENT_UPDATED', entityType: 'engagements', entityId: id, after: safeFields, req });

    // Notify the OTHER party about the status change
    if (safeFields.status && data?.project) {
      const proj = data.project as any;
      const counterpartyId = data.counterparty_id as string;
      const statusStr = safeFields.status as string;
      // Determine which org the acting user belongs to
      const actingOrgId = user.company_id;
      // The other party is whoever isn't the acting user's org
      const otherOrgId = actingOrgId === proj.developer_id ? counterpartyId : proj.developer_id;

      if (otherOrgId) {
        const { data: ownerRows } = await supabase
          .from('company_members')
          .select('user_id, users!inner(id, email, full_name)')
          .eq('company_id', otherOrgId)
          .in('role', ['OWNER', 'ADMIN'])
          .is('deleted_at', null)
          .limit(1);

        const owner = ownerRows?.[0] as any;
        if (owner?.users) {
          const u = owner.users;
          const payload = notificationBuilders.engagementUpdate({
            projectName: proj.name,
            newStatus: statusStr,
          });
          const emailT = emailTemplates.engagementUpdateEmail({
            projectName: proj.name,
            newStatus: statusStr,
            recipientName: u.full_name ?? 'there',
          });
          await notifyUser({
            userId: u.id,
            payload,
            channel: 'both',
            emailTo: u.email,
            emailTemplate: emailT,
            emailLogType: 'engagement_updates',
            emailEntityId: id,
          });
        }
      }
    }

    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
