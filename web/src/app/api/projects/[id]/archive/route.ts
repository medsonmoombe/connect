import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, handleRouteError, badRequest } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { transitionProject } from '@/lib/project-state-machine';
import { createNotification, notificationBuilders } from '@/lib/notify';

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/archive — validated → archived (developer or platform admin)
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;

    const supabase = getSupabaseAdmin();
    const { data: project } = await supabase
      .from('projects')
      .select('developer_id, status, name')
      .eq('id', id)
      .single();

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!user.is_platform_admin && project.developer_id !== user.company_id) {
      return forbidden();
    }

    if (project.status !== 'validated') {
      return badRequest(`Project is ${project.status}. Only validated projects can be archived.`);
    }

    const result = await transitionProject({
      projectId: id,
      toStatus: 'archived',
      actorId: user.id!,
      req,
    });

    if (!result.success) {
      return badRequest(result.error || 'Failed to archive project');
    }

    // Notify: project creator (if archiver is platform admin)
    if (user.is_platform_admin) {
      const { data: creator } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('company_id', project.developer_id)
        .limit(1)
        .single();

      if (creator?.id) {
        await createNotification({
          userId: creator.id,
          payload: notificationBuilders.projectStatusChanged({
            projectName: project.name || 'Untitled Project',
            newStatus: 'archived',
            actionUrl: `/dashboard/developer`,
          }),
        });
      }
    }

    return Response.json({ data: { status: 'archived' } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
