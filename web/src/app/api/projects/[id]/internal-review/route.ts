import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, handleRouteError, badRequest, findProjectCreator, getIdempotencyResponse, saveIdempotencyResponse } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { transitionProject, hasCompletedAnalysis, STATUS_LABELS, type ProjectStatus } from '@/lib/project-state-machine';
import { createNotification, createNotifications, notificationBuilders } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import {
  projectApprovedInternalEmail,
  projectReturnedEmail,
  adminProjectSubmittedEmail,
} from '@/lib/email-templates';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

const ROUTE = 'POST /api/projects/[id]/internal-review';

const internalReviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().min(1, 'Reason is required').max(2000).optional(),
}).refine(
  (data) => data.action === 'reject' ? !!data.reason : true,
  { message: 'Rejection reason is required', path: ['reason'] }
);

/**
 * POST /api/projects/[id]/internal-review
 *
 * Internal (org-level) reviewer decision on a project submitted via the
 * internal_review flow. The project is expected to be in `scoring` (the
 * submit route moves draft→scoring in internal-review mode).
 *
 *   approve: scoring → under_review   (platform admins + authority see it in the queue)
 *   reject:  scoring → draft          (rejection_reason stored, creator + org admins notified)
 *
 * Status moves are atomic CAS in `transitionProject`; the rejection reason is
 * written in the same UPDATE via `patch` so there is no separate write that
 * could fail independently. Idempotent via `Idempotency-Key`.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;

    const body = await req.json();
    const parsed = internalReviewSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0].message);
    }

    // ── Idempotency replay ──────────────────────────────────────────────────
    if (user.id) {
      const replay = await getIdempotencyResponse(req, user.id, ROUTE);
      if (replay) return replay;
    }

    const supabase = getSupabaseAdmin();

    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('developer_id, status, name, created_by')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError || !project) return Response.json({ error: 'Project not found' }, { status: 404 });

    const from = project.status as ProjectStatus;
    if (from !== 'scoring') {
      return badRequest(`Project is ${STATUS_LABELS[from]}. Internal review only applies to projects in review.`);
    }

    const { data: org } = await supabase
      .from('companies')
      .select('project_submission_mode, internal_reviewer_id, name')
      .eq('id', project.developer_id)
      .maybeSingle();

    if (!org || org.project_submission_mode !== 'internal_review') {
      return badRequest('This organization does not use internal review. Use the submit endpoint.');
    }

    if (!user.is_platform_admin && org.internal_reviewer_id !== user.id) {
      return forbidden();
    }

    const projectName = project.name || 'Untitled Project';
    const creator = await findProjectCreator(supabase, project.developer_id, project.created_by);
    const action = parsed.data.action;

    // `scoring` is also the status a project sits in while its analysis job is
    // still running, so an internal reviewer could otherwise approve straight
    // into `under_review` ahead of the AI and publish a report with nothing in it.
    if (action === 'approve' && !await hasCompletedAnalysis(id)) {
      return badRequest(
        'This project has no completed AI analysis yet. Wait for the analysis to finish, or re-run it, before approving.',
      );
    }

    // ── Atomic transition ────────────────────────────────────────────────────
    // After approve the project moves to `under_review` (was `pending_live`),
    // so the authority / platform-admin review queue picks it up.
    const toStatus: ProjectStatus = action === 'approve' ? 'under_review' : 'draft';
    const patch = action === 'reject'
      ? { rejection_reason: parsed.data.reason }
      : { rejection_reason: null };

    const result = await transitionProject({
      projectId: id,
      toStatus,
      actorId: user.id,
      actorRole: 'reviewer',
      reason: action === 'approve' ? 'Approved by internal reviewer' : parsed.data.reason,
      patch,
      req,
    });

    if (!result.ok) {
      return mapTransitionError(req, user.id, ROUTE, result);
    }

    // ── Record review history ─────────────────────────────────────────────
    await supabase.from('project_reviews').insert({
      project_id: id,
      reviewer_id: user.id ?? null,
      decision: action === 'approve' ? 'APPROVE' : 'RETURN',
      comments: action === 'approve' ? null : (parsed.data.reason ?? null),
      from_status: from,
      to_status: toStatus,
    });

    // ── Notifications ─────────────────────────────────────────────────────────
    if (action === 'approve') {
      await notifyCreatorApproved({ creator, projectName, projectId: id });
      await notifyOtherOrgAdmins({
        supabase, developerId: project.developer_id, exclude: [creator?.id],
        payload: notificationBuilders.projectApprovedByInternal({ projectName, actionUrl: `/projects/${id}` }),
      });
      await notifyPlatformAdmins({ supabase, orgName: org.name || 'Unknown Organisation', projectName, projectId: id });
      const respBody = { data: { status: 'under_review' } };
      if (user.id) await saveIdempotencyResponse(req, user.id, ROUTE, respBody, 200);
      return Response.json(respBody);
    }

    // reject path
    const feedback = parsed.data.reason || 'No reason provided';
    await notifyCreatorReturned({ creator, projectName, feedback, projectId: id });
    await notifyOtherOrgAdmins({
      supabase, developerId: project.developer_id, exclude: [creator?.id, user.id],
      payload: notificationBuilders.projectInternalRejected({ projectName, reason: feedback, actionUrl: `/projects/${id}` }),
    });
    const respBody = { data: { status: 'draft', feedback } };
    if (user.id) await saveIdempotencyResponse(req, user.id, ROUTE, respBody, 200);
    return Response.json(respBody);
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// ── Transition-error → HTTP ───────────────────────────────────────────────────
type TransitionErr = Extract<Awaited<ReturnType<typeof transitionProject>>, { ok: false }>;
function mapTransitionError(req: NextRequest, userId: string | null, route: string, r: TransitionErr) {
  const statusByCode: Record<TransitionErr['code'], number> = {
    NOT_FOUND: 404, INVALID_TRANSITION: 400, FORBIDDEN: 403,
    PRECONDITION: 412, CONFLICT: 409, UPDATE_FAILED: 500,
  };
  const status = statusByCode[r.code];
  const body = { error: r.error };
  if (userId) saveIdempotencyResponse(req, userId, route, body, status).catch(() => {});
  return Response.json(body, { status });
}

// ── Notification helpers ──────────────────────────────────────────────────────
async function notifyCreatorApproved(args: { creator: any; projectName: string; projectId: string }) {
  const { creator, projectName, projectId } = args;
  if (!creator?.id) return;
  await createNotification({
    userId: creator.id,
    payload: notificationBuilders.projectApprovedByInternal({ projectName, actionUrl: `/projects/${projectId}` }),
  });
  if (!creator.email) return;
  const tpl = projectApprovedInternalEmail({ projectName, recipientName: creator.full_name || 'there', projectUrl: `/projects/${projectId}` });
  await sendEmail({ to: creator.email, subject: tpl.subject, html: tpl.html, logType: 'project_approved_internal', logEntityId: projectId });
}

async function notifyCreatorReturned(args: { creator: any; projectName: string; feedback: string; projectId: string }) {
  const { creator, projectName, feedback, projectId } = args;
  if (!creator?.id) return;
  await createNotification({
    userId: creator.id,
    payload: notificationBuilders.projectInternalRejected({ projectName, reason: feedback, actionUrl: `/projects/${projectId}` }),
  });
  if (!creator.email) return;
  const tpl = projectReturnedEmail({ projectName, recipientName: creator.full_name || 'here', feedback, projectUrl: `/projects/${projectId}` });
  await sendEmail({ to: creator.email, subject: tpl.subject, html: tpl.html, logType: 'project_internal_rejected', logEntityId: projectId });
}

async function notifyOtherOrgAdmins(args: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  developerId: string; exclude: (string | undefined)[];
  payload: ReturnType<typeof notificationBuilders.projectApprovedByInternal>;
}) {
  const { supabase, developerId, exclude, payload } = args;
  const { data: orgAdmins } = await supabase
    .from('company_members').select('user_id').eq('company_id', developerId)
    .in('role', ['OWNER', 'ADMIN']).is('deleted_at', null);
  if (!orgAdmins?.length) return;
  const excl = new Set(exclude.filter(Boolean) as string[]);
  const adminIds = orgAdmins.map(m => m.user_id).filter(uid => !excl.has(uid));
  if (adminIds.length) await createNotifications({ userIds: adminIds, payload });
}

async function notifyPlatformAdmins(args: { supabase: ReturnType<typeof getSupabaseAdmin>; orgName: string; projectName: string; projectId: string }) {
  const { supabase, orgName, projectName, projectId } = args;
  const { data: platformOrg } = await supabase
    .from('companies').select('id').eq('is_platform_org', true).limit(1).maybeSingle();
  if (!platformOrg?.id) return;
  const { data: platformAdmins } = await supabase
    .from('company_members').select('user_id').eq('company_id', platformOrg.id).is('deleted_at', null);
  if (!platformAdmins?.length) return;
  const adminIds = platformAdmins.map(m => m.user_id);
  await createNotifications({ userIds: adminIds, payload: notificationBuilders.projectSubmittedForReview({ projectName, actionUrl: '/admin/projects' }) });
  const { data: adminProfiles } = await supabase.from('user_profiles').select('id, email').in('id', adminIds);
  for (const a of adminProfiles ?? []) {
    if (!a.email) continue;
    const tpl = adminProjectSubmittedEmail({ projectName, orgName, projectUrl: '/admin/projects' });
    await sendEmail({ to: a.email, subject: tpl.subject, html: tpl.html, logType: 'admin_project_submitted', logEntityId: projectId });
  }
}
