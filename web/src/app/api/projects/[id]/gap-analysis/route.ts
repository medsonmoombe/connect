import { NextRequest } from 'next/server';
import { getAuthenticatedUser, apiSuccess, apiError, ERR, handleRouteError, verifyProjectOwnership } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { analyzeProjectGaps, type GapAnalysisResult } from '@/lib/gap-analysis';
import { isScoreHiddenForDeveloper, type ProjectStatus } from '@/lib/project-state-machine';
import { isReviewerUser } from '@/lib/admin-access';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/gap-analysis
 *
 * Runs the Developer Gap Matrix analysis on a project and returns:
 * - overallReadiness score (0-100)
 * - categoryBreakdown per category
 * - gaps array with recommendations
 * - summary text
 *
 * Access: project owner (developer) or platform admin.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;

    if (!await verifyProjectOwnership(id, user.company_id, user.is_platform_admin)) {
      return apiError(ERR.FORBIDDEN, 'Only the project owner or platform admin can view gap analysis.', 403);
    }

    const supabase = getSupabaseAdmin();

    // Fetch project with all related data needed for gap analysis
    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select(`
        *,
        tech_requirements:project_tech_requirements(*),
        documents:project_documents(*),
        scores:project_scores(*),
        developer:companies(*)
      `)
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (projectErr || !project) {
      console.error('[GapAnalysis] Project fetch failed:', projectErr?.message);
      return apiError(ERR.NOT_FOUND, 'Project not found.', 404);
    }

    // The gap engine folds the score row into its own headline number, so passing
    // it through here leaked the very score the visibility gate hides. A
    // developer mid-review could read their readiness score from this endpoint
    // instead of /api/projects/[id]. Apply the same shared predicate.
    const scoreVisible =
      isReviewerUser(user)
      || !isScoreHiddenForDeveloper(project.status as ProjectStatus, !!project.rejection_reason);

    // Run the gap analysis engine — pure function, no side effects
    const result: GapAnalysisResult = analyzeProjectGaps(
      project as any,
      scoreVisible ? project.scores ?? null : null,
    );

    return apiSuccess(
      { ...result, score_available: scoreVisible },
      { headers: { 'Cache-Control': 'private, max-age=30' } },
    );
  } catch (e: any) {
    return handleRouteError(e);
  }
}
