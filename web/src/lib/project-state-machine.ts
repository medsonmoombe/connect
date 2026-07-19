import { getSupabaseAdmin } from './supabase-server';
import { writeAuditLog } from './api-helpers';

export type ProjectStatus =
  | 'draft'
  | 'scoring'
  | 'pending_live'
  | 'live'
  | 'deactivated'
  | 'archived';

const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  draft:       ['scoring'],
  scoring:     ['pending_live', 'draft'],
  pending_live: ['live', 'deactivated', 'archived'],
  live:        ['scoring', 'deactivated', 'archived'],
  deactivated: ['live', 'archived'],
  archived:    ['live', 'deactivated'],
};

export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

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

  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('status, developer_id, scores_visible_at')
    .eq('id', projectId)
    .single();

  if (fetchError || !project) return { success: false, error: 'Project not found' };

  const fromStatus = project.status as ProjectStatus;

  if (!canTransition(fromStatus, toStatus)) {
    return { success: false, error: `Invalid transition: ${fromStatus} → ${toStatus}` };
  }

  const updates: Record<string, any> = { status: toStatus };

  // When going to pending_live: set scores_visible_at only on the first time
  if (toStatus === 'pending_live' && !project.scores_visible_at) {
    const delayMinutes = parseInt(process.env.PROJECT_ACTIVATION_DELAY_MINUTES || '1440', 10);
    updates.scores_visible_at = new Date(Date.now() + delayMinutes * 60_000).toISOString();
  }

  const { error: updateError } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId);

  if (updateError) return { success: false, error: 'Failed to update project status' };

  await supabase.from('project_status_history').insert({
    project_id: projectId,
    from_status: fromStatus,
    to_status: toStatus,
    actor_id: actorId,
    reason: reason || null,
  });

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
