/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { getAuthenticatedUser, forbidden, badRequest, writeAuditLog, handleRouteError, verifyProjectOwnership } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';
import { runReadinessPreview } from '@/lib/ai/preview';
import { stageNumberToEnum, STAGE_BY_VALUE } from '@/lib/project-stages';
import { analyzeProjectGaps } from '@/lib/gap-analysis';
import { computePreviewMatches } from '@/lib/matching-preview';
import { matchCandidatesForGap } from '@/lib/partner-candidates';
import { isGapAllowedAtStage } from '@/lib/project-stages';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/readiness
 *
 * The professional "first analysis" of project creation. The AI READS EVERY
 * UPLOADED DOCUMENT through the same evidence engine that scores the project at
 * submission, and returns:
 *   1. The 8-stage position + rationale the documents actually support
 *   2. The project's gaps (deterministic gap engine)
 *   3. Recommended partner profiles per gap (live, non-persisted matches)
 *
 * With no document uploaded yet it falls back to a claims-only estimate and says
 * so (`evidence_based: false`), so the developer is never shown a "read" stage
 * the AI did not read. Per-document extractions are cached by file hash (shared
 * with the full analysis) and the stage is cached by form + document hash, so
 * unchanged inputs never re-bill the AI API. Nothing is persisted as the
 * authoritative stage — the final stage is set by the analyze route at submit.
 */
const STAGE_CACHE_TTL_MS = 10 * 60 * 1000;
const stageCache = new Map<string, { ts: number; value: any }>();

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;
    if (!await verifyProjectOwnership(projectId, user.company_id, user.is_platform_admin)) {
      return forbidden('Only the project owner or a platform admin can preview project readiness.');
    }

    const rateLimitResult = await checkRateLimit(user.id, { prefix: 'ai-stage', limit: 20, windowMs: 60 * 60_000 });
    if (!rateLimitResult.allowed) {
      return Response.json(
        { error: 'Readiness check limit reached. Maximum 20 checks per hour.' },
        { status: 429 }
      );
    }

    const supabase = getSupabaseAdmin();

    // The developer may be replacing a document in this session; the submit pass
    // deletes the superseded rows, so the preview must not read them either.
    let excludeDocIds: string[] = [];
    try {
      const body = await req.json().catch(() => null);
      if (Array.isArray(body?.exclude_doc_ids)) {
        excludeDocIds = body.exclude_doc_ids.filter((v: unknown): v is string => typeof v === 'string');
      }
    } catch {}

    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select('id, developer_id, name, technology_type, location_country, location_region, project_size_mw, capital_required, capital_structure_type, capex, opex, funding_required, description, has_secured_land, land_title_status, has_reached_financial_close, regulatory_approvals, target_financial_close_date, target_cod, governance_terms, risk_disclosures')
      .eq('id', projectId)
      .single();

    if (projectErr || !project) {
      return badRequest('Project not found');
    }

    const [{ data: techReq }, { data: documents }, { data: developer }] = await Promise.all([
      supabase.from('project_tech_requirements').select('*').eq('project_id', projectId).maybeSingle(),
      supabase.from('project_documents').select('*').eq('project_id', projectId).is('deleted_at', null),
      project.developer_id
        ? supabase.from('companies').select('name').eq('id', project.developer_id).maybeSingle()
        : Promise.resolve({ data: null } as { data: { name: string } | null }),
    ]);

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
      tech_requirements: techReq ?? undefined,
    };

    // The preview now READS the uploaded documents, so the cache key has to
    // cover the document set too — uploading or replacing a file must invalidate
    // the cached stage, not silently serve the previous one.
    const documentSignal = (documents ?? [])
      .filter((d: any) => d.file_hash && !d.replaced_by && !excludeDocIds.includes(d.id))
      .map((d: any) => d.file_hash as string)
      .sort()
      .join('|');
    const formHash = createHash('sha256')
      .update(`${JSON.stringify(analysisContext)}::${documentSignal}`)
      .digest('hex');
    const cacheKey = `readiness:${projectId}:${formHash}`;

    // ── AI stage determination (cached by form hash — never re-bills unchanged forms) ──
    // Driven by the new evidence-based readiness preview (multi-provider layer).
    let stageResult: {
      stageEnum: string;
      stageInfo: any;
      stage_rationale: string;
      recommended_services: string[];
      /** Evidence-based preliminary readiness score (same engine as the final score). */
      score: number;
      /** Score band the preliminary stage can support. */
      band: { min: number; max: number; rationale: string } | null;
      stageConsistent: boolean;
      /** True when the score EXCEEDS what the stage can support (the actionable direction). */
      scoreAboveBand: boolean;
      /** How many uploaded documents the AI read for this stage. */
      documentsRead: number;
      documentsExcluded: number;
      documentsSkipped: { name: string; reason: string }[];
      evidenceBased: boolean;
      scoreWithheld: boolean;
      disclaimer: string;
    } | null = null;
    const cached = stageCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < STAGE_CACHE_TTL_MS) {
      stageResult = cached.value;
    } else {
      const preview = await runReadinessPreview(analysisContext, user.id, {
        projectId,
        developerName: developer?.name ?? null,
        excludeDocIds,
      });
      const stageEnum = stageNumberToEnum(preview.stage);
      const stageInfo = stageEnum ? STAGE_BY_VALUE[stageEnum] : null;
      if (!stageEnum || !stageInfo) {
        return Response.json(
          { success: false, data: null, error: 'The AI could not determine a stage from the information provided. You can continue — the stage will be set at submission.' },
          { status: 422 }
        );
      }
      stageResult = {
        stageEnum,
        stageInfo: {
          value: stageInfo.value,
          number: stageInfo.number,
          label: stageInfo.label,
          description: stageInfo.description,
          recommendedServices: stageInfo.recommendedServices,
          recommendedPartnerTypes: stageInfo.recommendedPartnerTypes,
        },
        stage_rationale: preview.evidenceBased
          ? `${preview.stageLabel} — readiness score ${preview.score}/100 read from your answers and ${preview.documentsRead} uploaded document${preview.documentsRead === 1 ? '' : 's'}${preview.documentsExcluded > 0 ? ` (${preview.documentsExcluded} excluded as not belonging to this project)` : ''}.`
          : `${preview.stageLabel} — readiness score ${preview.score}/100 from your answers only; no documents have been read yet.`,
        recommended_services: preview.recommendedPartnerTypes,
        score: preview.score,
        band: preview.band,
        stageConsistent: preview.consistency.inBand,
        scoreAboveBand: preview.consistency.aboveMax,
        documentsRead: preview.documentsRead,
        documentsExcluded: preview.documentsExcluded,
        documentsSkipped: preview.documentsSkipped,
        evidenceBased: preview.evidenceBased,
        scoreWithheld: preview.scoreWithheld,
        disclaimer: preview.disclaimer,
      };
      stageCache.set(cacheKey, { ts: Date.now(), value: stageResult });
    }

    // ── Gap analysis (deterministic, no AI) ──────────────────────────────────
    const projectShape: any = {
      ...project,
      documents: documents ?? [],
      tech_requirements: techReq ?? null,
    };
    const gapResult = analyzeProjectGaps(projectShape);

    // ── Recommended profiles per gap (live, non-persisted matches) ───────────
    // Only gaps whose recommended partner type is actually allowed at the
    // project's determined stage are surfaced (e.g. at CONCEPT only consultants
    // and grant providers are relevant — EPC / DFI / O&M gaps are suppressed).
    // `match_count` is the FULL stage-allowed pool for the gap so the UI can
    // show "N consultants found"; `candidates` is the top slice of it.
    const stageAllowedGaps = gapResult.gaps.filter((g: any) => isGapAllowedAtStage(stageResult!.stageEnum, g));
    const { capital, technical, consultant, trader } = await computePreviewMatches(supabase, projectShape as any);
    const recommendedProfiles = stageAllowedGaps
      .filter((g: any) => g.recommendation.partnerType)
      .map((g: any) => {
        const all = matchCandidatesForGap(g, capital, technical, stageResult!.stageEnum, Number.MAX_SAFE_INTEGER, consultant, trader);
        return {
          gapId: g.id,
          label: g.label,
          severity: g.severity,
          recommendation: g.recommendation,
          match_count: all.length,
          candidates: all.slice(0, 3),
        };
      });

    await writeAuditLog({
      userId: user.id,
      action: 'PROJECT_READINESS_PREVIEWED',
      entityType: 'projects',
      entityId: projectId,
      after: {
        project_stage: stageResult!.stageEnum,
        gaps: stageAllowedGaps.length,
        cached: !!cached,
        documents_read: stageResult!.documentsRead,
        evidence_based: stageResult!.evidenceBased,
      },
      req,
    });

    return Response.json({
      success: true,
      data: {
        preliminary: true,
        form_hash: formHash,
        stage: stageResult!.stageInfo,
        stage_rationale: stageResult!.stage_rationale,
        recommended_services: stageResult!.recommended_services,
        // The preliminary readiness score, from the same evidence engine that
        // produces the final score after review — so the number a developer sees
        // while filling the form is the same metric they see once submitted.
        score: stageResult!.score,
        band: stageResult!.band,
        stage_consistent: stageResult!.stageConsistent,
        // A document-verified score can also sit BELOW its stage's band, which is
        // normal early on — only "above the band" is a contradiction worth
        // surfacing, so the direction is sent explicitly.
        stage_score_above_band: stageResult!.scoreAboveBand,
        // Document-driven provenance: how many uploaded documents the AI read,
        // which it excluded as not belonging to this project, which it could not
        // read, and whether the score is evidence-based or claims-only.
        evidence_based: stageResult!.evidenceBased,
        documents_read: stageResult!.documentsRead,
        documents_excluded: stageResult!.documentsExcluded,
        documents_skipped: stageResult!.documentsSkipped,
        score_withheld: stageResult!.scoreWithheld,
        disclaimer: stageResult!.disclaimer,
        // Documentation completeness: how many of the gap rules are satisfied.
        // Deliberately named for what it measures rather than "readiness", since
        // it counts requirement coverage rather than evidence strength.
        documentation_completeness: gapResult.overallReadiness,
        summary: gapResult.summary,
        gaps: gapResult.gaps,
        recommendedProfiles,
      },
    });
  } catch (e: any) {
    console.error('[readiness] INTERNAL ERROR:', e?.message, e?.stack);
    if (process.env.NODE_ENV === 'development') {
      return Response.json({ success: false, error: e?.message, stack: e?.stack?.split('\n').slice(0, 5) }, { status: 500 });
    }
    return handleRouteError(e);
  }
}
