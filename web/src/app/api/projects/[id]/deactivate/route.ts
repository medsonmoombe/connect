import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, handleRouteError, badRequest } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { transitionProject } from '@/lib/project-state-machine';
import { notifyOrgAdmins } from '@/lib/notify-helpers';
import { notificationBuilders } from '@/lib/notify';
import * as emailTemplates from '@/lib/email-templates';

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/deactivate — live → deactivated
// POST /api/projects/[id]/deactivate?reactivate=true — deactivated → live
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const reactivate = searchParams.get('reactivate') === 'true';

    const supabase = getSupabaseAdmin();
    const { data: project } = await supabase
      .from('projects')
      .select('developer_id, status, name')
      .eq('id', id)
      .single();

    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    // Only owner org admins or platform admins
    const membership = (user.company_members as any[])?.[0];
    const isOrgAdmin = membership && ['OWNER', 'ADMIN'].includes(membership.role);
    const isOwner = project.developer_id === user.company_id;

    if (!user.is_platform_admin && !(isOwner && isOrgAdmin)) return forbidden();

    if (reactivate) {
      if (project.status !== 'deactivated') return badRequest('Project is not deactivated.');
      const result = await transitionProject({ projectId: id, toStatus: 'live', actorId: user.id!, actorRole: user.is_platform_admin ? 'platform_admin' : 'developer', skipRoleCheck: true, req });
      if (!result.ok) return badRequest(result.error);
      await notifyOrgAdmins({
        companyId: project.developer_id,
        payload: notificationBuilders.projectStatusChanged({ projectName: project.name, newStatus: 'live' }),
        channel: 'both',
        emailTemplate: emailTemplates.projectStatusEmail({ projectName: project.name, newStatus: 'live', recipientName: 'there' }),
        emailLogType: 'project_reactivated',
        excludeUserIds: [user.id!],
      });
      return Response.json({ data: { status: 'live' } });
    }

    if (project.status !== 'live' && project.status !== 'pending_live') return badRequest('Only live or pending_live projects can be deactivated.');

    const result = await transitionProject({ projectId: id, toStatus: 'deactivated', actorId: user.id!, actorRole: user.is_platform_admin ? 'platform_admin' : 'developer', skipRoleCheck: true, req });
    if (!result.ok) return badRequest(result.error);

    await notifyOrgAdmins({
      companyId: project.developer_id,
      payload: notificationBuilders.projectStatusChanged({ projectName: project.name, newStatus: 'deactivated' }),
      channel: 'both',
      emailTemplate: emailTemplates.projectStatusEmail({ projectName: project.name, newStatus: 'deactivated', recipientName: 'there' }),
      emailLogType: 'project_deactivated',
      excludeUserIds: [user.id!],
    });

    return Response.json({ data: { status: 'deactivated' } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
