import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// GET /api/matches/technical          — all matches for the authenticated technical partner
// GET /api/matches/technical?stats=true — summary stats only
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const statsOnly = searchParams.get('stats') === 'true';
    const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 100), 1), 250);

    const { data: partner, error: partnerErr } = await supabase
      .from('technical_partners')
      .select('id')
      .eq('company_id', user.company_id)
      .maybeSingle();

    if (partnerErr || !partner) {
      return Response.json({ data: statsOnly ? { total: 0, avgScore: 0, highPotential: 0 } : [] });
    }

    if (statsOnly) {
      const { data: rows, error } = await supabase
        .from('technical_match_results')
        .select('compatibility_score')
        .eq('technical_partner_id', partner.id)
        .eq('status', 'active');

      if (error) return serverError();

      const scores = (rows ?? []).map((r: any) => r.compatibility_score as number);
      return Response.json({
        data: {
          total: scores.length,
          avgScore: scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0,
          highPotential: scores.filter((s: number) => s >= 75).length,
        },
      });
    }

    const { data: matches, error } = await supabase
      .from('technical_match_results')
      .select(`
        id, project_id, technical_partner_id, compatibility_score, score_breakdown, created_at,
        project:projects(
          id, name, technology_type, location_country, location_region,
          capital_required, project_stage, status,
          scores:project_scores(capital_readiness_score)
        )
      `)
      .eq('technical_partner_id', partner.id)
      .eq('status', 'active')
      .order('compatibility_score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Technical Matches] Fetch error:', error.message);
      return serverError();
    }
    // Filter in JS to avoid Supabase nested-filter 400s
    const filtered = (matches ?? []).filter(
      (m: any) => m.project && m.project.status === 'live' && !m.project.deleted_at
    );
    return Response.json({ data: filtered });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
