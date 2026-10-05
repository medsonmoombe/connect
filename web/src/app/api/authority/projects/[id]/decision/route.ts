import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getAuthenticatedUser, forbidden, badRequest, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { canReviewProjects } from '@/lib/admin-access';
import { verifyMfaCookie } from '@/lib/mfa-cookie';
import { transitionProject, hasCompletedAnalysis, type ProjectStatus } from '@/lib/project-state-machine';
import { notifyOrgAdmins } from '@/lib/notify-helpers';
import { notificationBuilders } from '@/lib/notify';
import { triggerMatchingRuns } from '@/lib/matching-trigger';
import * as emailTemplates from '@/lib/email-templates';

type Params = { params: Promise<{ id: string }> };

const decisionSchema = z.object({
  decision: z.enum(['approve', 'return', 'under_review']),
  reason: z.string().trim().max(2000).optional(),
}).refine((data) => data.decision === 'approve' || data.decision === 'under_review' || !!data.reason, {
  message: 'A reason is required when returning a project for changes.',
  path: ['reason'],
});

async function requireMfa(userId: string | null | undefined) {
  if (!userId) return false;
  const cookieStore = await cookies();
  const value = cookieStore.get('mfa_verified')?.value;
  return !!value && await verifyMfaCookie(value, userId);
}

async function triggerMatching(req: NextRequest, projectId: string) {
  // Centralised trigger (lib/matching-trigger).
  void triggerMatchingRuns({ projectId });
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!canReviewProjects(user)) return forbidden('Only platform admins and authority reviewers can make project review decisions.');
    if (!await requireMfa(user.id)) return Response.json({ error: 'MFA verification required for project review decisions.' }, { status: 403 });

    const { id } = await params;
    const parsed = decisionSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.errors[0].message);

    const admin = getSupabaseAdmin();
    const { data: project, error: projectErr } = await admin
      .from('projects')
      .select('id, name, status, developer_id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (projectErr || !project) return Response.json({ error: 'Project not found' }, { status: 404 });
    const { decision, reason: rawReason } = parsed.data;
    const reviewableStatuses = ['scoring', 'scoring_retry', 'draft', 'under_review', 'pending_live'];
    if (!reviewableStatuses.includes(project.status)) {
      return badRequest('This project cannot be reviewed in its current status.');
    }

    const toStatus: ProjectStatus = decision === 'approve' ? 'live' : decision === 'under_review' ? 'under_review' : 'draft';
    const reason = rawReason || (decision === 'approve' ? 'Approved by regulator reviewer' : decision === 'under_review' ? 'Placed under review' : 'Returned for changes');

    // A reviewer must never be asked to review an analysis that does not exist.
    // Approving publishes the project to the matching engine and publishing an
    // unreviewable project is worse than blocking; `under_review` puts it in the
    // review queue behind an empty report. `draft` is always allowed — returning
    // an unanalysed project is a legitimate outcome.
    if (decision === 'approve' || decision === 'under_review') {
      if (!await hasCompletedAnalysis(id)) {
        return badRequest(
          'This project has no completed AI analysis yet. Run (or re-run) the analysis before reviewing it.',
        );
      }
    }

    const patch =
      decision === 'approve'
        ? { rejection_reason: null }
        : decision === 'under_review'
        ? {}
        : { rejection_reason: reason };

    const result = await transitionProject({
      projectId: id,
      toStatus,
      actorId: user.id,
      actorRole: 'platform_admin',
      skipRoleCheck: true,
      reason,
      patch,
      req,
    });

    if (!result.ok) return badRequest(result.error);

    // â”€â”€ Record review history â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const reviewDecision = decision === 'approve' ? 'APPROVE' : decision === 'under_review' ? 'UNDER_REVIEW' : 'RETURN';
    const { error: reviewErr } = await admin.from('project_reviews').insert({
      project_id: id,
      reviewer_id: user.id ?? null,
      decision: reviewDecision,
      comments: parsed.data.reason ?? null,
      from_status: project.status,
      to_status: toStatus,
    });
    if (reviewErr) console.error('[Authority/ProjectDecision] project_reviews insert failed:', reviewErr.message);

    // â”€â”€ Notify developer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (decision === 'approve') {
      await notifyOrgAdmins({
        companyId: project.developer_id,
        payload: notificationBuilders.projectLive({ projectName: project.name }),
        channel: 'both',
        emailTemplate: emailTemplates.projectLiveEmail({ projectName: project.name }),
        emailLogType: 'project_authority_approved',
        excludeUserIds: [user.id!],
      });
      await triggerMatching(req, id);
      return Response.json({ data: { id, status: 'live' } });
    }

    if (decision === 'under_review') {
      await notifyOrgAdmins({
        companyId: project.developer_id,
        payload: notificationBuilders.projectStatusChanged({ projectName: project.name, newStatus: 'Under Review' }),
        channel: 'both',
        emailTemplate: emailTemplates.projectUnderReviewEmail({ projectName: project.name, recipientName: 'there', projectUrl: `/projects/${id}` }),
        emailLogType: 'project_under_review',
        excludeUserIds: [user.id!],
      });
      return Response.json({ data: { id, status: 'under_review' } });
    }

    await notifyOrgAdmins({
      companyId: project.developer_id,
      payload: notificationBuilders.projectStatusChanged({ projectName: project.name, newStatus: 'Returned for changes' }),
      channel: 'both',
      emailTemplate: emailTemplates.projectReturnedEmail({ projectName: project.name, recipientName: 'there', feedback: reason, projectUrl: `/developer/submit?edit=${id}` }),
      emailLogType: 'project_authority_returned',
      excludeUserIds: [user.id!],
    });
    return Response.json({ data: { id, status: 'draft', reason } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}