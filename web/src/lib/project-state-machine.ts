import { getSupabaseAdmin } from './supabase-server';
import { writeAuditLog } from './api-helpers';

// ─── Valid state transitions ────────────────────────────────────────────────
// PRD Section 4.C: Project Lifecycle State Machine

export type ProjectStatus =
  | 'draft'
  | 'pending_internal_review'
  | 'returned'
  | 'submitted'
  | 'under_review'
  | 'validated'
  | 'rejected'
  | 'archived';

const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  draft:                    ['submitted', 'pending_internal_review'],
  pending_internal_review:  ['submitted', 'returned'],
  returned:                 ['pending_internal_review', 'submitted'],
  submitted:                ['under_review'],
  under_review:             ['validated', 'rejected'],
  validated:                ['archived'],
  rejected:                 ['draft'],
  archived:                 [],
};

export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Transition a project to a new status within a DB transaction.
 * Writes to project_status_history and audit_logs.
 */
export async function transitionProject({
  projectId,
  toStatus,
  actorId,
  reason,
  req,
}: {
  projectId: string;
  toStatus: ProjectStatus;
  actorId: string;
  reason?: string;
  req?: { headers: { get: (h: string) => string | null } };
}): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

  // 1. Fetch current status
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('status, developer_id')
    .eq('id', projectId)
    .single();

  if (fetchError || !project) {
    return { success: false, error: 'Project not found' };
  }

  const fromStatus = project.status as ProjectStatus;

  // 2. Validate transition
  if (!canTransition(fromStatus, toStatus)) {
    return { success: false, error: `Invalid transition: ${fromStatus} → ${toStatus}` };
  }

  // 3. Update project status
  const { error: updateError } = await supabase
    .from('projects')
    .update({ status: toStatus })
    .eq('id', projectId);

  if (updateError) {
    return { success: false, error: 'Failed to update project status' };
  }

  // 4. Write to status history
  await supabase.from('project_status_history').insert({
    project_id: projectId,
    from_status: fromStatus,
    to_status: toStatus,
    actor_id: actorId,
    reason: reason || null,
  });

  // 5. Write audit log
  await writeAuditLog({
    userId: actorId,
    action: `PROJECT_${toStatus.toUpperCase()}`,
    entityType: 'projects',
    entityId: projectId,
    before: { status: fromStatus },
    after: { status: toStatus, reason },
    req: req as any,
  });

  return { success: true };
}

/**
 * Get the full status history for a project.
 */
export async function getStatusHistory(projectId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('project_status_history')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data;
}
