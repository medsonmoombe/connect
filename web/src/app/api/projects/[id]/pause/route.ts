import { NextRequest } from 'next/server';
import { getAuthenticatedUser, badRequest, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { transitionProject } from '@/lib/project-state-machine';

type Params = { params: Promise<{ id: string }> };

const HARD_LOCK_STATUSES = ['TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'];
const SOFT_LOCK_STATUSES = ['NDA_SIGNED', 'DUE_DILIGENCE'];

// ── POST /api/projects/[id]/pause ────────────────────────────────────────────
// Developer can pause draft/scoring/pending_live projects.
// Cannot pause if there are active engagements past NDA stage.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return badRequest('Unauthorized');

    const { id: projectId } = await params;
    const { pause_reason } = await req.json().catch(() => ({ pause_reason: '' }));
    const supabase = getSupabaseAdmin();

    // Fetch the project
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, developer_id, status')
      .eq('id', projectId)
      .single();

    if (projErr || !project) return badRequest('Project not found');

    // Only the project owner or admin can pause
    if (!user.is_platform_admin && project.developer_id !== user.company_id) {
      return badRequest('You can only pause your own projects');
    }

    // Check current status — can't pause if already paused/deactivated/archived
    if (['paused', 'deactivated', 'archived'].includes(project.status)) {
      return badRequest(`Cannot pause a project that is ${project.status}`);
    }

    // Check engagement lock — can't pause if there are hard-lock engagements
    const { data: engagements } = await supabase
      .from('engagements')
      .select('status')
      .eq('project_id', projectId)
      .neq('status', 'DROPPED');

    const hasHardLock = (engagements ?? []).some(e => HARD_LOCK_STATUSES.includes(e.status));
    if (hasHardLock) {
      return badRequest('Cannot pause: this project has active engagements at Term Sheet or later stage. Complete or close those engagements first.');
    }

    // Perform the pause via state machine. Developers may pause their own live
    // project — this is the sanctioned path to unlock material-field editing
    // (the project leaves the marketplace and must be resubmitted for review).
    const result = await transitionProject({
      projectId,
      toStatus: 'paused',
      actorId: user.id!,
      actorRole: user.is_platform_admin ? 'platform_admin' : 'developer',
      skipRoleCheck: false,
      req,
    });

    if (!result.ok) {
      return badRequest(result.error || 'Failed to pause project');
    }

    // Set pause metadata
    await supabase
      .from('projects')
      .update({
        is_paused: true,
        paused_at: new Date().toISOString(),
        paused_by: user.id,
        pause_reason: pause_reason || 'Project paused by developer',
      })
      .eq('id', projectId);

    return Response.json({ success: true, message: 'Project paused successfully' });
  } catch (err) {
    return handleRouteError(err);
  }
}
