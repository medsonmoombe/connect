import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { notifyUser, notificationBuilders } from '@/lib/notify';
import { notifyOrgAdmins } from '@/lib/notify-helpers';
import * as emailTemplates from '@/lib/email-templates';
import { transitionProject, type ProjectStatus } from '@/lib/project-state-machine';

type Params = { params: Promise<{ id: string }> };

// ── GET /api/admin/projects/[id]
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden('Platform administrators only.');
    const { id } = await params;
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('projects')
      .select(`
        *,
        developer:companies!projects_developer_id_fkey(
          id, name, country, website, description, team_size, years_operating, registration_number
        ),
        documents:project_documents(*),
        scores:project_scores(*),
        tech_requirements:project_tech_requirements(*)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (error || !data) return badRequest('Project not found');
    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// ── PATCH /api/admin/projects/[id]
// Handles sub-actions via `action` field:
//   action: 'force_state'    — force project to a new status with a required note
//   action: 'force_live'     — bypass delay: set live + is_visible_to_investors = true immediately
//   action: 'override_score' — manually set score fields with a note
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden('Only platform administrators can manage projects from the admin panel. Contact your platform support team if you need to make changes.');

    const { id } = await params;
    const body = await req.json();
    const { action } = body;
    const admin = getSupabaseAdmin();

    // ── Force state transition ───────────────────────────────────────────────
    if (action === 'force_state') {
      const { status, note } = body as { status: ProjectStatus; note: string };

      if (!note?.trim()) return badRequest('A note is required for forced state transitions');

      const result = await transitionProject({
        projectId: id,
        toStatus: status as ProjectStatus,
        actorId: user.id,
        actorRole: 'platform_admin',
        skipRoleCheck: true,
        reason: note,
        req,
      });

      if (!result.ok) {
        return badRequest(result.error);
      }

      const { data: project } = await admin
        .from('projects')
        .select('name, developer_id')
        .eq('id', id)
        .single();

      if (project?.developer_id) {
        await notifyOrgAdmins({
          companyId: project.developer_id,
          payload: notificationBuilders.projectStatusChanged({
            projectName: project.name,
            newStatus: status,
          }),
          emailTemplate: {
            subject: `Project status updated: ${project.name} → ${status}`,
            html: `<p>Project "<strong>${project.name}</strong>" status has been changed to <strong>${status}</strong> by a platform administrator.</p><p>Reason: ${note}</p>`,
          },
          emailLogType: 'admin_state_override',
          excludeUserIds: [user.id],
        });
      }

      return Response.json({ data: { status, note } });
    }

    // ── Force live (bypass scores_visible_at delay) ──────────────────────────
    if (action === 'force_live') {
      const { note } = body as { note: string };
      if (!note?.trim()) return badRequest('A note is required');

      const { data: project, error: fetchErr } = await admin
        .from('projects')
        .select('id, name, status, developer_id')
        .is('deleted_at', null)
        .eq('id', id)
        .single();

      if (fetchErr || !project) return badRequest('Project not found');
      if (project.status !== 'pending_live') return badRequest('Project must be in pending_live status to force-activate');

      const now = new Date().toISOString();
      const { error } = await admin
        .from('projects')
        .update({
          status: 'live',
          is_visible_to_investors: true,
          scores_visible_at: now,
          admin_note: note,
          reviewed_by: user.id,
          reviewed_at: now,
        })
        .eq('id', id);

      if (error) {
        console.error('[Admin/Projects] Force live error:', error.message);
        return serverError();
      }

      await writeAuditLog({
        userId: user.id,
        action: 'PROJECT_FORCE_ACTIVATED',
        entityType: 'projects',
        entityId: id,
        before: { is_visible_to_investors: false },
        after: { is_visible_to_investors: true, note },
        req,
        blocking: true,
      });

      // Notify developer org admins (email + in-app)
      await notifyOrgAdmins({
        companyId: project.developer_id,
        payload: notificationBuilders.projectLive({ projectName: project.name }),
        channel: 'both',
        emailTemplate: emailTemplates.projectLiveEmail({ projectName: project.name }),
        emailLogType: 'project_force_live',
        excludeUserIds: [user.id!],
      });

      return Response.json({ data: { id, is_visible_to_investors: true } });
    }

    // ── Score override ───────────────────────────────────────────────────────
    if (action === 'override_score') {
      const { scores, note } = body as { scores: Record<string, number>; note: string };

      if (!note?.trim()) return badRequest('A note is required for score overrides');

      const sanitized = Object.fromEntries(
        Object.entries(scores).map(([k, v]) => [k, Math.min(100, Math.max(0, Math.round(Number(v))))])
      );

      const { data, error } = await admin
        .from('project_scores')
        .upsert({
          ...sanitized,
          project_id: id,
          overridden_by: user.id,
          overridden_at: new Date().toISOString(),
          override_note: note,
        }, { onConflict: 'project_id' })
        .select()
        .single();

      if (error) {
        console.error('[Admin/Projects] Score override error:', error.message);
        return serverError();
      }

      await writeAuditLog({
        userId: user.id,
        action: 'PROJECT_SCORE_OVERRIDDEN',
        entityType: 'project_scores',
        entityId: id,
        after: { ...sanitized, note },
        req,
        blocking: true,
      });

      // Notify org admins about score override
      const { data: scoreProject } = await admin
        .from('projects')
        .select('name, developer_id')
        .eq('id', id)
        .single();

      if (scoreProject) {
        await notifyOrgAdmins({
          companyId: scoreProject.developer_id,
          payload: notificationBuilders.systemAnnouncement({
            title: 'Project scores updated by admin',
            body: `Scores for "${scoreProject.name}" were manually adjusted by a platform admin. Reason: ${note}`,
          }),
          channel: 'both',
          emailTemplate: emailTemplates.projectStatusEmail({
            projectName: scoreProject.name,
            newStatus: 'scores_updated',
            note,
            recipientName: 'there',
          }),
          emailLogType: 'project_score_override',
          excludeUserIds: [user.id!],
        });
      }

      return Response.json({ data });
    }

    return badRequest('Invalid action. Use force_state or override_score');
  } catch (e: any) {
    return handleRouteError(e);
  }
}
