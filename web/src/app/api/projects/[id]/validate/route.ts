import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, handleRouteError, badRequest, findProjectCreator } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { transitionProject } from '@/lib/project-state-machine';
import { createNotification, createNotifications, notificationBuilders } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import { projectValidatedEmail } from '@/lib/email-templates';
import { getReviewRecommendation } from '@/lib/review-intelligence';

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/validate — under_review → validated (platform admin only)
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

    if (project.status !== 'under_review') {
      return badRequest(`Project is ${project.status}. Only projects under review can be validated.`);
    }

    // Block validation if no AI analysis has been run
    const { data: scores } = await supabase
      .from('project_scores')
      .select('*')
      .eq('project_id', id)
      .maybeSingle();

    if (!scores) {
      return badRequest('AI analysis must be completed before validating this project.');
    }

    const recommendation = getReviewRecommendation(scores);
    if (!recommendation.canValidate) {
      return badRequest(`${recommendation.title}. ${recommendation.message}`);
    }

    const result = await transitionProject({
      projectId: id,
      toStatus: 'validated',
      actorId: user.id!,
      req,
    });

    if (!result.success) {
      return badRequest(result.error || 'Failed to validate project');
    }

    const projectName = project.name || 'Untitled Project';

    await supabase.from('projects').update({ rejection_reason: null }).eq('id', id);

    const creator = await findProjectCreator(supabase, project.developer_id, project.created_by);

    // 1. Notify creator — in-app + email
    if (creator?.id) {
      await createNotification({
        userId: creator.id,
        payload: notificationBuilders.projectValidated({
          projectName,
          actionUrl: `/projects/${id}`,
        }),
      });
      if (creator.email) {
        const tpl = projectValidatedEmail({
          projectName,
          recipientName: creator.full_name || 'there',
          projectUrl: `/projects/${id}`,
        });
        await sendEmail({
          to: creator.email,
          subject: tpl.subject,
          html: tpl.html,
          logType: 'project_validated',
          logEntityId: id,
        });
      }
    }

    // 2. Notify other org admins (excluding creator) — in-app + email
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
          payload: notificationBuilders.projectValidated({
            projectName,
            actionUrl: `/projects/${id}`,
          }),
        });

        // Email org admins too
        const { data: adminProfiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', adminIds);

        for (const admin of adminProfiles ?? []) {
          if (!admin.email) continue;
          const tpl = projectValidatedEmail({
            projectName,
            recipientName: admin.full_name || 'there',
            projectUrl: `/projects/${id}`,
          });
          await sendEmail({
            to: admin.email,
            subject: tpl.subject,
            html: tpl.html,
            logType: 'project_validated',
            logEntityId: id,
          });
        }
      }
    }

    // Trigger scoring + matching after final platform validation
    triggerScoringAndMatching(id).catch(err => {
      console.error('[Validate] Background scoring/matching failed:', err);
    });

    return Response.json({ data: { status: 'validated', recommendation } });
  } catch (e) {
    return handleRouteError(e);
  }
}

async function triggerScoringAndMatching(projectId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    await fetch(`${baseUrl}/api/matching/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    });
  } catch (err) {
    console.error('[Validate] Matching engine trigger failed:', err);
  }
}
