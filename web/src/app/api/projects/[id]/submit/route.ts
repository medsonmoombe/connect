import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, handleRouteError, badRequest, findProjectCreator } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { transitionProject } from '@/lib/project-state-machine';
import { checkRateLimit } from '@/lib/rate-limit';
import { createNotification, createNotifications, notificationBuilders } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import {
  projectSubmittedEmail,
  projectPendingInternalReviewEmail,
  adminProjectSubmittedEmail,
} from '@/lib/email-templates';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/submit
 *
 * - direct mode:          draft|returned → submitted  (platform admins notified)
 * - internal_review mode: draft|returned → pending_internal_review  (reviewer notified)
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;

    const rl = checkRateLimit(user.id, { prefix: 'project-submit', limit: 5, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return Response.json({ error: 'Too many submissions. Try again later.' }, { status: 429 });
    }

    const supabase = getSupabaseAdmin();

    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('developer_id, status, id, created_by')
      .eq('id', id)
      .single();

    if (fetchError || !project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!user.is_platform_admin && project.developer_id !== user.company_id) {
      return forbidden();
    }

    if (project.status !== 'draft' && project.status !== 'returned') {
      return badRequest(`Project is already ${project.status}. Only draft or returned projects can be submitted.`);
    }

    const { data: org } = await supabase
      .from('companies')
      .select('project_submission_mode, internal_reviewer_id, name')
      .eq('id', project.developer_id)
      .single();

    const mode = org?.project_submission_mode ?? 'direct';

    const { data: fullProject } = await supabase
      .from('projects')
      .select('name, technology_type, location_country, project_size_mw, capital_required, capital_structure_type, project_stage')
      .eq('id', id)
      .single();

    const requiredFields = ['name', 'technology_type', 'location_country', 'project_size_mw', 'capital_required', 'capital_structure_type', 'project_stage'];
    const missingFields = requiredFields.filter(f => {
      const val = (fullProject as any)?.[f];
      return val === null || val === undefined || val === '' || val === 0;
    });

    if (missingFields.length > 0) {
      return badRequest(`Missing required fields: ${missingFields.join(', ')}`);
    }

    const { count } = await supabase
      .from('project_documents')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', id);

    if (!count || count < 1) {
      return badRequest('At least 1 document must be uploaded before submitting.');
    }

    const projectName = fullProject?.name || 'Untitled Project';
    const creator = await findProjectCreator(supabase, project.developer_id, project.created_by);

    // Always clear any previous return/rejection reason on resubmit
    await supabase.from('projects').update({ rejection_reason: null }).eq('id', id);

    // ── Internal review mode ──────────────────────────────────────────────────
    if (mode === 'internal_review' && org?.internal_reviewer_id) {
      const result = await transitionProject({
        projectId: id,
        toStatus: 'pending_internal_review',
        actorId: user.id!,
        req,
      });

      if (!result.success) {
        return badRequest(result.error || 'Failed to submit project for internal review');
      }

      // 1. Notify internal reviewer — in-app + email
      await createNotification({
        userId: org.internal_reviewer_id,
        payload: notificationBuilders.projectPendingInternalReview({
          projectName,
          submitterName: creator?.full_name || 'A team member',
          orgName: org?.name || 'your organization',
          actionUrl: `/projects/${id}`,
        }),
      });

      // Fetch reviewer profile for email
      const { data: reviewerProfile } = await supabase
        .from('user_profiles')
        .select('full_name, email')
        .eq('id', org.internal_reviewer_id)
        .single();

      if (reviewerProfile?.email) {
        const tpl = projectPendingInternalReviewEmail({
          projectName,
          submitterName: creator?.full_name || 'A team member',
          orgName: org?.name || 'your organization',
          recipientName: reviewerProfile.full_name || 'Reviewer',
          projectUrl: `/projects/${id}`,
        });
        await sendEmail({
          to: reviewerProfile.email,
          subject: tpl.subject,
          html: tpl.html,
          logType: 'project_pending_internal_review',
          logEntityId: id,
        });
      }

      // 2. Notify creator — in-app + email
      if (creator?.id) {
        await createNotification({
          userId: creator.id,
          payload: notificationBuilders.projectSubmittedInternalReview({
            projectName,
            actionUrl: `/projects/${id}`,
          }),
        });
        if (creator.email) {
          const tpl = projectSubmittedEmail({
            projectName,
            recipientName: creator.full_name || 'there',
            mode: 'internal_review',
          });
          await sendEmail({
            to: creator.email,
            subject: tpl.subject,
            html: tpl.html,
            logType: 'project_submitted_internal',
            logEntityId: id,
          });
        }
      }

      // 3. Notify other org admins (excluding creator and internal reviewer) — in-app only
      const { data: orgAdmins } = await supabase
        .from('company_members')
        .select('user_id')
        .eq('company_id', project.developer_id)
        .in('role', ['OWNER', 'ADMIN'])
        .is('deleted_at', null);

      if (orgAdmins && orgAdmins.length > 0) {
        const excludeIds = new Set([creator?.id, org.internal_reviewer_id].filter(Boolean));
        const adminIds = orgAdmins.map(m => m.user_id).filter(uid => !excludeIds.has(uid));
        if (adminIds.length > 0) {
          await createNotifications({
            userIds: adminIds,
            payload: notificationBuilders.projectSubmittedInternalReview({
              projectName,
              actionUrl: `/projects/${id}`,
            }),
          });
        }
      }

      return Response.json({ data: { status: 'pending_internal_review', mode: 'internal_review' } });
    }

    // ── Direct mode ───────────────────────────────────────────────────────────
    const result = await transitionProject({
      projectId: id,
      toStatus: 'submitted',
      actorId: user.id!,
      req,
    });

    if (!result.success) {
      return badRequest(result.error || 'Failed to submit project');
    }

    // 1. Notify creator — in-app + email
    if (creator?.id) {
      await createNotification({
        userId: creator.id,
        payload: notificationBuilders.projectSubmittedForReview({
          projectName,
          actionUrl: `/projects/${id}`,
        }),
      });
      if (creator.email) {
        const tpl = projectSubmittedEmail({
          projectName,
          recipientName: creator.full_name || 'there',
          mode: 'direct',
        });
        await sendEmail({
          to: creator.email,
          subject: tpl.subject,
          html: tpl.html,
          logType: 'project_submitted',
          logEntityId: id,
        });
      }
    }

    // 2. Notify platform admins — in-app + email
    const { data: platformOrg } = await supabase
      .from('companies')
      .select('id')
      .eq('is_platform_org', true)
      .limit(1)
      .single();

    if (platformOrg?.id) {
      const { data: platformAdmins } = await supabase
        .from('company_members')
        .select('user_id')
        .eq('company_id', platformOrg.id)
        .is('deleted_at', null);

      if (platformAdmins && platformAdmins.length > 0) {
        const adminIds = platformAdmins.map(m => m.user_id);

        await createNotifications({
          userIds: adminIds,
          payload: notificationBuilders.projectSubmittedForReview({
            projectName,
            actionUrl: '/dashboard/admin/projects',
          }),
        });

        // Email each platform admin
        const { data: adminProfiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', adminIds);

        const orgName = org?.name || 'Unknown Organisation';
        for (const admin of adminProfiles ?? []) {
          if (!admin.email) continue;
          const tpl = adminProjectSubmittedEmail({
            projectName,
            orgName,
            projectUrl: `/dashboard/admin/projects`,
          });
          await sendEmail({
            to: admin.email,
            subject: tpl.subject,
            html: tpl.html,
            logType: 'admin_project_submitted',
            logEntityId: id,
          });
        }
      }
    }

    // 3. Notify other org admins (excluding creator) — in-app only
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
          payload: notificationBuilders.projectSubmittedForReview({
            projectName,
            actionUrl: `/projects/${id}`,
          }),
        });
      }
    }

    return Response.json({ data: { status: 'submitted', mode: 'direct' } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
