import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, handleRouteError, badRequest } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { transitionProject } from '@/lib/project-state-machine';
import { notifyOrgAdmins } from '@/lib/notify-helpers';
import { notificationBuilders } from '@/lib/notify';
import * as emailTemplates from '@/lib/email-templates';

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/archive — live|deactivated → archived (owner or platform admin)
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

    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    if (!user.is_platform_admin && project.developer_id !== user.company_id) return forbidden();

    if (!['live', 'pending_live', 'deactivated'].includes(project.status)) {
      return badRequest(`Only live, pending_live, or deactivated projects can be archived.`);
    }

    const result = await transitionProject({ projectId: id, toStatus: 'archived', actorId: user.id!, req });
    if (!result.success) return badRequest(result.error || 'Failed to archive project');

    await notifyOrgAdmins({
      companyId: project.developer_id,
      payload: notificationBuilders.projectStatusChanged({ projectName: project.name, newStatus: 'archived' }),
      channel: 'both',
      emailTemplate: emailTemplates.projectStatusEmail({ projectName: project.name, newStatus: 'archived', recipientName: 'there' }),
      emailLogType: 'project_archived',
      excludeUserIds: [user.id!],
    });

    return Response.json({ data: { status: 'archived' } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
