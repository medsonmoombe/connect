import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, handleRouteError, badRequest, findProjectCreator } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { transitionProject } from '@/lib/project-state-machine';
import { createNotification, createNotifications, notificationBuilders } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import { projectUnderReviewEmail } from '@/lib/email-templates';

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/review — submitted → under_review (platform admin only)
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;

    if (!user.is_platform_admin) {
      return forbidden();
    }

    const supabase = getSupabaseAdmin();
    const { data: project } = await supabase
      .from('projects')
      .select('status, name, developer_id, created_by')
      .eq('id', id)
      .single();

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.status !== 'submitted') {
      return badRequest(`Project is ${project.status}. Only submitted projects can be reviewed.`);
    }

    const result = await transitionProject({
      projectId: id,
      toStatus: 'under_review',
      actorId: user.id!,
      req,
    });

    if (!result.success) {
      return badRequest(result.error || 'Failed to start review');
    }

    const projectName = project.name || 'Untitled Project';
    const creator = await findProjectCreator(supabase, project.developer_id, project.created_by);

    // 1. Notify creator — in-app + email
    if (creator?.id) {
      await createNotification({
        userId: creator.id,
        payload: notificationBuilders.projectStatusChanged({
          projectName,
          newStatus: 'under_review',
          actionUrl: `/projects/${id}`,
        }),
      });
      if (creator.email) {
        const tpl = projectUnderReviewEmail({
          projectName,
          recipientName: creator.full_name || 'there',
          projectUrl: `/projects/${id}`,
        });
        await sendEmail({
          to: creator.email,
          subject: tpl.subject,
          html: tpl.html,
          logType: 'project_under_review',
          logEntityId: id,
        });
      }
    }

    // 2. Notify other org admins (excluding creator) — in-app only
    const { data: orgAdmins } = await supabase
      .from('company_members')
      .select('user_id')
      .eq('company_id', project.developer_id)
      .in('role', ['OWNER', 'ADMIN'])
      .is('deleted_at', null);

    if (orgAdmins && orgAdmins.length > 0) {
      const adminIds = orgAdmins.map(m => m.user_id).filter(uid => uid !== creator?.id);
      if (adminIds.length > 0) {
        await createNotifications({
          userIds: adminIds,
          payload: notificationBuilders.projectStatusChanged({
            projectName,
            newStatus: 'under_review',
            actionUrl: `/projects/${id}`,
          }),
        });
      }
    }

    return Response.json({ data: { status: 'under_review' } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
