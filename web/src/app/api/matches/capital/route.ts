import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const PROJECT_SELECT = `
  id, name, technology_type, location_country, location_region,
  capital_required, project_stage, status, capital_structure_type,
  is_visible_to_investors, deleted_at,
  scores:project_scores(capital_readiness_score)
`;

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const statsOnly = searchParams.get('stats') === 'true';
    const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 100), 1), 250);

    // Check capital_partners first, then grant_providers as fallback
    const { data: capPartner } = await supabase
      .from('capital_partners').select('id').eq('company_id', user.company_id).maybeSingle();

    const { data: grantProvider } = !capPartner
      ? await supabase.from('grant_providers').select('id').eq('company_id', user.company_id).maybeSingle()
      : { data: null };

    if (!capPartner && !grantProvider) {
      return Response.json({ data: statsOnly ? { total: 0, avgScore: 0, highPotential: 0 } : [] });
    }

    if (statsOnly) {
      const table = grantProvider ? 'grant_match_results' : 'capital_match_results';
      const col = grantProvider ? 'grant_provider_id' : 'capital_partner_id';
      const id = grantProvider ? grantProvider.id : capPartner!.id;

      const { data: rows, error } = await supabase
        .from(table).select('compatibility_score').eq(col, id).eq('status', 'active');
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

    // Grant provider — read from grant_match_results
    if (grantProvider) {
      const { data: matches, error } = await supabase
        .from('grant_match_results')
        .select(`id, project_id, grant_provider_id, compatibility_score, score_breakdown, created_at, project:projects(${PROJECT_SELECT})`)
        .eq('grant_provider_id', grantProvider.id)
        .eq('status', 'active')
        .order('compatibility_score', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[Grant Matches] Fetch error:', error.message);
        return serverError();
      }
      const filtered = (matches ?? []).filter(
        (m: any) => m.project?.status === 'live' && m.project?.is_visible_to_investors && !m.project?.deleted_at
      );
      return Response.json({ data: filtered });
    }

    // Regular capital partner — read from capital_match_results
    const { data: matches, error } = await supabase
      .from('capital_match_results')
      .select(`id, project_id, capital_partner_id, compatibility_score, score_breakdown, created_at, project:projects(${PROJECT_SELECT})`)
      .eq('capital_partner_id', capPartner!.id)
      .eq('status', 'active')
      .order('compatibility_score', { ascending: false })
      .limit(limit);

    if (error) return serverError();
    const filtered = (matches ?? []).filter(
      (m: any) => m.project?.status === 'live' && m.project?.is_visible_to_investors && !m.project?.deleted_at
    );
    return Response.json({ data: filtered });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
