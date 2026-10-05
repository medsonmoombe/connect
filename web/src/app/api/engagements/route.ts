import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, forbidden, writeAuditLog, handleRouteError, getIdempotencyResponse, saveIdempotencyResponse } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { notifyUser, notificationBuilders } from '@/lib/notify';
import * as emailTemplates from '@/lib/email-templates';

const PARTNER_TYPES = ['CAPITAL', 'TECHNICAL', 'CONSULTANT', 'GRANT_PROVIDER', 'POWER_TRADER'] as const;
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

      // Capital partner: find ALL their capital_partners records (a company may have multiple)
      const { data: capPartners } = await supabase
        .from('capital_partners')
        .select('id')
        .eq('company_id', user.company_id);

      // Technical partner: find ALL their technical_partners records
      const { data: techPartners } = await supabase
        .from('technical_partners')
        .select('id')
        .eq('company_id', user.company_id);

      // Consultant: find ALL their consultant records
      const { data: consultantPartners } = await supabase
        .from('consultants')
        .select('id')
        .eq('company_id', user.company_id);

      // Grant provider: find ALL their grant_provider records
      const { data: grantPartners } = await supabase
        .from('grant_providers')
        .select('id')
        .eq('company_id', user.company_id);

      // Power trader: find ALL their power_traders records
      const { data: traderPartners } = await supabase
        .from('power_traders')
        .select('id')
        .eq('company_id', user.company_id);

      const capPartnerIds = (capPartners ?? []).map((cp: any) => cp.id);
      const techPartnerIds = (techPartners ?? []).map((tp: any) => tp.id);
      const consultantIds = (consultantPartners ?? []).map((cp: any) => cp.id);
      const grantIds = (grantPartners ?? []).map((gp: any) => gp.id);
      const traderIds = (traderPartners ?? []).map((tp: any) => tp.id);

      const filters: string[] = [];
      if (projectIds.length > 0) filters.push(`project_id.in.(${projectIds.join(',')})`);
      if (capPartnerIds.length > 0) filters.push(`counterparty_id.in.(${capPartnerIds.join(',')})`);
      if (techPartnerIds.length > 0) filters.push(`counterparty_id.in.(${techPartnerIds.join(',')})`);
      if (consultantIds.length > 0) filters.push(`counterparty_id.in.(${consultantIds.join(',')})`);
      if (grantIds.length > 0) filters.push(`counterparty_id.in.(${grantIds.join(',')})`);
      if (traderIds.length > 0) filters.push(`counterparty_id.in.(${traderIds.join(',')})`);

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

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.range(from, to);

    const { data, error } = await query;
    if (error) {
      console.error('[Engagements] Query error:', error.message);
      return serverError();
    }
    return Response.json({
      data,
      pagination: {
        page,
        pageSize,
        hasMore: (data?.length ?? 0) === pageSize,
      },
    });
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

    const isDeveloperRequest = body.request_origin === 'developer' && project.developer_id === user.company_id;

    if (!user.is_platform_admin && !isDeveloperRequest && (project.status !== 'live' || !project.is_visible_to_investors)) {
      return Response.json({ error: 'Project is not open for engagement' }, { status: 403 });
    }
    if (!user.is_platform_admin && project.developer_id === user.company_id && !isDeveloperRequest) {
      return Response.json({ error: 'Developers cannot express interest in their own projects' }, { status: 403 });
    }
    if (isDeveloperRequest && !counterparty_id) {
      return Response.json({ error: 'Select a partner before sending a request' }, { status: 400 });
    }

    const insertData: Record<string, any> = {
      project_id,
      counterparty_type,
      status: 'INTRO_SENT',
      // Direction of the intro request — drives who must accept it (see
      // migration 073). Dropped gracefully below if the column doesn't exist
      // yet (pre-migration database).
      intro_origin: isDeveloperRequest ? 'developer' : 'partner',
    };

    const partnerTable = counterparty_type === 'CAPITAL' ? 'capital_partners'
      : counterparty_type === 'CONSULTANT' ? 'consultants'
      : counterparty_type === 'GRANT_PROVIDER' ? 'grant_providers'
      : counterparty_type === 'POWER_TRADER' ? 'power_traders'
      : 'technical_partners';
    let resolvedPartnerId = counterparty_id;

    if (!resolvedPartnerId && !user.is_platform_admin) {
      // Fetch ALL partner profiles for this company (may have multiple)
      const { data: ownPartners } = await supabase
        .from(partnerTable)
        .select('id')
        .eq('company_id', user.company_id);

      const partnerIds = (ownPartners ?? []).map((p: any) => p.id);
      if (partnerIds.length > 0) {
        resolvedPartnerId = partnerIds[0];
      }
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
    if (!user.is_platform_admin && !isDeveloperRequest && partnerRecord.company_id !== user.company_id) {
      return Response.json({ error: 'You can only express interest from your own organization profile' }, { status: 403 });
    }

    insertData.counterparty_id = partnerRecord.id;

    // ── Duplicate engagement check ───────────────────────────────────────────
    // Allow creating a new engagement if the previous one was DROPPED.
    // Also check at the org level (company_id) to prevent same org using
    // different partner profiles to bypass the limit.
    const { data: existing } = await supabase
      .from('engagements')
      .select('id, status')
      .eq('project_id', project_id)
      .eq('counterparty_id', insertData.counterparty_id)
      .maybeSingle();

    if (existing && existing.status !== 'DROPPED') {
      return Response.json(
        {
          error: `An active engagement already exists for this project and partner (${existing.status}).`,
          code: 'DUPLICATE_ENGAGEMENT',
          existing_id: existing.id,
          existing_status: existing.status,
        },
        { status: 409 }
      );
    }

    // Also check by company_id to catch same-org duplicates via different profiles
    if (partnerRecord.company_id) {
      // Look up all partner profiles for this company
      const { data: orgPartners } = await supabase
        .from(partnerTable)
        .select('id')
        .eq('company_id', partnerRecord.company_id);

      const partnerIds = (orgPartners ?? []).map((p: any) => p.id);
      if (partnerIds.length > 1) {
        const { data: orgEngagement } = await supabase
          .from('engagements')
          .select('id, status')
          .eq('project_id', project_id)
          .in('counterparty_id', partnerIds)
          .maybeSingle();

        if (orgEngagement && orgEngagement.status !== 'DROPPED') {
          return Response.json(
            {
              error: 'Your organisation already has an active engagement for this project.',
              code: 'DUPLICATE_ENGAGEMENT',
              existing_id: orgEngagement.id,
              existing_status: orgEngagement.status,
            },
            { status: 409 }
          );
        }
      }
    }

    let insertPayload = insertData;
    let insertResult = await supabase.from('engagements').insert(insertPayload).select().single();
    // Pre-migration database (column not added yet): retry without intro_origin
    // so engagement creation keeps working — direction just won't be recorded.
    if (insertResult.error && /intro_origin|42703|PGRST204/i.test(`${insertResult.error.code ?? ''} ${insertResult.error.message ?? ''}`)) {
      const { intro_origin: _dropped, ...fallback } = insertPayload;
      insertPayload = fallback;
      insertResult = await supabase.from('engagements').insert(insertPayload).select().single();
    }

    const { data, error } = insertResult;
    if (error) {
      console.error('[Engagements] Insert error:', error.message);
      return serverError();
    }

    await writeAuditLog({ userId: user.id, action: 'ENGAGEMENT_CREATED', entityType: 'engagements', entityId: data.id, after: insertData, req, blocking: true });

    // Track interest signal for the Investor Interest Index
    try {
      await supabase.from('project_interest_signals').insert({
        project_id,
        user_id: user.id,
        signal_type: 'engagement_created',
      });
    } catch { /* non-blocking */ }

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

    // ── Notify the developer org (when partner expresses interest) ─────────────
    // ── Notify the counterparty (when developer sends a request) ─────────────
    try {
      const { data: projectRow } = await supabase
        .from('projects')
        .select('name, developer_id')
        .eq('id', project_id)
        .single();

      if (projectRow) {
        const { data: actingCompany } = await supabase
          .from('companies')
          .select('name')
          .eq('id', user.company_id)
          .maybeSingle();

        const actingName = actingCompany?.name ?? 'A partner';
        const requestType = body.request_type as string | undefined;

        if (isDeveloperRequest) {
          // Developer sent a request TO the partner — notify the partner org
          const { data: partnerCompanyRow } = await supabase
            .from(partnerTable)
            .select('company_id')
            .eq('id', insertData.counterparty_id)
            .maybeSingle();

          if (partnerCompanyRow?.company_id) {
            const { data: partnerMembers } = await supabase
              .from('company_members')
              .select('user_id')
              .eq('company_id', partnerCompanyRow.company_id)
              .in('role', ['OWNER', 'ADMIN'])
              .is('deleted_at', null);

            const partnerMemberIds = (partnerMembers ?? []).map((m: any) => m.user_id);

            if (partnerMemberIds.length > 0) {
              const { data: partnerProfiles } = await supabase
                .from('user_profiles')
                .select('id, full_name, email')
                .in('id', partnerMemberIds);

              await Promise.all(
                (partnerProfiles ?? []).filter((p: any) => p?.id).map((profile: any) =>
                  notifyUser({
                    userId: profile.id,
                    payload: notificationBuilders.partnerRequestReceived({
                      projectName: projectRow.name,
                      developerName: actingName,
                      engagementId: data.id,
                      requestType,
                    }),
                    channel: 'both',
                    emailTo: profile.email,
                    emailTemplate: emailTemplates.partnerRequestEmail({
                      projectName: projectRow.name,
                      developerName: actingName,
                      recipientName: profile.full_name ?? 'there',
                      engagementUrl: `/engagements/${data.id}`,
                      requestType,
                      message: introMessage || undefined,
                    }),
                    emailLogType: 'engagement_updates',
                    emailEntityId: data.id,
                  })
                )
              );
            }
          }
        } else {
          // Partner expressed interest — notify the developer org
          const { data: memberRows } = await supabase
            .from('company_members')
            .select('user_id')
            .eq('company_id', projectRow.developer_id)
            .in('role', ['OWNER', 'ADMIN'])
            .is('deleted_at', null);

          const memberIds = (memberRows ?? []).map((m: any) => m.user_id);

          if (memberIds.length > 0) {
            const { data: profiles } = await supabase
              .from('user_profiles')
              .select('id, full_name, email')
              .in('id', memberIds);

            await Promise.all(
              (profiles ?? []).filter((p: any) => p?.id).map((profile: any) =>
                notifyUser({
                  userId: profile.id,
                  payload: notificationBuilders.expressInterest({
                    projectName: projectRow.name,
                    partnerName: actingName,
                    engagementId: data.id,
                    requestType,
                  }),
                  channel: 'both',
                  emailTo: profile.email,
                  emailTemplate: emailTemplates.expressInterestEmail({
                    projectName: projectRow.name,
                    partnerName: actingName,
                    recipientName: profile.full_name ?? 'there',
                    engagementUrl: `/engagements/${data.id}`,
                    requestType,
                  }),
                  emailLogType: 'engagement_updates',
                  emailEntityId: data.id,
                })
              )
            );
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
