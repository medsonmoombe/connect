import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, handleRouteError, badRequest, writeAuditLog, findProjectCreator } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { transitionProject } from '@/lib/project-state-machine';
import { createNotification, createNotifications, notificationBuilders } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import {
  projectApprovedInternalEmail,
  projectReturnedEmail,
  adminProjectSubmittedEmail,
} from '@/lib/email-templates';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

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
 * approve: pending_internal_review → submitted  (platform admins + creator notified)
 * reject:  pending_internal_review → returned   (creator + org admins notified with feedback)
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

    const supabase = getSupabaseAdmin();

    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('developer_id, status, name, created_by')
      .eq('id', id)
      .single();

    if (fetchError || !project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.status !== 'pending_internal_review') {
      return badRequest(`Project is ${project.status}. Internal review only applies to projects pending internal review.`);
    }

    const { data: org } = await supabase
      .from('companies')
      .select('project_submission_mode, internal_reviewer_id, name')
      .eq('id', project.developer_id)
      .single();

    if (!org || org.project_submission_mode !== 'internal_review') {
      return badRequest('This organization does not use internal review. Use the standard submit endpoint.');
    }

    if (!user.is_platform_admin && org.internal_reviewer_id !== user.id) {
      return forbidden();
    }

    const projectName = project.name || 'Untitled Project';
    const creator = await findProjectCreator(supabase, project.developer_id, project.created_by);

    // ── APPROVE ───────────────────────────────────────────────────────────────
    if (parsed.data.action === 'approve') {
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
        return badRequest(`Cannot approve: missing required fields: ${missingFields.join(', ')}`);
      }

      const { count } = await supabase
        .from('project_documents')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id);

      if (!count || count < 1) {
        return badRequest('Cannot approve: at least 1 document must be uploaded.');
      }

      const result = await transitionProject({
        projectId: id,
        toStatus: 'submitted',
        actorId: user.id!,
        reason: 'Approved by internal reviewer',
        req,
      });

      if (!result.success) {
        return badRequest(result.error || 'Failed to submit project');
      }

      await supabase.from('projects').update({ rejection_reason: null }).eq('id', id);

      // 1. Notify creator — in-app + email
      if (creator?.id) {
        await createNotification({
          userId: creator.id,
          payload: notificationBuilders.projectApprovedByInternal({
            projectName,
            actionUrl: `/projects/${id}`,
          }),
        });
        if (creator.email) {
          const tpl = projectApprovedInternalEmail({
            projectName,
            recipientName: creator.full_name || 'there',
            projectUrl: `/projects/${id}`,
          });
          await sendEmail({
            to: creator.email,
            subject: tpl.subject,
            html: tpl.html,
            logType: 'project_approved_internal',
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
            payload: notificationBuilders.projectApprovedByInternal({
              projectName,
              actionUrl: `/projects/${id}`,
            }),
          });
        }
      }

      // 3. Notify platform admins — in-app + email
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

          const { data: adminProfiles } = await supabase
            .from('user_profiles')
            .select('id, full_name, email')
            .in('id', adminIds);

          for (const admin of adminProfiles ?? []) {
            if (!admin.email) continue;
            const tpl = adminProjectSubmittedEmail({
              projectName,
              orgName: org?.name || 'Unknown Organisation',
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

      return Response.json({ data: { status: 'submitted' } });
    }

    // ── RETURN (reject) ───────────────────────────────────────────────────────
    await writeAuditLog({
      userId: user.id,
      action: 'PROJECT_INTERNAL_REJECTED',
      entityType: 'projects',
      entityId: id,
      after: { reason: parsed.data.reason },
      req,
    });

    const returnResult = await transitionProject({
      projectId: id,
      toStatus: 'returned',
      actorId: user.id!,
      reason: parsed.data.reason,
      req,
    });

    if (!returnResult.success) {
      return badRequest(returnResult.error || 'Failed to return project');
    }

    await supabase
      .from('projects')
      .update({ rejection_reason: parsed.data.reason })
      .eq('id', id);

    const feedback = parsed.data.reason || 'No reason provided';

    // 1. Notify creator — in-app + email
    if (creator?.id) {
      await createNotification({
        userId: creator.id,
        payload: notificationBuilders.projectInternalRejected({
          projectName,
          reason: feedback,
          actionUrl: `/projects/${id}`,
        }),
      });
      if (creator.email) {
        const tpl = projectReturnedEmail({
          projectName,
          recipientName: creator.full_name || 'there',
          feedback,
          projectUrl: `/projects/${id}`,
        });
        await sendEmail({
          to: creator.email,
          subject: tpl.subject,
          html: tpl.html,
          logType: 'project_internal_rejected',
          logEntityId: id,
        });
      }
    }

    // 2. Notify other org admins (excluding creator and reviewer) — in-app only
    const { data: orgAdmins } = await supabase
      .from('company_members')
      .select('user_id')
      .eq('company_id', project.developer_id)
      .in('role', ['OWNER', 'ADMIN'])
      .is('deleted_at', null);

    if (orgAdmins && orgAdmins.length > 0) {
      const excludeIds = new Set([creator?.id, user.id].filter(Boolean));
      const adminIds = orgAdmins.map(m => m.user_id).filter(uid => !excludeIds.has(uid));
      if (adminIds.length > 0) {
        await createNotifications({
          userIds: adminIds,
          payload: notificationBuilders.projectInternalRejected({
            projectName,
            reason: feedback,
            actionUrl: `/projects/${id}`,
          }),
        });
      }
    }

    return Response.json({ data: { status: 'returned', feedback } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
