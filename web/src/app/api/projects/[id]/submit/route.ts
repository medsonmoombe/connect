import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, handleRouteError, badRequest, findProjectCreator, getIdempotencyResponse, saveIdempotencyResponse } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { transitionProject, resolveActorRole, STATUS_LABELS, type ProjectStatus } from '@/lib/project-state-machine';
import { checkRateLimit } from '@/lib/rate-limit';
import { createNotification, createNotifications, notificationBuilders } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import {
  projectSubmittedEmail,
  projectPendingInternalReviewEmail,
  adminProjectSubmittedEmail,
} from '@/lib/email-templates';

type Params = { params: Promise<{ id: string }> };

const ROUTE = 'POST /api/projects/[id]/submit';

/**
 * POST /api/projects/[id]/submit
 *
 * Entry point of the developer-owned project lifecycle.
 *
 *   - internal_review mode:  draft → scoring    (internal reviewer notified; AI
 *                                              scoring also fires from /analyze
 *                                              which then moves scoring → under_review)
 *   - direct mode:           draft → under_review  (AI analysis runs from the
 *                                              submit page; analyze route lands
 *                                              on under_review)
 *
 * `pending_live` and `returned` are no longer used as transitions for the
 * developer flow. The review queue (`under_review`) is now the explicit
 * authority / platform-admin review state.
 *
 * Idempotent (PRD §14): an `Idempotency-Key` header replays the prior response
 * for 24h. The actual status move is an atomic CAS in `transitionProject`, so
 * a double-submit never double-transitions.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;

    // ── Idempotency replay (before any work) ────────────────────────────────
    if (user.id) {
      const replay = await getIdempotencyResponse(req, user.id, ROUTE);
      if (replay) return replay;
    }

    // ── Per-user rate limit ─────────────────────────────────────────────────
    if (user.id) {
      const rl = await checkRateLimit(user.id, { prefix: 'project-submit', limit: 5, windowMs: 60 * 60_000 });
      if (!rl.allowed) {
        return Response.json({ error: 'Too many submissions. Try again later.' }, { status: 429 });
      }
    }

    const supabase = getSupabaseAdmin();

    // ── Load project + owning org ───────────────────────────────────────────
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('id, developer_id, status, created_by')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError || !project) return Response.json({ error: 'Project not found' }, { status: 404 });

    if (!user.is_platform_admin && project.developer_id !== user.company_id) {
      return forbidden();
    }

    // Only draft projects can be submitted (previously `returned` is now `draft`).
    const from = project.status as ProjectStatus;
    if (from !== 'draft') {
      return badRequest(`Project is ${STATUS_LABELS[from]}. Only draft projects can be submitted.`);
    }

    const { data: org } = await supabase
      .from('companies')
      .select('project_submission_mode, internal_reviewer_id, name')
      .eq('id', project.developer_id)
      .maybeSingle();

    // Treat a missing org row as direct-mode — don't block resubmission
    const orgName = org?.name || 'Unknown Organisation';

    const mode = (org?.project_submission_mode ?? 'direct') as 'direct' | 'internal_review';
    const isInternalReview = mode === 'internal_review' && !!org?.internal_reviewer_id;

    // Target status + role for the transition.
    // Both modes land in `scoring` first; the analyze route drives the
    // scoring → under_review transition once AI analysis completes.
    const toStatus: ProjectStatus = 'scoring';
    const actorRole = resolveActorRole({
      isPlatformAdmin: user.is_platform_admin,
      developerId: project.developer_id,
      userCompanyId: user.company_id,
    });

    if (!actorRole) return forbidden();

    const creator = await findProjectCreator(supabase, project.developer_id, project.created_by);

    const { data: fullProject } = await supabase
      .from('projects')
      .select('name, rejection_reason')
      .eq('id', id)
      .single();
    const projectName = fullProject?.name || 'Untitled Project';
    const isResubmission = !!fullProject?.rejection_reason;

    // Clear any prior rejection reason on this resubmit.
    const patch = { rejection_reason: null };

    // ── Atomic transition (CAS + precondition checks live in the machine) ──
    const result = await transitionProject({
      projectId: id,
      toStatus,
      actorId: user.id,
      actorRole,
      patch,
      req,
    });

    if (!result.ok) {
      return mapTransitionError(req, user.id, ROUTE, result);
    }

    // ── Notifications (only the winner reaches here) ───────────────────────
    if (isInternalReview) {
      await notifyInternalReviewer({ supabase, org: org!, projectName, creator, projectId: id });
      await notifyCreatorSubmitted({ creator, projectName, mode: 'internal_review', projectId: id });
      await notifyOtherOrgAdmins({
        supabase, developerId: project.developer_id, creatorId: creator?.id,
        reviewerId: org!.internal_reviewer_id!, projectName, projectId: id,
        builder: notificationBuilders.projectSubmittedInternalReview,
      });
    } else {
      await notifyCreatorSubmitted({ creator, projectName, mode: 'direct', projectId: id });
      await notifyPlatformAdmins({ supabase, orgName, projectName, projectId: id });
      await notifyOtherOrgAdmins({
        supabase, developerId: project.developer_id, creatorId: creator?.id,
        reviewerId: null, projectName, projectId: id,
        builder: notificationBuilders.projectSubmittedForReview,
      });
    }

    // ── Notify previous reviewers on resubmission ──────────────────────────
    if (isResubmission) {
      await notifyPreviousReviewers({ supabase, projectId: id, projectName, submitterId: user.id });
    }

    const body = { data: { status: toStatus, mode: isInternalReview ? 'internal_review' : 'direct' } };
    if (user.id) await saveIdempotencyResponse(req, user.id, ROUTE, body, 200);
    return Response.json(body);
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// ── Transition-error → HTTP response (shared shape across project routes) ────
type TransitionErr = Extract<Awaited<ReturnType<typeof transitionProject>>, { ok: false }>;
function mapTransitionError(req: NextRequest, userId: string | null, route: string, r: TransitionErr) {
  const statusByCode: Record<TransitionErr['code'], number> = {
    NOT_FOUND: 404,
    INVALID_TRANSITION: 400,
    FORBIDDEN: 403,
    PRECONDITION: 412,
    CONFLICT: 409,
    UPDATE_FAILED: 500,
  };
  const status = statusByCode[r.code];
  const body = { error: r.error };
  if (userId) saveIdempotencyResponse(req, userId, route, body, status).catch(() => {});
  return Response.json(body, { status });
}

// ── Notification helpers (keep the route body declarative) ───────────────────
async function notifyInternalReviewer(args: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  org: { internal_reviewer_id: string; name?: string };
  projectName: string; creator: any; projectId: string;
}) {
  const { supabase, org, projectName, creator, projectId } = args;
  await createNotification({
    userId: org.internal_reviewer_id,
    payload: notificationBuilders.projectPendingInternalReview({
      projectName,
      submitterName: creator?.full_name || 'A team member',
      orgName: org.name || 'your organization',
      actionUrl: `/projects/${projectId}`,
    }),
  });
  const { data: reviewerProfile } = await supabase
    .from('user_profiles').select('full_name, email').eq('id', org.internal_reviewer_id).maybeSingle();
  if (reviewerProfile?.email) {
    const tpl = projectPendingInternalReviewEmail({
      projectName,
      submitterName: creator?.full_name || 'A team member',
      orgName: org.name || 'your organization',
      recipientName: reviewerProfile.full_name || 'Reviewer',
      projectUrl: `/projects/${projectId}`,
    });
    await sendEmail({ to: reviewerProfile.email, subject: tpl.subject, html: tpl.html, logType: 'project_pending_internal_review', logEntityId: projectId });
  }
}

async function notifyCreatorSubmitted(args: { creator: any; projectName: string; mode: 'direct' | 'internal_review'; projectId: string }) {
  const { creator, projectName, mode, projectId } = args;
  if (!creator?.id) return;
  await createNotification({
    userId: creator.id,
    payload: mode === 'internal_review'
      ? notificationBuilders.projectSubmittedInternalReview({ projectName, actionUrl: `/projects/${projectId}` })
      : notificationBuilders.projectSubmittedForReview({ projectName, actionUrl: `/projects/${projectId}` }),
  });
  if (!creator.email) return;
  const tpl = projectSubmittedEmail({ projectName, recipientName: creator.full_name || 'there', mode });
  await sendEmail({ to: creator.email, subject: tpl.subject, html: tpl.html, logType: mode === 'internal_review' ? 'project_submitted_internal' : 'project_submitted', logEntityId: projectId });
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

/**
 * On resubmission of a returned project, notify:
 *  1. All previous reviewers (from project_reviews table)
 *  2. All current platform admins + authority users not already covered
 */
async function notifyPreviousReviewers(args: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  projectId: string;
  projectName: string;
  submitterId: string | null;
}) {
  const { supabase, projectId, projectName, submitterId } = args;

  // Collect previous reviewer IDs from review history
  const { data: reviews } = await supabase
    .from('project_reviews')
    .select('reviewer_id')
    .eq('project_id', projectId)
    .not('reviewer_id', 'is', null);
  const previousReviewerIds = [...new Set((reviews ?? []).map(r => r.reviewer_id as string))];

  // Also collect all platform admin IDs
  const { data: platformOrg } = await supabase
    .from('companies').select('id').eq('is_platform_org', true).limit(1).maybeSingle();
  let platformAdminIds: string[] = [];
  if (platformOrg?.id) {
    const { data: members } = await supabase
      .from('company_members').select('user_id').eq('company_id', platformOrg.id).is('deleted_at', null);
    platformAdminIds = (members ?? []).map(m => m.user_id);
  }

  // Also collect authority users
  const { data: authorityMembers } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('is_authority_user', true)
    .is('deleted_at', null);
  const authorityIds = (authorityMembers ?? []).map(m => m.id);

  const allReviewerIds = [...new Set([
    ...previousReviewerIds,
    ...platformAdminIds,
    ...authorityIds,
  ])].filter(uid => uid !== submitterId);

  if (!allReviewerIds.length) return;

  const { data: profiles } = await supabase
    .from('user_profiles').select('id, email, full_name').in('id', allReviewerIds);

  const payload = {
    type: 'project_status' as const,
    title: `Project resubmitted for review`,
    body: `"${projectName}" has been updated and resubmitted by the developer. It is now awaiting your review.`,
    entity_type: 'projects' as const,
    action_url: '/admin/review',
  };

  // In-app notifications
  const rows = allReviewerIds.map(uid => ({
    user_id: uid,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    entity_type: payload.entity_type,
    entity_id: projectId,
    action_url: payload.action_url,
  }));
  await supabase.from('notifications').insert(rows);

  // Emails
  for (const profile of profiles ?? []) {
    if (!profile.email) continue;
    const tpl = adminProjectSubmittedEmail({
      projectName,
      orgName: 'Developer',
      projectUrl: `/admin/review/${projectId}`,
    });
    await sendEmail({
      to: profile.email,
      subject: `[Resubmission] ${projectName} — awaiting review`,
      html: tpl.html,
      logType: 'project_resubmitted_reviewer',
      logEntityId: projectId,
    });
  }
}

async function notifyOtherOrgAdmins(args: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  developerId: string; creatorId?: string; reviewerId?: string | null;
  projectName: string; projectId: string;
  builder: typeof notificationBuilders.projectSubmittedForReview;
}) {
  const { supabase, developerId, creatorId, reviewerId, projectName, projectId, builder } = args;
  const { data: orgAdmins } = await supabase
    .from('company_members').select('user_id').eq('company_id', developerId)
    .in('role', ['OWNER', 'ADMIN']).is('deleted_at', null);
  if (!orgAdmins?.length) return;
  const exclude = new Set([creatorId, reviewerId].filter(Boolean) as string[]);
  const adminIds = orgAdmins.map(m => m.user_id).filter(uid => !exclude.has(uid));
  if (adminIds.length) {
    await createNotifications({ userIds: adminIds, payload: builder({ projectName, actionUrl: `/projects/${projectId}` }) });
  }
}

