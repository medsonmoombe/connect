import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, forbidden, writeAuditLog, handleRouteError, getIdempotencyResponse, saveIdempotencyResponse } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { notifyUser, notificationBuilders } from '@/lib/notify';
import * as emailTemplates from '@/lib/email-templates';

const PARTNER_TYPES = ['CAPITAL', 'TECHNICAL'] as const;
const MAX_INTRO_MESSAGE_LENGTH = 1000;
const IDEMPOTENCY_ROUTE = 'POST /api/engagements';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const includeMessages = searchParams.get('include_messages') === 'true';
    const selectFields = includeMessages
      ? '*, project:projects(id, name, location_country, capital_required, developer_id, developer:companies(id, name)), messages(id, message_body, created_at, sender_id)'
      : '*, project:projects(id, name, location_country, capital_required, developer_id, developer:companies(id, name))';

    let query = supabase
      .from('engagements')
      .select(selectFields)
      .order('created_at', { ascending: false });

    if (!user.is_platform_admin) {
      // Developer: see engagements for their projects
      const { data: devProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('developer_id', user.company_id);
      const projectIds = (devProjects ?? []).map((p: any) => p.id);

      // Capital partner: find their capital_partners record
      const { data: capPartner } = await supabase
        .from('capital_partners')
        .select('id')
        .eq('company_id', user.company_id)
        .maybeSingle();

      // Technical partner: find their technical_partners record
      const { data: techPartner } = await supabase
        .from('technical_partners')
        .select('id')
        .eq('company_id', user.company_id)
        .maybeSingle();

      const filters: string[] = [];
      if (projectIds.length > 0) filters.push(`project_id.in.(${projectIds.join(',')})`);
      if (capPartner) filters.push(`counterparty_id.eq.${capPartner.id}`);
      if (techPartner) filters.push(`counterparty_id.eq.${techPartner.id}`);

      if (filters.length > 0) {
        query = query.or(filters.join(','));
      } else {
        return Response.json({ data: [] });
      }
    }

    const projectId = searchParams.get('project_id');
    const counterpartyId = searchParams.get('counterparty_id');
    if (projectId) query = query.eq('project_id', projectId);
    if (counterpartyId) query = query.eq('counterparty_id', counterpartyId);

    const { data, error } = await query;
    if (error) {
      console.error('[Engagements] Query error:', error.message);
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
    const { project_id, counterparty_id, counterparty_type } = body;

    if (!project_id || !counterparty_type) {
      return Response.json({ error: 'project_id and counterparty_type are required' }, { status: 400 });
    }
    if (!PARTNER_TYPES.includes(counterparty_type)) {
      return Response.json({ error: 'Unsupported counterparty_type' }, { status: 400 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, developer_id, status, is_visible_to_investors')
      .eq('id', project_id)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) return Response.json({ error: 'Project not found' }, { status: 404 });
    if (!user.is_platform_admin && (project.status !== 'live' || !project.is_visible_to_investors)) {
      return Response.json({ error: 'Project is not open for engagement' }, { status: 403 });
    }
    if (!user.is_platform_admin && project.developer_id === user.company_id) {
      return Response.json({ error: 'Developers cannot express interest in their own projects' }, { status: 403 });
    }

    const insertData: Record<string, any> = {
      project_id,
      counterparty_type,
      status: 'INTRO_SENT',
    };

    const partnerTable = counterparty_type === 'CAPITAL' ? 'capital_partners' : 'technical_partners';
    let resolvedPartnerId = counterparty_id;

    if (!resolvedPartnerId && !user.is_platform_admin) {
      const { data: ownPartner } = await supabase
        .from(partnerTable)
        .select('id')
        .eq('company_id', user.company_id)
        .maybeSingle();
      resolvedPartnerId = ownPartner?.id;
    }

    if (!resolvedPartnerId) {
      return Response.json({ error: 'A matching partner profile is required before expressing interest' }, { status: 400 });
    }

    const { data: partnerRecord } = await supabase
      .from(partnerTable)
      .select('id, company_id')
      .or(`id.eq.${resolvedPartnerId},company_id.eq.${resolvedPartnerId}`)
      .maybeSingle();

    if (!partnerRecord) return Response.json({ error: 'Partner profile not found' }, { status: 404 });
    if (!user.is_platform_admin && partnerRecord.company_id !== user.company_id) {
      return Response.json({ error: 'You can only express interest from your own organization profile' }, { status: 403 });
    }

    insertData.counterparty_id = partnerRecord.id;

    // Check for duplicate engagement — block if ANY exists for same project + counterparty
    const { data: existing } = await supabase
      .from('engagements')
      .select('id, status')
      .eq('project_id', project_id)
      .eq('counterparty_id', insertData.counterparty_id)
      .maybeSingle();

    if (existing) {
      return Response.json(
        { error: `An engagement already exists for this project and partner (${existing.status}). Cannot create a duplicate.` },
        { status: 409 }
      );
    }

    const { data, error } = await supabase.from('engagements').insert(insertData).select().single();
    if (error) {
      console.error('[Engagements] Insert error:', error.message);
      return serverError();
    }

    await writeAuditLog({ userId: user.id, action: 'ENGAGEMENT_CREATED', entityType: 'engagements', entityId: data.id, after: insertData, req });

    const introMessage = typeof body.message === 'string' ? body.message.trim() : '';
    if (introMessage) {
      if (introMessage.length > MAX_INTRO_MESSAGE_LENGTH) {
        return Response.json({ error: `Intro message must be ${MAX_INTRO_MESSAGE_LENGTH} characters or fewer` }, { status: 400 });
      }
      const { error: messageError } = await supabase.from('messages').insert({
        engagement_id: data.id,
        sender_id: user.id,
        message_body: introMessage,
      });
      if (messageError) console.error('[Engagements] Intro message error:', messageError.message);
    }

    // ── Notify the developer org ──────────────────────────────────────────────
    try {
      const { data: project } = await supabase
        .from('projects')
        .select('name, developer_id')
        .eq('id', project_id)
        .single();

      if (project) {
        // Get acting company name
        const { data: actingCompany } = await supabase
          .from('companies')
          .select('name')
          .eq('id', user.company_id)
          .maybeSingle();

        const partnerName = actingCompany?.name ?? 'A capital partner';

        // Get developer org members (OWNER/ADMIN) — two-step: company_members → user_profiles
        const { data: memberRows } = await supabase
          .from('company_members')
          .select('user_id')
          .eq('company_id', project.developer_id)
          .in('role', ['OWNER', 'ADMIN'])
          .is('deleted_at', null);

        const memberIds = (memberRows ?? []).map((m: any) => m.user_id);

        if (memberIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, full_name, email')
            .in('id', memberIds);

          for (const profile of profiles ?? []) {
            if (!profile?.id) continue;
            await notifyUser({
              userId: profile.id,
              payload: notificationBuilders.expressInterest({
                projectName: project.name,
                partnerName,
                engagementId: data.id,
              }),
              channel: 'both',
              emailTo: profile.email,
              emailTemplate: emailTemplates.expressInterestEmail({
                projectName: project.name,
                partnerName,
                recipientName: profile.full_name ?? 'there',
                engagementUrl: `/dashboard/engagements/${data.id}`,
              }),
              emailLogType: 'engagement_updates',
              emailEntityId: data.id,
            });
          }
        }
      }
    } catch (notifyErr: any) {
      console.error('[Engagements] Notify error:', notifyErr.message);
    }

    return Response.json({ data }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
