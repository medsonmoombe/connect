import { NextRequest } from 'next/server';
import { getAuthenticatedUser, handleRouteError, serverError, forbidden } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/reviews
 *
 * Returns the canonical review history for a project (every approve/return
 * decision). Visible to:
 *   - the project's owning developer
 *   - platform admins
 *   - authority users
 *
 * RLS on `project_reviews` enforces the same visibility at the DB layer
 * (defined in migration 067).
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;
    const supabase = getSupabaseAdmin();

    // Confirm the project exists + the caller has access.
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, developer_id')
      .eq('id', projectId)
      .is('deleted_at', null)
      .maybeSingle();

    if (projErr) return serverError();
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    const isOwner = user.is_platform_admin || project.developer_id === user.company_id;
    const isReviewer = user.is_platform_admin || (user as any).is_authority_user;
    if (!isOwner && !isReviewer) {
      return forbidden('You do not have access to this project\'s review history.');
    }

    const { data, error } = await supabase
      .from('project_reviews')
      .select('id, project_id, reviewer_id, decision, comments, from_status, to_status, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Reviews] Fetch error:', error.message);
      return serverError();
    }

    // Resolve reviewer display names in a second query (the project_reviews
    // FK targets auth.users, not user_profiles, so we hop via user_profiles).
    const reviewerIds = Array.from(new Set((data ?? []).map((r) => r.reviewer_id).filter((id): id is string => !!id)));
    let profileById: Record<string, { full_name: string | null; email: string | null }> = {};
    if (reviewerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', reviewerIds);
      for (const p of profiles ?? []) {
        profileById[p.id] = { full_name: p.full_name, email: p.email };
      }
    }

    const rows = (data ?? []).map((r) => ({
      ...r,
      reviewer: r.reviewer_id ? (profileById[r.reviewer_id] ?? null) : null,
    }));

    return Response.json({ data: rows });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
