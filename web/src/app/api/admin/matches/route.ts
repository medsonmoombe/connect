import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden('Only platform administrators can view global match data. Contact your platform support team if you need access.');

    const admin = getSupabaseAdmin();

    const [capitalRes, technicalRes] = await Promise.all([
      admin
        .from('capital_match_results')
        .select('id, compatibility_score, score_breakdown, created_at, project_id, capital_partner_id'),
      admin
        .from('technical_match_results')
        .select('id, compatibility_score, score_breakdown, status, created_at, project_id, technical_partner_id'),
    ]);

    const capitalRaw = capitalRes.data ?? [];
    const technicalRaw = technicalRes.data ?? [];

    const allProjectIds = [
      ...new Set([...capitalRaw.map((r: any) => r.project_id), ...technicalRaw.map((r: any) => r.project_id)]),
    ];
    const allCapitalPartnerIds = [...new Set(capitalRaw.map((r: any) => r.capital_partner_id).filter(Boolean))];
    const allTechnicalPartnerIds = [...new Set(technicalRaw.map((r: any) => r.technical_partner_id).filter(Boolean))];

    const [projectsRes, scoresRes, techReqsRes, capitalPartnersRes, technicalPartnersRes] = await Promise.all([
      allProjectIds.length > 0
        ? admin.from('projects').select('id, name, developer_id, technology_type, location_country, location_region, project_size_mw, capital_required, capital_structure_type, project_stage, status, created_at').in('id', allProjectIds)
        : { data: [] },
      allProjectIds.length > 0
        ? admin.from('project_scores').select('project_id, capital_readiness_score, technical_readiness_score').in('project_id', allProjectIds)
        : { data: [] },
      allProjectIds.length > 0
        ? admin.from('project_tech_requirements').select('project_id, required_services, terrain_complexity, grid_status').in('project_id', allProjectIds)
        : { data: [] },
      allCapitalPartnerIds.length > 0
        ? admin.from('capital_partners').select('id, company_id, companies:id, name').in('id', allCapitalPartnerIds)
        : { data: [] },
      allTechnicalPartnerIds.length > 0
        ? admin.from('technical_partners').select('id, company_id, companies:id, name').in('id', allTechnicalPartnerIds)
        : { data: [] },
    ]);

    const projects = projectsRes.data ?? [];
    const scores = scoresRes.data ?? [];
    const techReqs = techReqsRes.data ?? [];
    const capitalPartners = capitalPartnersRes.data ?? [];
    const technicalPartners = technicalPartnersRes.data ?? [];

    const devIds = [...new Set(projects.map((p: any) => p.developer_id).filter(Boolean))];
    const { data: devs } = devIds.length > 0
      ? await admin.from('companies').select('id, name').in('id', devIds)
      : { data: [] };

    const projMap = new Map(projects.map((p: any) => [p.id, p]));
    const scoreMap = new Map(scores.map((s: any) => [s.project_id, s]));
    const devMap = new Map((devs ?? []).map((d: any) => [d.id, d]));
    const techMap = new Map(techReqs.map((t: any) => [t.project_id, t]));
    const cpMap = new Map(capitalPartners.map((cp: any) => [cp.id, cp]));
    const tpMap = new Map(technicalPartners.map((tp: any) => [tp.id, tp]));

    const capitalMatches = capitalRaw.map((r: any) => ({
      match_id: r.id,
      score: r.compatibility_score,
      score_breakdown: r.score_breakdown,
      matched_at: r.created_at,
      match_type: 'capital' as const,
      partner_id: r.capital_partner_id,
      partner: cpMap.get(r.capital_partner_id) ?? null,
      project: projMap.get(r.project_id) ?? null,
      project_score: scoreMap.get(r.project_id) ?? null,
      developer: devMap.get((projMap.get(r.project_id) as any)?.developer_id) ?? null,
    }));

    const technicalMatches = technicalRaw.map((r: any) => ({
      match_id: r.id,
      score: r.compatibility_score,
      score_breakdown: r.score_breakdown,
      match_status: r.status,
      matched_at: r.created_at,
      match_type: 'technical' as const,
      partner_id: r.technical_partner_id,
      partner: tpMap.get(r.technical_partner_id) ?? null,
      project: projMap.get(r.project_id) ?? null,
      project_score: scoreMap.get(r.project_id) ?? null,
      developer: devMap.get((projMap.get(r.project_id) as any)?.developer_id) ?? null,
      tech_requirements: techMap.get(r.project_id) ?? null,
    }));

    const matches = [...capitalMatches, ...technicalMatches].sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0)
    );

    return Response.json({ data: { matches } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
