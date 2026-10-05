import { NextRequest } from 'next/server';
import { getAuthenticatedUser, badRequest, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { transitionProject } from '@/lib/project-state-machine';

type Params = { params: Promise<{ id: string }> };

// ── POST /api/projects/[id]/resume ───────────────────────────────────────────
// Resume a paused project. Developer or admin can resume.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return badRequest('Unauthorized');

    const { id: projectId } = await params;
    const supabase = getSupabaseAdmin();

    // Fetch the project
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, developer_id, status')
      .eq('id', projectId)
      .single();

    if (projErr || !project) return badRequest('Project not found');

    // Only the project owner or admin can resume
    if (!user.is_platform_admin && project.developer_id !== user.company_id) {
      return badRequest('You can only resume your own projects');
    }

    if (project.status !== 'paused') {
      return badRequest('Project is not paused');
    }

    // Resume: go back to draft so the developer can edit and re-submit
    const result = await transitionProject({
      projectId,
      toStatus: 'draft',
      actorId: user.id!,
      actorRole: user.is_platform_admin ? 'platform_admin' : 'developer',
      skipRoleCheck: false,
      req,
    });

    if (!result.ok) {
      return badRequest(result.error || 'Failed to resume project');
    }

    // Clear pause metadata
    await supabase
      .from('projects')
      .update({
        is_paused: false,
        paused_at: null,
        paused_by: null,
        pause_reason: null,
      })
      .eq('id', projectId);

    return Response.json({ success: true, message: 'Project resumed successfully' });
  } catch (err) {
    return handleRouteError(err);
  }
}
