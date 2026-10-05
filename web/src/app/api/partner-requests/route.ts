import { NextRequest } from 'next/server';
import { getAuthenticatedUser, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { notifyUser, notificationBuilders } from '@/lib/notify';
import * as emailTemplates from '@/lib/email-templates';

const REQUEST_TYPES = ['quote', 'meeting', 'introduction'] as const;
const VALID_STATUSES = ['sent', 'viewed', 'accepted', 'declined', 'expired'] as const;

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);

    let query = supabase
      .from('partner_requests')
      .select('*, partner:companies(id, name, logo_url, country), project:projects(id, name, project_size_mw, capital_required, project_stage, technology_type)')
      .order('created_at', { ascending: false });

    if (!user.is_platform_admin) {
      query = query.eq('partner_company_id', user.company_id);
    }

    const status = searchParams.get('status');
    const projectId = searchParams.get('project_id');
    const requestType = searchParams.get('request_type');

    if (status) query = query.eq('status', status);
    if (projectId) query = query.eq('project_id', projectId);
    if (requestType) query = query.eq('request_type', requestType);

    const { data, error } = await query;
    if (error) {
      console.error('[PartnerRequests] Query error:', error.message);
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }

    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();
    const body = await req.json();

    const { project_id, partner_company_id, request_type, gaps_to_fill, requested_service, message } = body;

    if (!project_id || !partner_company_id || !request_type) {
      return Response.json({ error: 'project_id, partner_company_id, and request_type are required' }, { status: 400 });
    }
    if (!REQUEST_TYPES.includes(request_type)) {
      return Response.json({ error: 'request_type must be quote, meeting, or introduction' }, { status: 400 });
    }

    // Verify the project belongs to the developer
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, developer_id, project_size_mw, capital_required, project_stage, technology_type, location_country, location_region')
      .eq('id', project_id)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!user.is_platform_admin && project.developer_id !== user.company_id) {
      return Response.json({ error: 'You can only send requests for your own projects' }, { status: 403 });
    }

    // ── Duplicate engagement check ───────────────────────────────────────────
    const { data: existing } = await supabase
      .from('engagements')
      .select('id, status')
      .eq('project_id', project_id)
      .eq('counterparty_id', partner_company_id)
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

    // Build project_summary for the request
    const project_summary = {
      name: project.name,
      size_mw: project.project_size_mw,
      capital_required: project.capital_required,
      stage: project.project_stage,
      technology: project.technology_type,
      country: project.location_country,
      region: project.location_region,
    };

    // Create the request
    const { data: request, error: insertError } = await supabase
      .from('partner_requests')
      .insert({
        project_id,
        partner_company_id,
        request_type,
        gaps_to_fill: gaps_to_fill ?? [],
        requested_service: requested_service ?? null,
        message: message ?? null,
        status: 'sent',
        project_summary,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14-day expiry
      })
      .select('*, partner:companies(id, name, logo_url), project:projects(id, name)')
      .single();

    if (insertError) {
      console.error('[PartnerRequests] Insert error:', insertError.message);
      return Response.json({ error: 'Failed to create request' }, { status: 500 });
    }

    // Create engagement automatically. Derive the counterparty type from the
    // partner company's actual type so consultants/grant providers route
    // correctly (previously hardcoded as CAPITAL/TECHNICAL by request type).
    const { data: partnerCompany } = await supabase
      .from('companies')
      .select('type')
      .eq('id', partner_company_id)
      .single();
    const partnerType = partnerCompany?.type;
    const counterpartyType =
      partnerType === 'CONSULTANT' ? 'CONSULTANT'
      : partnerType === 'GRANT_PROVIDER' ? 'GRANT_PROVIDER'
      : partnerType === 'CAPITAL' ? 'CAPITAL'
      : 'TECHNICAL';

    const { data: engagement } = await supabase
      .from('engagements')
      .insert({
        project_id,
        counterparty_type: counterpartyType,
        counterparty_id: partner_company_id,
        status: 'INTRO_SENT',
      })
      .select('id')
      .single();

    if (engagement) {
      await supabase
        .from('partner_requests')
        .update({ engagement_id: engagement.id })
        .eq('id', request.id);
    }

    // Notify the partner company
    try {
      const { data: devCompany } = await supabase
        .from('companies')
        .select('name')
        .eq('id', user.company_id)
        .single();

      const { data: memberRows } = await supabase
        .from('company_members')
        .select('user_id')
        .eq('company_id', partner_company_id)
        .in('role', ['OWNER', 'ADMIN'])
        .is('deleted_at', null);

      const memberIds = (memberRows ?? []).map((m: any) => m.user_id);

      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', memberIds);

        await Promise.all(
          (profiles ?? []).filter(p => p?.id).map(profile =>
            notifyUser({
              userId: profile.id,
              payload: notificationBuilders.expressInterest({
                projectName: project.name,
                partnerName: devCompany?.name ?? 'A developer',
                engagementId: engagement?.id ?? request.id,
              }),
              channel: 'both',
              emailTo: profile.email,
              emailTemplate: emailTemplates.expressInterestEmail({
                projectName: project.name,
                partnerName: devCompany?.name ?? 'A developer',
                recipientName: profile.full_name ?? 'there',
                engagementUrl: `/engagements/${engagement?.id ?? ''}`,
              }),
              emailLogType: 'partner_requests',
              emailEntityId: request.id,
            })
          )
        );
      }
    } catch (notifyErr: any) {
      console.error('[PartnerRequests] Notify error:', notifyErr.message);
    }

    return Response.json({ data: request }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
