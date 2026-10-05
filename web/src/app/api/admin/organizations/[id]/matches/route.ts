import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, badRequest, serverError, handleRouteError, writeAuditLog } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isValidTransition } from '@/lib/engagement';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const { id } = await params;
    const admin = getSupabaseAdmin();

    const { data: company, error: compErr } = await admin
      .from('companies')
      .select('id, primary_role, name')
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (compErr || !company) return badRequest('Organisation not found');

    let matches: any[] = [];

    if (company.primary_role === 'CAPITAL_PARTNER') {
      const { data: partner } = await admin
        .from('capital_partners')
        .select('id')
        .eq('company_id', id)
        .maybeSingle();

      if (partner) {
        const { data: raw } = await admin
          .from('capital_match_results')
          .select('id, compatibility_score, score_breakdown, created_at, project_id')
          .eq('capital_partner_id', partner.id)
          .order('compatibility_score', { ascending: false });

        if (raw && raw.length > 0) {
          const projectIds = raw.map(r => r.project_id);
          const { data: projects } = await admin
            .from('projects')
            .select('id, name, developer_id, technology_type, location_country, location_region, project_size_mw, capital_required, capital_structure_type, project_stage, status, created_at')
            .in('id', projectIds);

          const { data: scores } = await admin
            .from('project_scores')
            .select('project_id, capital_readiness_score')
            .in('project_id', projectIds);

          const devIds = [...new Set((projects ?? []).map((p: any) => p.developer_id).filter(Boolean))];
          const { data: devs } = devIds.length > 0
            ? await admin.from('companies').select('id, name').in('id', devIds)
            : { data: [] };

          const projMap = new Map((projects ?? []).map((p: any) => [p.id, p]));
          const scoreMap = new Map((scores ?? []).map((s: any) => [s.project_id, s]));
          const devMap = new Map((devs ?? []).map((d: any) => [d.id, d]));

          matches = raw.map(r => ({
            match_id: r.id,
            score: r.compatibility_score,
            score_breakdown: r.score_breakdown,
            matched_at: r.created_at,
            project: projMap.get(r.project_id) ?? null,
            project_score: scoreMap.get(r.project_id) ?? null,
            developer: devMap.get((projMap.get(r.project_id) as any)?.developer_id) ?? null,
          }));
        }
      }

    } else if (company.primary_role === 'TECHNICAL_PARTNER') {
      const { data: partner } = await admin
        .from('technical_partners')
        .select('id')
        .eq('company_id', id)
        .maybeSingle();

      if (partner) {
        const { data: raw } = await admin
          .from('technical_match_results')
          .select('id, compatibility_score, score_breakdown, status, created_at, project_id')
          .eq('technical_partner_id', partner.id)
          .order('compatibility_score', { ascending: false });

        if (raw && raw.length > 0) {
          const projectIds = raw.map(r => r.project_id);
          const { data: projects } = await admin
            .from('projects')
            .select('id, name, developer_id, technology_type, location_country, location_region, project_size_mw, capital_required, capital_structure_type, project_stage, status, created_at')
            .in('id', projectIds);

          const { data: scores } = await admin
            .from('project_scores')
            .select('project_id, technical_readiness_score')
            .in('project_id', projectIds);

          const devIds = [...new Set((projects ?? []).map((p: any) => p.developer_id).filter(Boolean))];
          const { data: devs } = devIds.length > 0
            ? await admin.from('companies').select('id, name').in('id', devIds)
            : { data: [] };

          const { data: techReqs } = await admin
            .from('project_tech_requirements')
            .select('project_id, required_services, terrain_complexity, grid_status')
            .in('project_id', projectIds);

          const projMap = new Map((projects ?? []).map((p: any) => [p.id, p]));
          const scoreMap = new Map((scores ?? []).map((s: any) => [s.project_id, s]));
          const devMap = new Map((devs ?? []).map((d: any) => [d.id, d]));
          const techMap = new Map((techReqs ?? []).map((t: any) => [t.project_id, t]));

          matches = raw.map(r => ({
            match_id: r.id,
            score: r.compatibility_score,
            score_breakdown: r.score_breakdown,
            match_status: r.status,
            matched_at: r.created_at,
            project: projMap.get(r.project_id) ?? null,
            project_score: scoreMap.get(r.project_id) ?? null,
            developer: devMap.get((projMap.get(r.project_id) as any)?.developer_id) ?? null,
            tech_requirements: techMap.get(r.project_id) ?? null,
          }));
        }
      }

    } else if (company.primary_role === 'DEVELOPER') {
      const { data: projects } = await admin
        .from('projects')
        .select('id, name, technology_type, location_country, location_region, project_size_mw, capital_required, capital_structure_type, project_stage, status, created_at')
        .is('deleted_at', null)
        .eq('developer_id', id)
        .order('created_at', { ascending: false });

      const projectIds = (projects ?? []).map((p: any) => p.id);

      let capitalMatches: any[] = [];
      let technicalMatches: any[] = [];
      let scores: any[] = [];

      if (projectIds.length > 0) {
        const [cmRes, tmRes, scRes] = await Promise.all([
          admin.from('capital_match_results').select('project_id, compatibility_score').in('project_id', projectIds),
          admin.from('technical_match_results').select('project_id, compatibility_score').in('project_id', projectIds),
          admin.from('project_scores').select('project_id, capital_readiness_score, technical_readiness_score').in('project_id', projectIds),
        ]);
        capitalMatches = cmRes.data ?? [];
        technicalMatches = tmRes.data ?? [];
        scores = scRes.data ?? [];
      }

      const capitalCountMap = new Map<string, number>();
      const technicalCountMap = new Map<string, number>();
      capitalMatches.forEach((m: any) => capitalCountMap.set(m.project_id, (capitalCountMap.get(m.project_id) ?? 0) + 1));
      technicalMatches.forEach((m: any) => technicalCountMap.set(m.project_id, (technicalCountMap.get(m.project_id) ?? 0) + 1));
      const scoreMap = new Map(scores.map((s: any) => [s.project_id, s]));

      matches = (projects ?? []).map((p: any) => ({
        project: p,
        project_score: scoreMap.get(p.id) ?? null,
        capital_match_count: capitalCountMap.get(p.id) ?? 0,
        technical_match_count: technicalCountMap.get(p.id) ?? 0,
      }));

    } else if (company.primary_role === 'POWER_TRADER') {
      const { data: partner } = await admin
        .from('power_traders')
        .select('id, license_type, max_offtake_capacity_mw, preferred_technology_types, regions_of_interest')
        .eq('company_id', id)
        .maybeSingle();

      if (partner) {
        const { data: raw } = await admin
          .from('power_trader_match_results')
          .select('id, compatibility_score, score_breakdown, status, created_at, project_id')
          .eq('power_trader_id', partner.id)
          .order('compatibility_score', { ascending: false });

        if (raw && raw.length > 0) {
          const projectIds = raw.map(r => r.project_id);
          const { data: projects } = await admin
            .from('projects')
            .select('id, name, developer_id, technology_type, location_country, location_region, project_size_mw, capital_required, project_stage, status, created_at')
            .in('id', projectIds);

          const devIds = [...new Set((projects ?? []).map((p: any) => p.developer_id).filter(Boolean))];
          const { data: devs } = devIds.length > 0
            ? await admin.from('companies').select('id, name').in('id', devIds)
            : { data: [] };

          const projMap = new Map((projects ?? []).map((p: any) => [p.id, p]));
          const devMap = new Map((devs ?? []).map((d: any) => [d.id, d]));

          matches = raw.map(r => ({
            match_id: r.id,
            score: r.compatibility_score,
            score_breakdown: r.score_breakdown,
            match_status: r.status,
            matched_at: r.created_at,
            project: projMap.get(r.project_id) ?? null,
            developer: devMap.get((projMap.get(r.project_id) as any)?.developer_id) ?? null,
            trader_profile: partner,
          }));
        }
      }
    }

    return Response.json({ data: { company, matches } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const { id } = await params;
    const body = await req.json();
    const admin = getSupabaseAdmin();

    const { action, ...data } = body;

    if (action === 'create_engagement') {
      const { project_id, counterparty_type } = data;
      if (!project_id || !counterparty_type) {
        return badRequest('project_id and counterparty_type are required');
      }

      const partnerTableByType: Record<string, string> = {
        CAPITAL: 'capital_partners',
        TECHNICAL: 'technical_partners',
        CONSULTANT: 'consultants',
        GRANT_PROVIDER: 'grant_providers',
        POWER_TRADER: 'power_traders',
      };
      const partnerTable = partnerTableByType[counterparty_type];
      if (!partnerTable) return badRequest('Unsupported counterparty_type');
      const { data: partner } = await admin
        .from(partnerTable)
        .select('id')
        .eq('company_id', id)
        .maybeSingle();

      if (!partner) return badRequest('No matching partner profile found for this organisation');

      const { data: project } = await admin
        .from('projects')
        .select('id, developer_id')
        .eq('id', project_id)
        .is('deleted_at', null)
        .maybeSingle();

      if (!project) return badRequest('Project not found');

      const engagementPayload = {
        project_id,
        counterparty_id: partner.id,
        counterparty_type,
        status: 'INTRO_SENT',
      };

      const { data: engagement, error: engErr } = await admin
        .from('engagements')
        .insert(engagementPayload)
        .select()
        .single();

      if (engErr) {
        console.error('[Admin/OrgMatches] Engagement insert error:', engErr.message);
        return serverError();
      }

      await writeAuditLog({
        userId: user.id,
        action: 'ENGAGEMENT_CREATED',
        entityType: 'engagements',
        entityId: engagement.id,
        after: engagementPayload,
        req,
        blocking: true,
      });

      return Response.json({ data: engagement }, { status: 201 });

    } else if (action === 'advance_engagement') {
      const { engagement_id, new_status } = data;
      if (!engagement_id || !new_status) {
        return badRequest('engagement_id and new_status are required');
      }

      const { data: engagement, error: fetchErr } = await admin
        .from('engagements')
        .select('id, status')
        .eq('id', engagement_id)
        .single();

      if (fetchErr || !engagement) return badRequest('Engagement not found');

      if (!isValidTransition(engagement.status, new_status)) {
        return badRequest(`Cannot advance from ${engagement.status} to ${new_status}`);
      }

      const { error: updateErr } = await admin
        .from('engagements')
        .update({ status: new_status, updated_at: new Date().toISOString() })
        .eq('id', engagement_id);

      if (updateErr) return serverError();

      await writeAuditLog({
        userId: user.id,
        action: 'ENGAGEMENT_STATUS_CHANGED',
        entityType: 'engagements',
        entityId: engagement_id,
        before: { status: engagement.status },
        after: { status: new_status },
        req,
        blocking: true,
      });

      return Response.json({ data: { id: engagement_id, status: new_status } });

    } else {
      return badRequest('Invalid action');
    }
  } catch (e: any) {
    return handleRouteError(e);
  }
}


