import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('project_bookmarks')
      .select(`
        id, project_id, created_at,
        project:projects(
          id, name, technology_type, location_country, location_region,
          project_size_mw, capital_required, capital_structure_type, project_stage,
          status, is_visible_to_investors, scores_visible_at,
          scores:project_scores(capital_readiness_score, technical_readiness_score),
          developer:companies(id, name, logo_url)
        )
      `)
      .eq('user_id', user.auth_id)
      .eq('project.status', 'live')
      .eq('project.is_visible_to_investors', true)
      .is('project.deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Bookmarks] Query error:', error.message);
      return serverError();
    }

    return Response.json({ data: (data ?? []).filter((bookmark: any) => bookmark.project) });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
