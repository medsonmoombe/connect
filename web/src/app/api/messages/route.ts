import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, forbidden, writeAuditLog, handleRouteError, pickFields, verifyEngagementAccess } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { notifyUsers, notificationBuilders } from '@/lib/notify';
import * as emailTemplates from '@/lib/email-templates';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const engagementId = searchParams.get('engagement_id');
    if (!engagementId) return Response.json({ error: 'engagement_id required' }, { status: 400 });

    if (!await verifyEngagementAccess(engagementId, user.company_id, user.is_platform_admin)) return forbidden();

    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:users(*)')
      .eq('engagement_id', engagementId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Messages] Query error:', error.message);
      return serverError();
    }
    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const engagementId = body.engagement_id;
    if (!engagementId) return Response.json({ error: 'engagement_id required' }, { status: 400 });

    if (!await verifyEngagementAccess(engagementId, user.company_id, user.is_platform_admin)) return forbidden();

    const safeFields = pickFields(body, ['engagement_id', 'content']);

    const { data, error } = await supabase
      .from('messages')
      .insert({ ...safeFields, sender_id: user.id })
      .select('*, engagement:engagements(id, counterparty_id, project:projects(id, name, developer_id))')
      .single();

    if (error) {
      console.error('[Messages] Insert error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'MESSAGE_SENT', entityType: 'messages', entityId: data.id, after: { engagement_id: engagementId }, req });

    // Notify recipients in the OTHER org about the new message
    if (data?.engagement) {
      const eng = data.engagement as any;
      const proj = eng.project as any;
      const actingOrgId = user.company_id;
      const counterpartyId = eng.counterparty_id;
      const otherOrgId = actingOrgId === proj.developer_id ? counterpartyId : proj.developer_id;

      if (otherOrgId) {
        // Find all users in the other org who are members
        const { data: memberRows } = await supabase
          .from('company_members')
          .select('user_id, users!inner(id, email, full_name)')
          .eq('company_id', otherOrgId)
          .is('deleted_at', null);

        const emailMap: Record<string, string> = {};
        const userIds: string[] = [];
        for (const m of memberRows ?? []) {
          const u = m.users as any;
          if (u?.id && u?.email) {
            userIds.push(u.id);
            emailMap[u.id] = u.email;
          }
        }

        if (userIds.length > 0) {
          const preview = typeof safeFields.content === 'string' ? safeFields.content : '';
          const payload = notificationBuilders.messageReceived({
            senderName: user.full_name ?? 'A user',
            preview,
          });
          // Use first member's name for the email template (all get same email content)
          const firstName = ((memberRows?.[0] as any)?.users as any)?.full_name ?? 'there';
          const emailT = emailTemplates.messageReceivedEmail({
            senderName: user.full_name ?? 'A user',
            recipientName: firstName,
            preview,
            projectName: proj.name ?? 'your project',
          });
          await notifyUsers({
            userIds,
            payload,
            channel: 'both',
            emailMap,
            emailTemplate: emailT,
            emailLogType: 'message_received',
            emailEntityId: data.id,
          });
        }
      }
    }

    return Response.json({ data }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
