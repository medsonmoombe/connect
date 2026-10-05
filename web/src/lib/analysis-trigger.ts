/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * analysis-trigger.ts — Document-change hooks that keep AI analysis honest.
 *
 * When a project file changes, the stored readiness score is stale. Rather than
 * serve it silently, we:
 *   1. Mark the analysis dirty (UI can show "analysis out of date").
 *   2. Enqueue a fresh analysis job (subject to the same guard/cooldown the
 *      interactive route enforces downstream), so the pipeline reacts on its own.
 *
 * This never triggers an unbounded number of AI runs: uploads are rate limited
 * (20/hour/user), the analysis guard only spends on genuine content changes, and
 * the per-project cooldown throttles rapid successive runs.
 */

import { analysisMinIntervalMs } from './analysis-guard';
import { isSubmittedForReview } from './project-state-machine';

interface SupabaseLike {
  from: (table: string) => any;
}

/** Flag the project's analysis as stale. Best-effort — never throws. */
export async function markProjectAnalysisDirty(supabase: SupabaseLike, projectId: string): Promise<void> {
  try {
    await supabase
      .from('projects')
      .update({ analysis_dirty: true })
      .eq('id', projectId);
  } catch {
    // best-effort
  }
}

/**
 * Enqueue a fresh analysis job for a project, unless one is already pending.
 * When AI_SYNC_WORKER=true the job is also run inline (fire-and-forget) so
 * single-node/dev deployments react without a separate worker.
 *
 * The job is only enqueued for a project that has been SUBMITTED (see
 * isSubmittedForReview). The analysis pipeline always ends on `under_review`,
 * so queueing one for a `draft` used to drag half-finished projects the
 * developer was still working on straight into the review queue. For an
 * unsubmitted project we only record that the stored analysis is stale
 * (`analysis_dirty`) and let the explicit flows do the work: the readiness
 * preview while the form is being filled in, and the final submission
 * (POST /api/projects/[id]/submit -> /analyze) afterwards.
 */
export async function enqueueAnalysisJob(
  supabase: SupabaseLike,
  projectId: string,
  requestedBy?: string | null,
): Promise<string | null> {
  try {
    // Anti-abuse: never enqueue a fresh run inside the per-project cooldown window.
    const { data: proj } = await supabase
      .from('projects')
      .select('status, last_actual_analysis_at')
      .eq('id', projectId)
      .maybeSingle();

    // Not submitted yet (or no longer active) — nothing runs automatically.
    if (!isSubmittedForReview(proj?.status)) return null;

    const lastAt = proj?.last_actual_analysis_at ? new Date(proj.last_actual_analysis_at).getTime() : 0;
    if (lastAt && Date.now() - lastAt < analysisMinIntervalMs()) {
      return null;
    }

    // The active statuses are 'queued' and 'running' — 'pending' is not in the
    // schema's vocabulary (ai_jobs.status check constraint). Filtering on
    // 'pending' matched nothing, so this dedupe never fired and every call fell
    // through to the insert below, which then collided with the
    // ai_jobs_one_active_per_project unique index.
    const { data: pending } = await supabase
      .from('ai_jobs')
      .select('id')
      .eq('project_id', projectId)
      .in('status', ['queued', 'running'])
      .limit(1)
      .maybeSingle();

    let jobId: string | null = pending?.id ?? null;

    if (!jobId) {
      const { data: job, error: jobErr } = await supabase
        .from('ai_jobs')
        .insert({ project_id: projectId, requested_by: requestedBy ?? null, request_type: 'full_analysis' })
        .select('id')
        .single();
      if (jobErr) {
        // Almost always the unique index: a job was enqueued concurrently
        // between the check above and this insert. Re-read rather than report
        // a failure, so a duplicate request joins the existing run.
        console.warn('[AnalysisTrigger] Job insert failed, re-reading active job:', jobErr.message);
        const { data: raced } = await supabase
          .from('ai_jobs')
          .select('id')
          .eq('project_id', projectId)
          .in('status', ['queued', 'running'])
          .limit(1)
          .maybeSingle();
        jobId = raced?.id ?? null;
      } else {
        jobId = job?.id ?? null;
      }
    }

    if (jobId && process.env.AI_SYNC_WORKER === 'true') {
      // Fire-and-forget: never block the upload response on a full AI run.
      const { runProjectAnalysis } = await import('./ai/orchestrator');
      void runProjectAnalysis(jobId).catch((err: any) =>
        console.error('[AnalysisTrigger] Inline analysis failed:', err?.message),
      );
    }

    return jobId;
  } catch (err: any) {
    console.error('[AnalysisTrigger] Enqueue failed:', err?.message);
    return null;
  }
}

/** Convenience: mark dirty + enqueue in one call. */
export async function invalidateProjectAnalysis(
  supabase: SupabaseLike,
  projectId: string,
  requestedBy?: string | null,
): Promise<string | null> {
  await markProjectAnalysisDirty(supabase, projectId);
  return enqueueAnalysisJob(supabase, projectId, requestedBy);
}
