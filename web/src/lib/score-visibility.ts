/**
 * score-visibility.ts — client-safe copy of the AI score visibility rule.
 *
 * The rule decides whether a project's readiness score is shown to its developer.
 * It lives in its own dependency-free module because BOTH sides need it:
 *
 *   - the API routes (server) decide whether to null `project_scores`; and
 *   - the UI (client) must explain WHY a score is missing.
 *
 * The client half used to inline its own copy of the conditions, and the server
 * half lived in `project-state-machine.ts` — which imports the Supabase admin
 * client and the audit logger and therefore cannot be bundled into a client
 * component. The two copies drifted. `project-state-machine.ts` re-exports the
 * server-relevant names so routes keep importing from where they always did.
 */

export type ScoreVisibilityStatus = string | null | undefined;

/**
 * True when the developer's AI score must be hidden.
 *
 * The score is shown only when:
 *   (a) the project is `live` (authority/admin approved it) or in a terminal
 *       post-live state (`deactivated`, `archived`); or
 *   (b) the project has been returned to `draft` with a reviewer's comment, so the
 *       developer can see what to improve.
 *
 * Every other status — `draft`, `scoring`, `scoring_retry`, `under_review`,
 * `pending_live`, `paused` — hides it, so the developer's own dashboard cannot
 * leak the score before the authority's decision.
 */
export function isScoreHiddenForDeveloper(
  status: ScoreVisibilityStatus,
  hasRejectionReason: boolean,
): boolean {
  if (status === 'live' || status === 'deactivated' || status === 'archived') return false;
  if (status === 'draft' && hasRejectionReason) return false;
  return true;
}

/**
 * What the UI should say about a missing score.
 *
 * `hidden`    — the analysis exists but is withheld until review.
 * `not_run`   — no analysis has ever completed.
 * `running`   — an analysis job is queued or in flight right now.
 * `available` — the score may be shown.
 */
export type ScoreAvailability = 'available' | 'hidden' | 'running' | 'not_run';

export function scoreAvailability(args: {
  status: ScoreVisibilityStatus;
  hasRejectionReason: boolean;
  hasScore: boolean;
}): ScoreAvailability {
  const { status, hasRejectionReason, hasScore } = args;
  if (!isScoreHiddenForDeveloper(status, hasRejectionReason)) return 'available';
  if (hasScore) return 'hidden';
  if (status === 'scoring' || status === 'scoring_retry') return 'running';
  return 'not_run';
}