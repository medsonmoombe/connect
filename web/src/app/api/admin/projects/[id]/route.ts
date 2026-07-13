import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { createNotification, notificationBuilders } from '@/lib/notify';

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES = ['draft', 'submitted', 'under_review', 'validated', 'rejected', 'archived'] as const;
type ProjectStatus = typeof VALID_STATUSES[number];

// ── PATCH /api/admin/projects/[id]
// Handles two sub-actions via `action` field:
//   action: 'force_state'   — force project to a new status with a required note
//   action: 'override_score' — manually set score fields with a note
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const { id } = await params;
    const body = await req.json();
    const { action } = body;
    const admin = getSupabaseAdmin();

    // ── Force state transition ───────────────────────────────────────────────
    if (action === 'force_state') {
      const { status, note } = body as { status: ProjectStatus; note: string };

      if (!VALID_STATUSES.includes(status)) {
        return badRequest(`status must be one of: ${VALID_STATUSES.join(', ')}`);
      }
      if (!note?.trim()) return badRequest('A note is required for forced state transitions');

      // Fetch current project to get owner
      const { data: project, error: fetchErr } = await admin
        .from('projects')
        .select('id, name, status, developer_id')
        .is('deleted_at', null)
        .eq('id', id)
        .single();

      if (fetchErr || !project) return badRequest('Project not found');

      const before = { status: project.status };

      const { error } = await admin
        .from('projects')
        .update({ status, admin_note: note, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('[Admin/Projects] Force state error:', error.message);
        return serverError();
      }

      await writeAuditLog({
        userId: user.id,
        action: 'PROJECT_STATE_FORCED',
        entityType: 'projects',
        entityId: id,
        before,
        after: { status, note },
        req,
      });

      // Notify the developer org's owner
      const { data: members } = await admin
        .from('company_members')
        .select('user_id')
        .is('deleted_at', null)
        .eq('company_id', project.developer_id)
        .eq('role', 'OWNER')
        .limit(1);

      if (members?.[0]) {
        await createNotification({
          userId: members[0].user_id,
          payload: notificationBuilders.systemAnnouncement({
            title: `Project status updated: ${status.replace(/_/g, ' ')}`,
            body: `Your project "${project.name}" has been moved to ${status} by an admin. Note: ${note}`,
          }),
        });
      }

      return Response.json({ data: { id, status } });
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
      });

      return Response.json({ data });
    }

    return badRequest('Invalid action. Use force_state or override_score');
  } catch (e: any) {
    return handleRouteError(e);
  }
}
