import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const PROJECT_SELECT = `
  id, name, technology_type, location_country, location_region,
  project_size_mw, capital_required, project_stage, status,
  is_visible_to_investors, deleted_at,
  scores:project_scores(capital_readiness_score, technical_readiness_score, documentation_score)
`;

type TraderMatchProject = {
  status?: string | null;
  is_visible_to_investors?: boolean | null;
  deleted_at?: string | null;
};

type TraderMatchRow = {
  project?: TraderMatchProject | TraderMatchProject[] | null;
};

function getMatchProject(match: TraderMatchRow): TraderMatchProject | null {
  if (Array.isArray(match.project)) return match.project[0] ?? null;
  return match.project ?? null;
}

// GET /api/matches/trader          - all matches for the authenticated power trader
// GET /api/matches/trader?stats=true - summary stats only
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const statsOnly = searchParams.get('stats') === 'true';
    const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 100), 1), 250);

    const { data: partner, error: partnerErr } = await supabase
      .from('power_traders')
      .select('id')
      .eq('company_id', user.company_id)
      .maybeSingle();

    if (partnerErr || !partner) {
      return Response.json({ data: statsOnly ? { total: 0, avgScore: 0, highPotential: 0 } : [] });
    }

    if (statsOnly) {
      const { data: rows, error } = await supabase
        .from('power_trader_match_results')
        .select('compatibility_score')
        .eq('power_trader_id', partner.id)
        .eq('status', 'active');

      if (error) return serverError();

      const scores = (rows ?? []).map((r: { compatibility_score: number }) => r.compatibility_score);
      return Response.json({
        data: {
          total: scores.length,
          avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
          highPotential: scores.filter((s) => s >= 75).length,
        },
      });
    }

    const { data: matches, error } = await supabase
      .from('power_trader_match_results')
      .select(`id, project_id, power_trader_id, compatibility_score, score_breakdown, created_at, project:projects(${PROJECT_SELECT})`)
      .eq('power_trader_id', partner.id)
      .eq('status', 'active')
      .order('compatibility_score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Power Trader Matches] Fetch error:', error.message);
      return serverError();
    }

    const filtered = ((matches ?? []) as TraderMatchRow[]).filter((m) => {
      const project = getMatchProject(m);
      return project?.status === 'live' && project.is_visible_to_investors && !project.deleted_at;
    });
    return Response.json({ data: filtered });
  } catch (e: unknown) {
    return handleRouteError(e);
  }
}
