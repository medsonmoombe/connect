import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, forbidden, writeAuditLog, handleRouteError, verifyEngagementAccess } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';
import { notifyUsers, notificationBuilders } from '@/lib/notify';
import * as emailTemplates from '@/lib/email-templates';

const MAX_MESSAGE_LENGTH = 4000;
/** A user may send at most this many messages per minute per engagement. */
const MESSAGE_RATE_LIMIT = { prefix: 'msg-send', limit: 30, windowMs: 60_000 };
const ACTIVE_MESSAGE_STATUSES = [
  'INTRO_ACCEPTED',
  'NDA_SIGNED',
  'DUE_DILIGENCE',
  'TERM_SHEET',
  'CONTRACT_SIGNED',
  'CAPITAL_COMMITTED',
];

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const engagementId = searchParams.get('engagement_id');
    const messageId = searchParams.get('id');
    const noSender = searchParams.get('_no_sender') === '1';
    if (!engagementId) return Response.json({ error: 'engagement_id required' }, { status: 400 });

    if (!await verifyEngagementAccess(engagementId, user.company_id, user.is_platform_admin)) return forbidden();

    const selectFields = noSender ? '*' : '*, sender:messages_sender_id_fkey(id, full_name, email, avatar_url)';

    let query = supabase
      .from('messages')
      .select(selectFields)
      .eq('engagement_id', engagementId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (messageId) {
      query = query.eq('id', messageId);
    } else {
      // Pagination: default 100 most recent messages
      const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '100', 10)));
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error } = await query;
      if (error) {
        console.error('[Messages] Query error:', error.message);
        return serverError();
      }
      return Response.json({
        data,
        pagination: { page, pageSize, hasMore: (data?.length ?? 0) === pageSize },
      });
    }

    const { data, error } = await query;

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

    // ── Rate limit: cap messages per user per minute (PRD §12.3) ──────────────
    const rl = await checkRateLimit(user.id ?? engagementId, MESSAGE_RATE_LIMIT);
    if (!rl.allowed) {
      return Response.json(
        { error: 'You are sending messages too quickly. Please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) return Response.json({ error: 'content is required' }, { status: 400 });
    if (content.length > MAX_MESSAGE_LENGTH) {
      return Response.json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` }, { status: 400 });
    }

    const { data: engagementState, error: engagementStateError } = await supabase
      .from('engagements')
      .select('status')
      .eq('id', engagementId)
      .single();

    if (engagementStateError || !engagementState) return serverError();

    // ── Terminal state guard: dropped/closed engagements are read-only ─────────
    const TERMINAL_MESSAGE_STATUSES = ['DROPPED', 'CLOSED'];
    if (!user.is_platform_admin && TERMINAL_MESSAGE_STATUSES.includes(engagementState.status)) {
      return Response.json(
        { error: 'This engagement is closed. Messaging is not available.' },
        { status: 403 }
      );
    }

    // ── Active state guard: messaging only after intro accepted ───────────────
    if (!user.is_platform_admin && !ACTIVE_MESSAGE_STATUSES.includes(engagementState.status)) {
      return Response.json(
        { error: 'Messaging is available after the introduction is accepted and before the engagement is closed.' },
        { status: 403 }
      );
    }

    // ── Org role guard: MEMBERs can read but not send messages ────────────────
    const orgRole = (user as any).org_member_role;
    if (!user.is_platform_admin && orgRole === 'MEMBER') {
      return Response.json(
        { error: 'Only organisation admins can send messages in engagements.' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({ engagement_id: engagementId, message_body: content, sender_id: user.id })
      .select('*, sender:messages_sender_id_fkey(id, full_name, email, avatar_url), engagement:engagements(id, counterparty_id, counterparty_type, project:projects(id, name, developer_id))')
      .single();

    if (error) {
      console.error('[Messages] Insert error:', error.message);
      return serverError();
    }

    await writeAuditLog({ userId: user.id, action: 'MESSAGE_SENT', entityType: 'messages', entityId: data.id, after: { engagement_id: engagementId }, req });

    // Track message sent as interest signal (fire and forget)
    const project_id = (data as any)?.engagement?.project?.id;
    if (project_id) {
      supabase.from('project_interest_signals').insert({
        project_id,
        user_id: user.id,
        signal_type: 'message_sent',
      });
    }

    supabase
      .from('engagements')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', engagementId)
      .then(({ error }) => {
        if (error) console.error('[Messages] Engagement touch error:', error.message);
      });

    // Notify recipients in the OTHER org
    if (data?.engagement) {
      try {
        const eng = data.engagement as any;
        const proj = eng.project as any;
        const actingOrgId = user.company_id;

        // Resolve counterparty company_id
        const partnerTable =
          eng.counterparty_type === 'CAPITAL'        ? 'capital_partners' :
          eng.counterparty_type === 'CONSULTANT'     ? 'consultants' :
          eng.counterparty_type === 'GRANT_PROVIDER' ? 'grant_providers' :
          'technical_partners';
        const { data: partnerRecord } = await supabase
          .from(partnerTable)
          .select('company_id')
          .eq('id', eng.counterparty_id)
          .maybeSingle();

        const counterpartyCompanyId = partnerRecord?.company_id ?? null;
        const otherOrgId = actingOrgId === proj.developer_id ? counterpartyCompanyId : proj.developer_id;

        if (otherOrgId) {
          // Two-step: get member user_ids, then get profiles
          const { data: memberRows } = await supabase
            .from('company_members')
            .select('user_id')
            .eq('company_id', otherOrgId)
            .is('deleted_at', null);

          const memberIds = (memberRows ?? []).map((m: any) => m.user_id).filter(Boolean);

          if (memberIds.length > 0) {
            const { data: profiles } = await supabase
              .from('user_profiles')
              .select('id, full_name, email')
              .in('id', memberIds);

            const emailMap: Record<string, string> = {};
            const userIds: string[] = [];
            for (const p of profiles ?? []) {
              if (p?.id && p?.email) {
                userIds.push(p.id);
                emailMap[p.id] = p.email;
              }
            }

            if (userIds.length > 0) {
              const senderName = user.full_name ?? 'A user';
              const firstName = (profiles?.[0] as any)?.full_name ?? 'there';

              await notifyUsers({
                userIds,
                payload: notificationBuilders.messageReceived({ senderName, engagementId }),
                channel: 'both',
                emailMap,
                emailTemplate: emailTemplates.messageReceivedEmail({
                  senderName,
                  recipientName: firstName,
                  projectName: proj.name ?? 'your project',
                  engagementId,
                }),
                emailLogType: 'message_received',
                emailEntityId: data.id,
              });
            }
          }
        }
      } catch (notifyErr: any) {
        console.error('[Messages] Notify error:', notifyErr.message);
      }
    }

    return Response.json({ data }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
