import { getSupabaseAdmin } from './supabase-server';
import { writeAuditLog } from './api-helpers';

// ─────────────────────────────────────────────────────────────────────────────
//  project-state-machine.ts — SINGLE SOURCE OF TRUTH for the project lifecycle.
//
//  The status set, allowed transitions, role ownership, and per-transition
//  preconditions all live HERE. Routes, the UI (via @/types re-export), and the
//  DB CHECK constraint (migration 067) all derive from this module. To add,
//  remove, or rename a status: edit this file, add the matching literal to the
//  CHECK constraint in a new migration, and audit the transition map.
//
//  Status set:
//    draft | scoring | scoring_retry | under_review | live | deactivated | archived
//  `pending_live` is DEPRECATED for the developer flow — it remains valid in the
//  enum for back-compat with legacy rows, but the new submit/analyze/decision
//  routes only use `under_review`. Auto-activation of `pending_live → live` is
//  kept for any rows that still exist in that state.
//
//  Authority/Admin review model (the canonical developer flow):
//    draft → scoring (AI analysis runs)
//    scoring → under_review (analysis complete; awaiting human review)
//    under_review → live  (authority/admin approved)
//    under_review → draft (authority/admin returned with comments)
//
//  PRD §14.1: `scoring_retry` is set when AI analysis fails after all retries.
//  From `scoring_retry` the user may retry (→ `scoring`) or an admin may send
//  back to `draft`. After 3 consecutive failures the system notifies an admin.
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectStatus =
  | 'draft'
  | 'scoring'
  | 'scoring_retry'
  | 'under_review'
  | 'pending_live' // DEPRECATED — see comment above. Kept for back-compat.
  | 'live'
  | 'deactivated'
  | 'archived'
  | 'paused';

/** Authoritative, ordered list — the DB CHECK constraint must mirror these. */
export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  'draft',
  'scoring',
  'scoring_retry',
  'under_review',
  'pending_live', // deprecated
  'live',
  'deactivated',
  'archived',
  'paused',
] as const;

/** Human labels for UI reuse (never hardcode status strings in the UI). */
export const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Draft',
  scoring: 'In Review',
  scoring_retry: 'Analysis Failed — Retry Available',
  under_review: 'Under Regulator Review',
  pending_live: 'Pending Go-Live (legacy)',
  live: 'Live',
  deactivated: 'Deactivated',
  archived: 'Archived',
  paused: 'Paused',
};

/**
 * True for statuses where the developer's AI score should be hidden.
 *
 * Re-exported from the client-safe `score-visibility.ts` so the API routes and
 * the UI share one definition — the rule used to live only here, which meant the
 * client could not consult it and had to duplicate it.
 */
export { isScoreHiddenForDeveloper } from './score-visibility';

/** Who may trigger each transition. `system` = an internal/cron caller. */
export type TransitionActor = 'developer' | 'reviewer' | 'platform_admin' | 'system';

export const TRANSITION_ROLES: Record<string, TransitionActor> = {
  'draft→scoring': 'developer',
  'scoring→under_review': 'system', // set automatically by the analyze route on success
  'scoring→pending_live': 'reviewer', // legacy path (internal_review mode pre-067)
  'scoring→draft': 'reviewer',
  'scoring→live': 'platform_admin', // direct approve without under_review step
  // PRD §14.1: scoring_retry transitions
  'scoring→scoring_retry': 'system', // auto-transition when AI analysis fails (PRD §14.1)
  'scoring_retry→scoring': 'developer', // user retries analysis
  'scoring_retry→draft': 'platform_admin', // admin sends back to draft
  'draft→under_review': 'developer', // direct re-submit edge case
  'draft→pending_live': 'developer', // legacy
  'under_review→live': 'platform_admin', // authority/admin approves via /decision
  'under_review→scoring': 'platform_admin', // force re-analysis during review
  'under_review→draft': 'platform_admin', // authority/admin returns with comments
  'pending_live→scoring': 'developer', // re-run analysis after uploading/editing documents
  'pending_live→live': 'platform_admin', // legacy auto-activation
  'pending_live→draft': 'platform_admin',
  'live→scoring': 'platform_admin', // re-review (e.g. material edit)
  'live→deactivated': 'platform_admin',
  'deactivated→live': 'platform_admin',
  'live→archived': 'platform_admin',
  'deactivated→archived': 'platform_admin',
  'archived→live': 'platform_admin',
  'archived→deactivated': 'platform_admin',
  // ── Pause transitions ───────────────────────────────────────────────────
  'draft→paused': 'developer',
  'scoring→paused': 'developer',
  'scoring_retry→paused': 'developer',
  'under_review→paused': 'developer',
  'pending_live→paused': 'developer',
  'live→paused': 'developer', // developer may pause to unlock material-field editing (re-review required)
  'paused→draft': 'developer', // resume back to draft for editing
  'paused→under_review': 'developer', // resume to under_review (skip re-scoring)
  'paused→pending_live': 'developer', // legacy
};

/**
 * Allowed transitions. To add/remove a status later, edit this map plus
 * TRANSITION_ROLES and STATUS_LABELS and update the DB CHECK.
 */
const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  draft:          ['scoring', 'under_review', 'pending_live', 'paused'],
  scoring:        ['under_review', 'pending_live', 'draft', 'scoring_retry', 'paused', 'live'], // scoring_retry = AI analysis failure (PRD §14.1)
  scoring_retry:  ['scoring', 'draft', 'paused'],  // user retries or admin sends back
  under_review:   ['live', 'draft', 'scoring', 'paused'], // approve / return / force re-score
  pending_live:   ['scoring', 'live', 'draft', 'paused'],  // legacy path
  live:           ['scoring', 'deactivated', 'archived', 'paused'],
  deactivated:    ['live', 'archived'],
  archived:       ['live', 'deactivated'],
  paused:         ['draft', 'under_review', 'pending_live'], // resume from pause
};

export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getValidNextStates(from: ProjectStatus): ProjectStatus[] {
  return VALID_TRANSITIONS[from] ?? [];
}

export function getTransitionRole(from: ProjectStatus, to: ProjectStatus): TransitionActor | null {
  if (!canTransition(from, to)) return null;
  return TRANSITION_ROLES[`${from}→${to}`] ?? null;
}

export function isTerminalState(status: ProjectStatus): boolean {
  return false; // every status can move somewhere; no hard terminal (archive is restorable)
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === 'string' && (PROJECT_STATUSES as readonly string[]).includes(value);
}

/**
 * Statuses that mean the developer has completed the FINAL submission.
 *
 * `draft` (still being built) and `paused` (deliberately parked) are
 * PRE-submission states. The review pipeline is only entered by the developer's
 * final submission — `POST /api/projects/[id]/submit` moves draft → scoring —
 * so any background or ad-hoc work on an unsubmitted project (document-upload
 * hooks, readiness preview, manual "run analysis") must leave its status alone:
 * a half-finished draft must never appear in the review queue.
 */
export const SUBMITTED_STATUSES: readonly ProjectStatus[] = [
  'scoring',
  'scoring_retry',
  'under_review',
  'pending_live', // deprecated — legacy rows
  'live',
  'deactivated',
  'archived',
] as const;

/**
 * True when a project has been submitted for review (see SUBMITTED_STATUSES).
 * Callers use this to decide whether a run may take part in the review
 * pipeline / complete into `under_review`.
 */
export function isSubmittedForReview(status: string | null | undefined): boolean {
  return !!status && (SUBMITTED_STATUSES as readonly string[]).includes(status);
}

/**
 * True when a project has a persisted score row — i.e. the AI analysis actually
 * completed and stored something.
 *
 * `under_review` means "awaiting human review of the AI's analysis", so a project
 * without a score row is meaningless to a reviewer. Several routes could reach
 * that state directly (the authority decision route accepts `draft` and
 * `scoring_retry` and has a `decision: 'under_review'` option, and the internal
 * review route does the same), which produced projects sitting in the review
 * queue that "hadn't been analysed" — indistinguishable from a failed run.
 * Callers use this to refuse such a transition instead.
 *
 * A row with a NULL score counts: the engine writes a real 0 when reconciliation
 * withholds the score (no document belongs to the project), and that IS a
 * completed analysis.
 */
export async function hasCompletedAnalysis(projectId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('project_scores')
    .select('project_id')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) {
    console.error('[StateMachine] hasCompletedAnalysis lookup failed:', error.message);
    return false;
  }
  return !!data;
}

// ── Transition result ────────────────────────────────────────────────────────

export type TransitionResultOk = { ok: true; from: ProjectStatus; to: ProjectStatus };
export type TransitionResultErr = {
  ok: false;
  /** 404 | 409 | 403 | 412 — maps to a consistent HTTP status in the caller. */
  code: 'NOT_FOUND' | 'INVALID_TRANSITION' | 'FORBIDDEN' | 'PRECONDITION' | 'CONFLICT' | 'UPDATE_FAILED';
  error: string;
  from?: ProjectStatus;
};
export type TransitionResult = TransitionResultOk | TransitionResultErr;

// ── Precondition (declarative per-transition gating) ─────────────────────────

export interface TransitionContext {
  /** Actor's user id (null for system/cron). */
  actorId: string | null;
  /** Caller-declared actor role (validated against TRANSITION_ROLES). */
  actorRole: TransitionActor;
  /** The project row's developer_id (the owning org). */
  developerId: string;
}

/**
 * Declarative precondition checks. Each predicate receives the fetched project
 * row and returns an error string (→ 412) or null. Keep these pure & cheap;
 * expensive checks (e.g. counting documents) are implemented in the routes and
 * passed in as facts, OR resolved here via the admin client.
 */
export type Precondition = (project: any, supabase: ReturnType<typeof getSupabaseAdmin>) => Promise<string | null> | string | null;

const REQUIRED_PROJECT_FIELDS = [
  'name', 'technology_type', 'location_country', 'project_size_mw',
  'capital_required', 'capital_structure_type', 'project_stage',
] as const;

function missingRequiredFields(project: any): string[] {
  return REQUIRED_PROJECT_FIELDS.filter(f => {
    const v = project?.[f];
    return v === null || v === undefined || v === '' || v === 0;
  });
}

async function atLeastOneDocument(supabase: ReturnType<typeof getSupabaseAdmin>, projectId: string): Promise<boolean> {
  const { count } = await supabase
    .from('project_documents')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .is('deleted_at', null);
  return (count ?? 0) > 0;
}

/**
 * Precondition for the submit/approve transitions: project has all required
 * fields AND at least one document. Centralised so submit + internal-review
 * approve + platform validate can't drift.
 */
const submitPrecondition: Precondition = async (project, supabase) => {
  const missing = missingRequiredFields(project);
  if (missing.length) return `Missing required fields: ${missing.join(', ')}`;
  const hasDoc = await atLeastOneDocument(supabase, project.id);
  if (!hasDoc) return 'At least 1 document must be uploaded before submitting.';
  return null;
};

/** Precondition map keyed by `${from}→${to}`. */
const PRECONDITIONS: Record<string, Precondition> = {
  'draft→scoring': submitPrecondition,
  'draft→under_review': submitPrecondition,
  'draft→pending_live': submitPrecondition,
  'scoring→under_review': submitPrecondition,
  'scoring→pending_live': submitPrecondition,
  'under_review→live': submitPrecondition,
  'pending_live→live': submitPrecondition,
};

// ── Central transition runner (atomic compare-and-set) ───────────────────────

export interface TransitionOptions {
  projectId: string;
  toStatus: ProjectStatus;
  actorId: string | null;
  actorRole: TransitionActor;
  /** Optional human reason (stored on history + audit). */
  reason?: string;
  /** Extra columns to set atomically with the status (e.g. rejection_reason). */
  patch?: Record<string, unknown>;
  /** Request object for audit IP/UA capture. */
  req?: { headers: { get: (h: string) => string | null } };
  /** Skip the role/ownership check (used by the trusted system/cron activator). */
  skipRoleCheck?: boolean;
}

/**
 * transitionProject — the ONLY sanctioned way to move a project between statuses.
 *
 * Contract:
 *  - Fetch row → validate transition → check role ownership → run preconditions.
 *  - ATOMIC compare-and-set: `UPDATE ... WHERE id=? AND status=<from>`. Exactly
 *    one of N concurrent callers wins; the rest get affected=0 → CONFLICT.
 *  - Only the winner inserts `project_status_history` and writes an audit log.
 *  - Returns a typed result; callers map `code` → HTTP status.
 */
export async function transitionProject(opts: TransitionOptions): Promise<TransitionResult> {
  const { projectId, toStatus, actorId, actorRole, reason, patch, req, skipRoleCheck } = opts;
  const supabase = getSupabaseAdmin();

  // 1. Fetch the row (read phase — non-locking; the CAS below is the real gate).
  const { data: project, error: fetchErr } = await supabase
    .from('projects')
    .select('id, status, developer_id, scores_visible_at, name, rejection_reason')
    .eq('id', projectId)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchErr || !project) {
    return { ok: false, code: 'NOT_FOUND', error: 'Project not found' };
  }

  const from = project.status as ProjectStatus;

  // 2. Validate the transition.
  if (from === toStatus) {
    return { ok: false, code: 'CONFLICT', error: `Project already ${from}`, from };
  }
  if (!canTransition(from, toStatus)) {
    return { ok: false, code: 'INVALID_TRANSITION', error: `Invalid transition: ${from} → ${toStatus}`, from };
  }

  // 3. Role ownership (skip only for trusted system callers).
  if (!skipRoleCheck) {
    const requiredRole = getTransitionRole(from, toStatus);
    if (requiredRole && actorRole !== requiredRole) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        error: `Only ${requiredRole} may move this project from ${STATUS_LABELS[from]} to ${STATUS_LABELS[toStatus]}.`,
        from,
      };
    }
  }

  // 4. Precondition gate (declarative).
  const precondition = PRECONDITIONS[`${from}→${toStatus}`];
  if (precondition) {
    const fullProject = await fetchFullProject(supabase, projectId);
    if (!fullProject) return { ok: false, code: 'NOT_FOUND', error: 'Project not found' };
    const pErr = await precondition(fullProject, supabase);
    if (pErr) return { ok: false, code: 'PRECONDITION', error: pErr, from };
  }

  // 5. Build the atomic patch.
  //    - `scores_visible_at` is set when the project becomes visible to the
  //      developer (live, or returned-to-draft with a reason). It is *not*
  //      set during `under_review` because the developer's score remains hidden
  //      until a reviewer decides.
  //    - `is_visible_to_investors` is set to true on `live` so the marketplace
  //      picks up the project. It is reset to false on `draft` (return).
  const updates: Record<string, unknown> = { ...patch, status: toStatus };
  const nowIso = new Date().toISOString();
  if (toStatus === 'live') {
    if (!project.scores_visible_at) updates.scores_visible_at = nowIso;
    updates.is_visible_to_investors = true;
  } else if (toStatus === 'draft') {
    // Returning a project to draft. The reviewer is required to set a reason
    // (enforced in the decision route); when they do, the developer may see
    // the AI score on their returned draft so they can iterate.
    if (patch?.rejection_reason) {
      updates.scores_visible_at = nowIso;
    }
    updates.is_visible_to_investors = false;
  }

  // 6. ATOMIC compare-and-set. `.eq('status', from)` is the lock: only the row
  //    still at `from` updates. concurrent calls get affected=0.
  const { data: updated, count, error: updErr } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .eq('status', from)
    .select('id, status')
    .maybeSingle();

  if (updErr) {
    console.error('[ProjectStateMachine] CAS error:', updErr.message);
    return { ok: false, code: 'UPDATE_FAILED', error: 'Failed to update project status', from };
  }
  if (!updated) {
    // Row no longer at `from` → someone else moved it (or it was already moved).
    return {
      ok: false,
      code: 'CONFLICT',
      error: `Project is no longer ${STATUS_LABELS[from]} — it may have been updated concurrently.`,
      from,
    };
  }

  // 7. History + audit — ONLY the winner writes these.
  const { error: histErr } = await supabase.from('project_status_history').insert({
    project_id: projectId,
    from_status: from,
    to_status: toStatus,
    actor_id: actorId,
    reason: reason || null,
  });
  if (histErr) console.error('[ProjectStateMachine] history insert error:', histErr.message);

  await writeAuditLog({
    userId: actorId,
    action: `PROJECT_${toStatus.toUpperCase()}`,
    entityType: 'projects',
    entityId: projectId,
    before: { status: from },
    after: { status: toStatus, reason, ...patch },
    req: req as any,
    blocking: true,
  });

  return { ok: true, from, to: toStatus };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchFullProject(supabase: ReturnType<typeof getSupabaseAdmin>, projectId: string) {
  const { data } = await supabase
    .from('projects')
    .select('id, name, technology_type, location_country, project_size_mw, capital_required, capital_structure_type, project_stage')
    .eq('id', projectId)
    .maybeSingle();
  return data;
}

export async function getStatusHistory(projectId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('project_status_history')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data ?? [];
}

/**
 * Resolve the actor role for a transition from the authenticated user.
 * Used by routes to pick developer vs platform_admin vs reviewer without
 * duplicating the org-reviewer lookup logic.
 */
export function resolveActorRole(args: {
  isPlatformAdmin: boolean;
  developerId?: string | null;
  userCompanyId?: string | null;
  isInternalReviewer?: boolean;
}): TransitionActor | null {
  if (args.isPlatformAdmin) return 'platform_admin';
  if (args.isInternalReviewer) return 'reviewer';
  if (args.userCompanyId && args.developerId && args.userCompanyId === args.developerId) return 'developer';
  return null;
}
