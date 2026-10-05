import { NextRequest } from 'next/server';
import { getAuthenticatedUser, badRequest, forbidden, writeAuditLog, handleRouteError, verifyProjectOwnership } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { checkRateLimit, RATE_LIMIT_AI_ANALYSIS } from '@/lib/rate-limit';
import { runProjectAnalysis as runLegacyAnalysis, ProjectAnalysisDocument } from '@/lib/ai-analysis';
import { runProjectAnalysis as runOrchestratorAnalysis } from '@/lib/ai/orchestrator';
import { stageNumberToEnum, getStageRecommendations, STAGE_BY_VALUE, evaluateStageConsistency } from '@/lib/project-stages';
import { normalizeBreakdown, LEGACY_BREAKDOWN_MAXIMA } from '@/lib/scoring/engine';
import type { ProjectStage } from '@/types';
import { APPROVAL_PROOF_TYPES, LAND_TITLE_PROOF_TYPE, FINANCIAL_CLOSE_PROOF_TYPE } from '@/lib/project-validation';
import { transitionProject } from '@/lib/project-state-machine';
import { createNotification, notificationBuilders } from '@/lib/notify';
import { createHash } from 'crypto';
import { analysisFormSignal, computeAnalysisSignalHash, evaluateAnalysisGuard, analysisMinIntervalMs, cachedPayload } from '@/lib/analysis-guard';
import { triggerMatchingRuns } from '@/lib/matching-trigger';

/**
 * GET /api/projects/[id]/analyze — the status of the project's analysis run.
 *
 * The wizard needs a REAL completion signal rather than a guessed duration: the
 * previous flow fired POST /analyze without awaiting it and navigated away
 * immediately, so the developer never saw that anything was running and landed
 * on a project page that said "wasn't analysed" while the AI was still working.
 *
 * Returns the active job (or the most recent finished one) together with the
 * project's lifecycle status and whether a score row exists — the three facts a
 * caller needs to decide "still running / finished / failed".
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;
    if (!await verifyProjectOwnership(projectId, user.company_id, user.is_platform_admin)) {
      return forbidden('Only the project owner or a platform admin can check the analysis status.');
    }

    const supabase = getSupabaseAdmin();

    const [{ data: project }, { data: job }, { data: score }] = await Promise.all([
      supabase
        .from('projects')
        .select('status, analysis_failure_count')
        .eq('id', projectId)
        .maybeSingle(),
      // Prefer a live job; fall back to the newest run so a poller that starts
      // just after completion still learns the outcome instead of hanging.
      supabase
        .from('ai_jobs')
        .select('id, status, error_code, created_at, started_at, finished_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('project_scores')
        .select('capital_readiness_score, updated_at')
        .eq('project_id', projectId)
        .maybeSingle(),
    ]);

    const jobStatus = (job as any)?.status ?? null;
    const running = jobStatus === 'queued' || jobStatus === 'running';
    const hasScore = !!score;

    // A failed re-run must report 'failed' even when an older score row is still
    // present — the developer needs to know this run did not produce a new one.
    const state = running
      ? 'running'
      : jobStatus === 'error'
        ? 'failed'
        : jobStatus === 'done' || hasScore
          ? 'complete'
          : 'idle';

    return Response.json({
      success: true,
      data: {
        jobId: (job as any)?.id ?? null,
        jobStatus,
        errorCode: (job as any)?.error_code ?? null,
        projectStatus: project?.status ?? null,
        failureCount: project?.analysis_failure_count ?? 0,
        hasScore,
        score: score?.capital_readiness_score ?? null,
        // The single field a poller branches on.
        state,
      },
    });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

function hasScoreSafe(score: unknown): boolean {
  return !!score;
}

type Params = { params: Promise<{ id: string }> };

/** AI_ANALYSIS_FAILURE risk-signal category used by the fallback score in ai-analysis.ts. */
const AI_FAILURE_CATEGORY = 'AI_ANALYSIS_FAILURE';

/** Max consecutive failures before notifying admins (PRD Â§14.1). */
const MAX_FAILURES_BEFORE_ADMIN_NOTIFY = 3;

/**
 * POST /api/projects/[id]/analyze
 *
 * PRD Â§14.1: On AI scoring failure, the system:
 * 1. Saves a SCORING_PENDING_RETRY status (â†’ `scoring_retry`)
 * 2. Increments `analysis_failure_count` on the project
 * 3. After 3 consecutive failures, notifies platform admins for manual scoring
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;
    if (!await verifyProjectOwnership(projectId, user.company_id, user.is_platform_admin)) {
      return forbidden('Only the project owner or a platform admin can run AI analysis on this project.');
    }

    // The readiness preview's form-only stage is passed as a prior so the AI
    // only has to confirm/correct it (avoids a redundant stage determination).
    let previewStage: string | null = null;
    try {
      const body = await req.json().catch(() => null);
      previewStage = typeof body?.preview_stage === 'string' ? body.preview_stage : null;
    } catch {}

    const rateLimitResult = await checkRateLimit(user.id, RATE_LIMIT_AI_ANALYSIS);
    if (!rateLimitResult.allowed) {
      return Response.json(
        { error: 'AI analysis limit reached. Maximum 5 analyses per hour.' },
        { status: 429 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select('status, analysis_failure_count, last_analysis_requested_at, name, technology_type, location_country, location_region, project_size_mw, capital_required, capital_structure_type, capex, opex, funding_required, description, has_secured_land, land_title_status, has_reached_financial_close, regulatory_approvals, target_financial_close_date, target_cod, governance_terms, risk_disclosures, project_stage, last_actual_analysis_at, analysis_dirty')
      .eq('id', projectId)
      .single();

    if (projectErr || !project) {
      console.error('[Analyze] Project fetch failed:', { projectId, error: projectErr?.message ?? projectErr });
      return badRequest('Project not found');
    }

    // Project-level anti-abuse is enforced by the analysis guard below (cooldown between
    // genuine runs + a zero-cost exact-revert cache), replacing the old blanket 24h cap
    // that blocked legitimate updates without preventing edit-loop abuse.

    // Record this analysis request timestamp
    await supabase
      .from('projects')
      .update({ last_analysis_requested_at: new Date().toISOString() })
      .eq('id', projectId);

    // Transition to scoring state when the project was already submitted /
    // re-scoring (idempotent if already scoring). Re-analysis is allowed from
    // pending_live, scoring_retry and live (after uploading/editing documents
    // the developer re-runs AI analysis).
    //
    // NOTE: `draft` is deliberately NOT promoted. A draft is a project the
    // developer has NOT submitted yet — scoring it from here (readiness preview,
    // manual "run analysis", insights page) must not move it into the review
    // pipeline. Only the final submission (POST /api/projects/[id]/submit,
    // draft -> scoring) may do that.
    if (['pending_live', 'scoring_retry', 'live'].includes(project.status)) {
      const tr = await transitionProject({ projectId, toStatus: 'scoring', actorId: user.id!, actorRole: 'developer', skipRoleCheck: true, req });
      if (!tr.ok) {
        console.error('[Analyze] Transition to scoring failed:', { projectId, code: tr.code, error: tr.error });
        return badRequest(tr.error);
      }
    }

    const { data: documents } = await supabase
      .from('project_documents')
      .select('storage_path, file_url, file_hash, mime_type, document_type')
      .eq('project_id', projectId)
      .is('deleted_at', null);

    const storedPaths = (documents ?? [])
      .map((doc) => {
        if (doc.storage_path) return doc.storage_path;
        try {
          const url = new URL(doc.file_url);
          const marker = '/object/public/project-documents/';
          const idx = url.pathname.indexOf(marker);
          if (idx !== -1) return decodeURIComponent(url.pathname.slice(idx + marker.length));
        } catch {}
        return null;
      })
      .filter((p): p is string => typeof p === 'string' && p.startsWith(`${projectId}/`));

    // Document descriptors for the AI: storage path + real mime type + label.
    const storedDocs: ProjectAnalysisDocument[] = storedPaths.map((sp) => {
      const row = (documents ?? []).find((d) => d.storage_path === sp);
      return { storage_path: sp, mime_type: row?.mime_type, document_type: row?.document_type };
    });

    if (storedPaths.length === 0) {
      await transitionProject({ projectId, toStatus: 'draft', actorId: user.id!, actorRole: 'developer', skipRoleCheck: true, req });
      return badRequest('No valid project documents found. Please upload documents first.');
    }

    // â”€â”€ Server-side proof enforcement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Questions answered "Yes" (or approvals ticked) require proof documents.
    // This mirrors the client-side validation so the requirement can't be
    // bypassed by calling the API directly.
    const requiredProofs: string[] = [];
    if (project.has_secured_land) requiredProofs.push(LAND_TITLE_PROOF_TYPE);
    if (project.has_reached_financial_close) requiredProofs.push(FINANCIAL_CLOSE_PROOF_TYPE);
    for (const approval of (project.regulatory_approvals ?? [])) {
      const key = APPROVAL_PROOF_TYPES[approval];
      if (key) requiredProofs.push(key);
    }
    if (requiredProofs.length > 0) {
      const { data: proofRows } = await supabase
        .from('project_documents')
        .select('document_type, storage_path')
        .eq('project_id', projectId)
        .is('deleted_at', null);

      // Match by exact document_type OR by storage_path/document_type containing
      // the proof key (case-insensitive) â€” covers docs uploaded via the data room
      // where document_type is set to the raw filename rather than the proof constant.
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const haveProofs = new Set<string>();
      for (const row of (proofRows ?? [])) {
        for (const key of requiredProofs) {
          const keyNorm = normalize(key);
          if (
            row.document_type === key ||
            normalize(row.document_type ?? '').includes(keyNorm) ||
            normalize(row.storage_path ?? '').includes(keyNorm)
          ) {
            haveProofs.add(key);
          }
        }
      }
      const missingProofs = requiredProofs.filter((k) => !haveProofs.has(k));
      if (missingProofs.length > 0) {
        await transitionProject({ projectId, toStatus: 'draft', actorId: user.id!, actorRole: 'developer', skipRoleCheck: true, req });
        return badRequest(`Proof documents required: ${missingProofs.join(', ')}. Please attach proof for the questions you answered Yes to.`);
      }
    }

    // Compute a hash of the document set (sorted file hashes) for caching
    const docHashes = (documents ?? [])
      .filter((d) => d.file_hash && d.storage_path?.startsWith(`${projectId}/`))
      .map((d) => d.file_hash!)
      .sort();
    const documentsHash = docHashes.length > 0
      ? createHash('sha256').update(docHashes.join('')).digest('hex')
      : null;

    // Build the project form context so the AI can determine the stage from
    // the information the developer actually provided (not documents alone).
    const { data: techReq } = await supabase
      .from('project_tech_requirements')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    const analysisContext = {
      name: project.name,
      technology_type: project.technology_type,
      location_country: project.location_country,
      location_region: project.location_region,
      project_size_mw: project.project_size_mw,
      capital_required: project.capital_required,
      capital_structure_type: project.capital_structure_type,
      capex: project.capex,
      opex: project.opex,
      funding_required: project.funding_required,
      description: project.description,
      has_secured_land: project.has_secured_land,
      land_title_status: project.land_title_status,
      has_reached_financial_close: project.has_reached_financial_close,
      regulatory_approvals: project.regulatory_approvals,
      target_financial_close_date: project.target_financial_close_date,
      target_cod: project.target_cod,
      governance_terms: project.governance_terms,
      risk_disclosures: project.risk_disclosures,
      preview_stage: previewStage ?? undefined,
      tech_requirements: techReq ?? undefined,
    };

    // ── Analysis guard: cache correctness + anti-abuse ───────────────────────
    // The signal hash covers the document set AND the score-relevant form fields,
    // so editing approvals / PPA / grid status without re-uploading a file can no
    // longer serve a stale score. An exact revert to a previously-analysed state
    // resolves to the stored hash at zero AI cost, and the cooldown below stops a
    // user from burning the AI budget by editing in a loop.
    const { data: storedScore } = await supabase
      .from('project_scores')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    const formSignal = analysisFormSignal(project, techReq);
    const storedSignalHash = (storedScore as any)?.analysis_signal_hash ?? null;
    const guard = evaluateAnalysisGuard({
      docHashes,
      formSignal,
      storedHash: storedSignalHash,
      lastAnalysisAt: (project as any).last_actual_analysis_at ?? null,
      minIntervalMs: analysisMinIntervalMs(),
    });

    // 0-cost exact-revert / unchanged content => serve the stored scores.
    if (guard.decision === 'cached' && storedScore) {
      // A submitted project must still complete into the review queue (the queue
      // only sees `under_review`) — unchanged content is not a reason to leave a
      // submission parked in `scoring`.
      await enterReviewIfSubmitted({ supabase, projectId, actorId: user.id, req });
      await writeAuditLog({
        userId: user.id,
        action: 'PROJECT_ANALYZED',
        entityType: 'projects',
        entityId: projectId,
        after: { document_count: storedPaths.length, cached: true, exact_signal_match: true },
        req,
      });
      return Response.json(cachedPayload(storedScore as any));
    }

    // Content changed but a genuine run happened too recently — refuse to spend AI
    // budget on an edit loop (anti-abuse) while never serving stale scores.
    // Exception: only a DRAFT is throttled. A project the developer has already
    // submitted must never be left out of the review queue by a cooldown —
    // submission is a deliberate, rate-limited action in its own right.
    if (guard.decision === 'throttled' && project.status === 'draft') {
      const minutes = Math.max(1, Math.ceil((guard.retryAfterMs ?? 0) / 60_000));
      return Response.json(
        {
          error: `A fresh analysis was run recently for this project. Please wait about ${minutes} minute${minutes !== 1 ? 's' : ''} before analysing again — your edits are saved and will be analysed then.`,
          retry_after_ms: guard.retryAfterMs,
        },
        { status: 429 }
      );
    }

    const analysisSignalHash = guard.hash;
    // Orchestrator path: the evidence engine (SCORING_V2) is the default; set
    // AI_ORCHESTRATOR_ENABLED=false only for a deliberate legacy-path rollback.
    const useOrchestrator = process.env.AI_ORCHESTRATOR_ENABLED !== 'false';
    if (useOrchestrator) {
      // Enqueue a job and optionally run it inline.
      //
      // If a job is already active for this project the insert violates
      // ai_jobs_one_active_per_project. That is not an error to surface — it
      // means the work is already queued — so the existing job is reused and
      // reported. Previously the error was discarded, the route returned
      // `{ jobId: null, status: 'queued' }` with a 200, and the project sat in
      // `scoring` with nothing running it.
      const { data: job, error: jobErr } = await supabase
        .from('ai_jobs')
        .insert({ project_id: projectId, requested_by: user.id, request_type: 'full_analysis' })
        .select('id')
        .single();

      let jobId = job?.id ?? null;
      if (jobErr || !jobId) {
        const { data: active } = await supabase
          .from('ai_jobs')
          .select('id, status')
          .eq('project_id', projectId)
          .in('status', ['queued', 'running'])
          .limit(1)
          .maybeSingle();

        if (!active?.id) {
          console.error('[Analyze] Failed to enqueue analysis job:', {
            projectId, error: jobErr?.message ?? 'no row returned',
          });
          return Response.json(
            { error: 'Could not queue the analysis. Please try again.' },
            { status: 500 },
          );
        }
        jobId = active.id;
      }

      if (process.env.AI_SYNC_WORKER === 'true') {
        void runOrchestratorAnalysis(jobId).catch((err) =>
          console.error('[Analyze] Orchestrator inline run failed:', err?.message),
        );
      }

      await writeAuditLog({
        userId: user.id,
        action: 'PROJECT_ANALYZED',
        entityType: 'projects',
        entityId: projectId,
        after: { document_count: storedPaths.length, orchestrator: true, jobId },
        req,
      });

      return Response.json({
        success: true,
        data: { jobId, status: 'queued', analysisSignalHash },
      });
    }

    // â”€â”€ Legacy Gemini path (default until AI_ORCHESTRATOR_ENABLED=true) â”€â”€
    let scoringResult: any;
    try {
      scoringResult = await runLegacyAnalysis(projectId, storedDocs, analysisContext);
    } catch (e: any) {
      // Critical error (e.g. no documents) â€” revert to draft
      await transitionProject({ projectId, toStatus: 'draft', actorId: user.id!, actorRole: 'developer', skipRoleCheck: true, req });
      throw e;
    }

    // â”€â”€ PRD Â§14.1: Detect AI analysis failure after all retries exhausted â”€â”€â”€â”€
    const isFailure = !scoringResult?.total_score &&
      (scoringResult?.risk_signals ?? []).some((r: any) => r.category === AI_FAILURE_CATEGORY);

    if (isFailure) {
      // Increment the consecutive failure counter
      const currentCount = (project.analysis_failure_count ?? 0) + 1;
      await supabase
        .from('projects')
        .update({ analysis_failure_count: currentCount })
        .eq('id', projectId);

      // Transition to scoring_retry instead of saving zero scores. Only a run in
      // the SUBMITTED pipeline (`scoring`) is parked in retry — a draft that
      // failed to score stays a draft so the developer can keep working on it.
      const inReviewPipeline = (await currentProjectStatus(supabase, projectId)) === 'scoring';
      if (inReviewPipeline) {
        await transitionProject({ projectId, toStatus: 'scoring_retry', actorId: user.id!, actorRole: 'system', skipRoleCheck: true, req });
      }

      // After MAX_FAILURES_BEFORE_ADMIN_NOTIFY consecutive failures, notify admins
      if (currentCount >= MAX_FAILURES_BEFORE_ADMIN_NOTIFY) {
        const { data: proj } = await supabase.from('projects').select('name').eq('id', projectId).single();
        const projectName = proj?.name || 'Untitled';
        notifyPlatformAdmins(supabase, {
          payload: notificationBuilders.projectScoringRetry({
            projectName,
            failureCount: currentCount,
            actionUrl: `/admin/projects/${projectId}`,
          }),
        });
      }

      await writeAuditLog({
        userId: user.id,
        action: 'PROJECT_SCORING_FAILED',
        entityType: 'projects',
        entityId: projectId,
        after: { failure_count: currentCount, max_notify_after: MAX_FAILURES_BEFORE_ADMIN_NOTIFY },
        req,
      });

      return Response.json({
        success: false,
        error: `AI analysis failed after multiple attempts.${inReviewPipeline ? ' The project has been moved to retry status.' : ' Your project is saved as a draft - you can retry the analysis.'}${currentCount >= MAX_FAILURES_BEFORE_ADMIN_NOTIFY ? ' Platform admins have been notified.' : ''}`,
        data: { failure_count: currentCount, status: inReviewPipeline ? 'scoring_retry' : project.status },
      });
    }

    // â”€â”€ Success path: save scores + AI stage and move to pending_live â”€â”€â”€â”€â”€â”€â”€
    //
    // The total is DERIVED, never asserted. The AI is asked for a total and a
    // breakdown, and models routinely return a total that contradicts their own
    // sub-scores (e.g. 57 against 14 + 8 + 10). Sub-scores are normalised to
    // their documented maxima and the total is the sum of those, so the stored
    // score is always reproducible from the breakdown shown next to it.
    const normalized = normalizeBreakdown({
      ...(scoringResult.breakdown ?? {}),
      total_score: scoringResult.total_score,
    });
    const dimensionScore = (dimension: keyof typeof LEGACY_BREAKDOWN_MAXIMA) =>
      normalized.dimensions.find((d) => d.dimension === dimension)?.score ?? 0;
    let regulatory = dimensionScore('regulatory');
    let financial = dimensionScore('financial');
    let developer = dimensionScore('developer');
    let totalScore = normalized.total;

    if (normalized.notes.length > 0) {
      console.warn('[Analyze] Readiness reconciled:', normalized.notes.join(' '), { projectId });
    }

    // â”€â”€ Complete the per-document review â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // LLMs sometimes skip files. Synthesize a placeholder entry for every
    // uploaded document so the Document Checker always shows a verdict per
    // file, and flag unreviewed files as a data-integrity risk.
    // The AI is told to return document_analysis top-level; tolerate drift where
    // it nests the array inside breakdown instead.
    const rawDocAnalysis: any[] = Array.isArray(scoringResult.document_analysis)
      ? scoringResult.document_analysis
      : (Array.isArray((scoringResult.breakdown as any)?.document_analysis)
          ? (scoringResult.breakdown as any).document_analysis
          : []);
    const normalizeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const completedDocAnalysis = storedDocs.map((doc) => {
      const label = doc.document_type?.replace(/_/g, ' ')
        || (doc.storage_path.split('/').pop() ?? '').replace(/^\d+_/, '');
      const norm = normalizeName(label);
      const match = rawDocAnalysis.find((a: any) => {
        const n = normalizeName(a?.file_name ?? '');
        if (n === norm) return true;
        // Only fuzzy-match reasonably long labels to avoid cross-assignment.
        if (n.length >= 3 && norm.length >= 3) return n.includes(norm) || norm.includes(n);
        return false;
      });
      if (match) return match;
      return {
        file_name: label,
        detected_type: 'Not reviewed',
        content_summary: 'The AI did not return a content review for this file.',
        key_facts: [],
        relevance: 'LOW',
        authenticity_concerns: 'No content review was returned â€” verify this file manually.',
        supports_project_claims: false,
        matchStatus: 'unreviewed' as const,
      };
    });
    // â”€â”€ Identity reconciliation: does each document belong to THIS project? â”€â”€
    // The AI reports belongs_to_project per document (positive identity: names
    // the project/developer, or matching capacity AND location). A document
    // about another project â€” however well written â€” is not evidence for this
    // one. Entries without the field (older cached shapes) fall back to
    // supports_project_claims so classification stays conservative.
    for (const a of completedDocAnalysis) {
      if (a.matchStatus === 'unreviewed') continue;
      if (a.belongs_to_project === true) a.matchStatus = 'match';
      else if (a.belongs_to_project === false) a.matchStatus = 'mismatch';
      else a.matchStatus = a.supports_project_claims === false ? 'unverifiable' : 'match';
    }
    const unreviewedCount = completedDocAnalysis.filter((a: any) => a.matchStatus === 'unreviewed').length;
    const riskFlags = (scoringResult.risk_signals || []).map((r: any) => `${r.level}: ${r.text}`);
    if (unreviewedCount > 0) {
      riskFlags.push(`MEDIUM: ${unreviewedCount} uploaded document(s) were not reviewed by the AI â€” verify them manually.`);
    }
    const excludedDocs = completedDocAnalysis.filter((a: any) =>
      a.matchStatus === 'mismatch' || a.matchStatus === 'unverifiable');
    for (const d of excludedDocs) {
      const why = String(d.authenticity_concerns ?? d.content_summary ?? '').trim().slice(0, 240);
      riskFlags.push(`HIGH: Document "${d.file_name}" ${d.matchStatus === 'mismatch' ? 'does not belong to this project' : 'does not support this project\u2019s claims'} â€” it must not be relied on for scoring.${why ? ` AI verdict: ${why}` : ''}`);
    }

    // â”€â”€ Document-integrity gate on the stage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // If NONE of the uploaded documents support the project's claims, the
    // project cannot be further along than Concept. The AI is instructed to
    // determine the stage from the documents; this is the enforcement net so
    // an LLM drift can never leave a fake stage (e.g. "PPA Ready") on record
    // when the files don't back it up.
    // Gate only when EVERY document is both unsupported and low-relevance (or
    // unreviewed) â€” a genuine doc set with a strict AI verdict must not misfire.
    // â”€â”€ Document-integrity gate on stage AND score â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // If NO uploaded document belongs to the project, the project cannot be
    // further along than Concept and the readiness score is withheld at 0 â€”
    // a percentage computed without a single belonging document is invented,
    // not measured. The AI determines the stage from the documents; this is
    // the enforcement net so LLM drift can never leave a score or stage on
    // record that the files do not back up.
    const allDocsUnsupported = completedDocAnalysis.length > 0
      && completedDocAnalysis.every((a: any) => a.matchStatus !== 'match');
    const stageEnum = allDocsUnsupported
      ? 'CONCEPT' as ProjectStage
      : (stageNumberToEnum(scoringResult.determined_stage)
          ?? (previewStage && STAGE_BY_VALUE[previewStage] ? previewStage as ProjectStage : null)
          ?? (project.project_stage && STAGE_BY_VALUE[project.project_stage as ProjectStage] ? project.project_stage as ProjectStage : null));
    if (allDocsUnsupported) {
      riskFlags.push('HIGH: None of the uploaded documents belong to this project â€” readiness score withheld at 0 and stage set to Concept pending genuine project documentation.');
      regulatory = 0;
      financial = 0;
      developer = 0;
      totalScore = 0;
    }
    const stageInfo = stageEnum ? STAGE_BY_VALUE[stageEnum] : null;

    // â”€â”€ Stage â†” readiness consistency â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Each stage position has a score band it can logically support. The stage
    // is evidence-gated and the score is derived from the same review, so a
    // score above the band means the two numbers disagree â€” surface that to the
    // reviewer rather than persisting a silent contradiction.
    const stageConsistency = evaluateStageConsistency(totalScore, stageEnum, 'verified');
    if (stageConsistency.aboveMax) {
      riskFlags.push(`HIGH: Stage/readiness mismatch â€” ${stageConsistency.message}`);
    }

    // Stage-based service recommendations â€” AI answer with deterministic fallback.
    const aiServices = Array.isArray(scoringResult.recommended_services)
      ? (scoringResult.recommended_services as unknown[]).filter((s): s is string => typeof s === 'string')
      : [];
    const recommendedServices = aiServices.length > 0
      ? aiServices
      : (stageEnum ? getStageRecommendations(stageEnum).services : []);
    const recommendations = [
      ...(stageInfo
        ? [`Project is at Stage ${stageInfo.number} (${stageInfo.label}). Recommended partners to engage next: ${stageInfo.recommendedPartnerTypes.join(' / ')} â€” ${stageInfo.description}`]
        : []),
      ...(allDocsUnsupported
        ? ['The uploaded documents do not verify the project claims. Genuine project documentation (land title, approvals, PPA, feasibility study, financial model) must be uploaded before the project can advance.' ]
        : []),
      ...(scoringResult.recommendations || []),
    ];

    // Persist the AI-determined stage on the project (only while pre-live).
    if (stageEnum && ['draft', 'scoring', 'scoring_retry', 'pending_live'].includes(project.status)) {
      await supabase
        .from('projects')
        .update({ project_stage: stageEnum })
        .eq('id', projectId);
    }

    const { data: savedScores } = await supabase
      .from('project_scores')
      .upsert({
        project_id: projectId,
        capital_readiness_score: totalScore,
        regulatory_score: regulatory,
        financial_score: financial,
        developer_score: developer,
        breakdown: {
          ...(scoringResult.breakdown ?? {}),
          // Provenance for this score: which model shaped it, what each dimension
          // is measured out of, and whether the AI's asserted total was accepted.
          readiness: {
            model: 'legacy_llm',
            maxima: LEGACY_BREAKDOWN_MAXIMA,
            derived_total: normalized.total,
            asserted_total: normalized.assertedTotal,
            reconciled: normalized.reconciled,
            stage_band: stageConsistency.band,
            stage_consistent: stageConsistency.inBand,
            consistency_note: stageConsistency.message,
          },
          ai_stage: stageInfo ? { number: stageInfo.number, label: stageInfo.label, rationale: scoringResult.stage_rationale ?? '', recommended_services: recommendedServices } : null,
          document_analysis: completedDocAnalysis,
          stage_justification: scoringResult.stage_justification
            ?? { evidence_for: [], evidence_missing: [], key_drivers: [] },
          dimension_analysis: Array.isArray(scoringResult.dimension_analysis)
            ? scoringResult.dimension_analysis
            : [],
        },
        risk_flags: riskFlags,
        recommendations,
        summary: [
          scoringResult.summary || 'Analysis complete.',
          stageInfo ? `Stage ${stageInfo.number} (${stageInfo.label}) â€” readiness band ${stageConsistency.band?.min ?? 0}â€“${stageConsistency.band?.max ?? 100}.` : null,
        ].filter(Boolean).join(' '),
        determined_stage: stageEnum ?? null,
        stage_rationale: scoringResult.stage_rationale ?? null,
        documents_hash: documentsHash,
        analysis_signal_hash: analysisSignalHash,
      }, { onConflict: 'project_id' })
      .select()
      .single();

    // Reset failure count on successful analysis
    if ((project.analysis_failure_count ?? 0) > 0) {
      await supabase
        .from('projects')
        .update({ analysis_failure_count: 0 })
        .eq('id', projectId);
    }

    // Record the genuine run (anti-abuse cooldown anchor) and clear the dirty flag.
    await supabase
      .from('projects')
      .update({ last_actual_analysis_at: new Date().toISOString(), analysis_dirty: false })
      .eq('id', projectId);

    // Complete the developer's submission: a project only enters the review queue
    // from the submitted state (`scoring`), which the FINAL submission creates
    // (POST /api/projects/[id]/submit, draft -> scoring). A draft scored here
    // (readiness preview / manual run) is deliberately left as a draft so the
    // developer can finish their project before it is reviewed. The developer's
    // AI score stays hidden until a reviewer approves (-> live) or returns the
    // project (-> draft with a reason).
    await enterReviewIfSubmitted({ supabase, projectId, actorId: user.id, req });

    // Trigger matching engine in background
    triggerMatching(projectId);

    await writeAuditLog({
      userId: user.id,
      action: 'PROJECT_ANALYZED',
      entityType: 'projects',
      entityId: projectId,
      after: { document_count: storedPaths.length },
      req,
    });

    return Response.json({ success: true, data: savedScores });
  } catch (e: any) {
    if (e.message === 'No documents could be loaded for analysis') {
      return badRequest(e.message);
    }
    return handleRouteError(e);
  }
}

/**
 * Current status, read fresh.
 *
 * The project row loaded at the start of the request is a snapshot taken BEFORE
 * the (slow) AI run, so status decisions that must not be made on stale data use
 * this instead.
 */
async function currentProjectStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  projectId: string,
): Promise<string | null> {
  const { data } = await supabase.from('projects').select('status').eq('id', projectId).maybeSingle();
  return data?.status ?? null;
}

/**
 * Enter the review queue (`scoring` -> `under_review`) iff the project is in the
 * SUBMITTED flow. A project only reaches `scoring` through the developer's final
 * submission (POST /api/projects/[id]/submit), so this can never pull an
 * unfinished draft into review. Returns true when the transition was applied.
 */
async function enterReviewIfSubmitted(args: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  projectId: string;
  actorId: string | null;
  req: NextRequest;
}): Promise<boolean> {
  const { supabase, projectId, actorId, req } = args;
  if ((await currentProjectStatus(supabase, projectId)) !== 'scoring') return false;

  const result = await transitionProject({
    projectId,
    toStatus: 'under_review',
    actorId,
    actorRole: 'developer',
    skipRoleCheck: true,
    req,
  });
  if (!result.ok) {
    console.error('[Analyze] scoring -> under_review failed:', { projectId, code: result.code, error: result.error });
  }
  return result.ok;
}

/**
 * Notify all platform admin users (members of the platform org).
 * Fire-and-forget â€” never throws.
 */
async function notifyPlatformAdmins(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: { payload: ReturnType<typeof notificationBuilders.projectScoringRetry> }
) {
  try {
    const { data: platformOrg } = await supabase
      .from('companies').select('id').eq('is_platform_org', true).limit(1).maybeSingle();
    if (!platformOrg?.id) return;

    const { data: members } = await supabase
      .from('company_members').select('user_id').eq('company_id', platformOrg.id).is('deleted_at', null);

    if (!members?.length) return;
    for (const m of members) {
      if (m.user_id) await createNotification({ userId: m.user_id, payload: params.payload });
    }
  } catch {
    // fire-and-forget
  }
}

async function triggerMatching(projectId: string) {
  await triggerMatchingRuns({ projectId });
}
