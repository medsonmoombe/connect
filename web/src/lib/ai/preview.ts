import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../supabase-server';
import { getAIConfig } from './config';
import { createProvider } from './factory';
import { resolveModel, estimateCost } from './catalog';
import { normalizeDocument } from './document-processing';
import { SYSTEM_PROMPT, buildUserPrompt, projectProfileKey, type ProjectProfile as PromptProfile } from './prompt';
import { evidenceOutputSchema, AIProviderError, type EvidenceOutput } from './types';
import { scoreProject, SCORING_V2, SELF_REPORT_DISCOUNT, type ResolvedEvidence } from '../scoring/engine';
import { mergeEvidence, formClaimsFromProject } from '../scoring/merge';
import {
  reconcileDocuments,
  mustWithholdScore,
  withheldScoreResult,
  type ProjectProfile as ReconciliationProfile,
} from './reconciliation';
import type { StageConsistency, StageScoreBand } from '../project-stages';
import {
  assertWithinBudget,
  canonicalJson,
  sha256,
  getCached,
  putCache,
  logUsage,
  downloadDocument,
} from './orchestrator';

export interface PreviewDocumentRow {
  id: string;
  document_type: string | null;
  storage_path: string;
  file_hash: string | null;
  mime_type: string | null;
}

export interface ReadinessPreviewResult {
  score: number;
  stage: number;
  stageLabel: string;
  unverifiedStage: boolean;
  /** Score band the preliminary stage position can support. */
  band: StageScoreBand | null;
  /** Whether the preliminary score agrees with the preliminary stage. */
  consistency: StageConsistency;
  gaps: { key: string; partnerType: string; claimedButUnproven: boolean; label: string }[];
  recommendedPartnerTypes: string[];
  disclaimer: string;
  formHash: string;
  /** Documents the AI actually read through the evidence engine. */
  documentsRead: number;
  /** Documents whose evidence was excluded (foreign / unverifiable). */
  documentsExcluded: number;
  /** Documents that could not be read, with the reason. */
  documentsSkipped: { name: string; reason: string }[];
  /** True when the score comes from real documents, not form claims alone. */
  evidenceBased: boolean;
  /** True when every read document was excluded — the score is withheld at 0. */
  scoreWithheld: boolean;
}

export interface ReadinessPreviewOptions {
  /** Project whose uploaded documents should be read. Omitted → claims-only preview. */
  projectId?: string;
  /** Developer company name — lets document identity matching pass on party names. */
  developerName?: string | null;
  /**
   * Document rows to leave out of the read — e.g. the version a developer is
   * replacing in this session, which the submit pass deletes. Without it the
   * preview would score the document being superseded as well as its replacement.
   */
  excludeDocIds?: string[];
}

/**
 * The professional "first analysis" of project creation.
 *
 * The AI READS EVERY UPLOADED DOCUMENT through the same per-document evidence
 * engine that scores the project at submission, so the stage shown mid-form is
 * the stage the documents actually support — not a guess from the form answers.
 * A document already read for a previous preview or full analysis is served from
 * `ai_analysis_cache` keyed on its file hash, so re-running is free.
 *
 * When no document can be read (none uploaded yet, or all unreadable) the
 * preview falls back to the developer's own claims, scored in preview mode and
 * clearly labelled as unverified.
 */
export async function runReadinessPreview(
  form: Record<string, unknown>,
  userId: string,
  opts: ReadinessPreviewOptions = {},
): Promise<ReadinessPreviewResult> {
  const sb = getSupabaseAdmin();
  const cfg = await getAIConfig(sb);
  const provider = createProvider(cfg.activeProvider);
  const model = await resolveModel(sb, cfg.activeProvider, cfg.activeModel);

  await assertWithinBudget(sb, cfg);

  const promptProfile: PromptProfile = {
    name: str(form.name),
    developer: opts.developerName ?? null,
    technology: str(form.technology_type),
    capacityMW: num(form.project_size_mw),
    location: [form.location_region, form.location_country].filter(Boolean).join(', ') || null,
  };

  // ── Read every uploaded document (one AI call per document, cached by hash) ──
  const docs = opts.projectId
    ? await loadProjectDocuments(sb, opts.projectId, opts.excludeDocIds)
    : [];
  const evidenceByDoc: { docId: string; out: EvidenceOutput }[] = [];
  const skipped: { name: string; reason: string }[] = [];

  // The extraction verdict is profile-relative, so the cache key folds in the
  // profile too — a capacity/name edit must not replay the old verdict for a
  // file whose bytes are unchanged.
  const profileHash = sha256(projectProfileKey(promptProfile));

  for (const doc of docs) {
    const label = documentLabel(doc);
    const cacheKey = {
      hash: doc.file_hash ? `${doc.file_hash}:${profileHash}` : sha256(doc.storage_path),
      provider: provider.id,
      model: model.id,
      pv: cfg.promptVersion,
    };

    const cached = await getCached(sb, cacheKey);
    if (cached) {
      await logUsage(sb, {
        projectId: opts.projectId, docId: doc.id, provider: provider.id, model: model.id,
        type: 'readiness_preview', status: 'cache_hit',
        usage: { inputTokens: 0, outputTokens: 0, latencyMs: 0 }, cost: 0,
      });
      evidenceByDoc.push({ docId: doc.id, out: cached });
      continue;
    }

    let bytes: ArrayBuffer;
    try {
      bytes = await downloadDocument(sb, doc.storage_path);
    } catch {
      skipped.push({ name: label, reason: 'download failed' });
      continue;
    }

    let content;
    try {
      content = await normalizeDocument(
        { bytes, mimeType: doc.mime_type ?? 'application/pdf', name: label },
        cfg.maxCharsPerDoc,
      );
    } catch {
      skipped.push({ name: label, reason: 'could not be parsed' });
      continue;
    }

    // A scanned document needs the vision path — say so rather than scoring it
    // as if it had been read.
    if (content.kind === 'vision' && !model.vision) {
      skipped.push({ name: label, reason: 'scanned document — the active model has no vision support' });
      continue;
    }

    let res;
    try {
      res = await provider.extractEvidence({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(
          { name: label, category: doc.document_type ?? 'unknown' },
          'This document was uploaded while the developer is still completing the project form (mid-form readiness preview). Extract evidence strictly from THIS document; the project profile facts may still change.',
          promptProfile,
        ),
        content,
        model: model.id,
        maxOutputTokens: Math.min(model.maxOutputTokens, 4000),
      });
    } catch (err) {
      skipped.push({
        name: label,
        reason: err instanceof AIProviderError ? `AI call failed (${err.code.toLowerCase()})` : 'AI call failed',
      });
      continue;
    }

    const parsed = evidenceOutputSchema.safeParse(res.raw);
    if (!parsed.success) {
      // One unreadable extraction must not break the whole preview — the
      // document is reported as unreviewed and scored as if absent. The issues
      // are logged so a drifting model is diagnosable rather than silent.
      console.warn(`[Readiness] ${label}: AI output rejected by the evidence schema`, parsed.error.issues.slice(0, 5));
      skipped.push({ name: label, reason: 'the AI response did not match the expected evidence schema' });
      continue;
    }
    const out: EvidenceOutput = parsed.data;

    await putCache(sb, cacheKey, out, res.usage);
    await logUsage(sb, {
      projectId: opts.projectId, docId: doc.id, provider: provider.id, model: model.id,
      type: 'readiness_preview', status: 'ok', usage: res.usage, cost: estimateCost(model, res.usage),
    });
    evidenceByDoc.push({ docId: doc.id, out });
  }

  // ── Reconciliation: only documents that belong to THIS project may count ──
  const reconProfile: ReconciliationProfile = {
    name: promptProfile.name,
    technology_type: (form.technology_type as string) ?? null,
    project_size_mw: num(form.project_size_mw),
    location_country: (form.location_country as string) ?? null,
    location_region: (form.location_region as string) ?? null,
    company_name: opts.developerName ?? null,
  };
  const reconciliation = reconcileDocuments(evidenceByDoc, reconProfile);
  const excludedIds = new Set(reconciliation.excluded.map((e) => e.docId));
  const scorableDocs = evidenceByDoc.filter((d) => !excludedIds.has(d.docId));

  const evidenceBased = evidenceByDoc.length > 0;
  const scoreWithheld = evidenceBased && mustWithholdScore(reconciliation);

  // With documents in hand the score is document-backed — the same mode the
  // final analysis runs in, so what the developer sees here is what the engine
  // stores at submission. With nothing readable it is a discounted reading of
  // their own claims, flagged unverified.
  const scored = scoreWithheld
    ? withheldScoreResult(reconciliation)
    : evidenceBased
      ? scoreProject(
          // Documents win; claims fill in what no document speaks to.
          mergeEvidence(scorableDocs, formClaimsFromProject(form)),
          SCORING_V2,
          { threshold: cfg.confidenceThreshold, mode: 'full' },
        )
      : scoreProject(
          claimsOnlyEvidence(form),
          SCORING_V2,
          { threshold: cfg.confidenceThreshold, mode: 'preview' },
        );

  const documentsExcluded = reconciliation.excluded.length;
  // Anything the AI could not read is named explicitly rather than hidden — a
  // stage that ignores a file the developer believes proves it must say why.
  const unreadableNote = skipped.length > 0
    ? ` Not read: ${skipped.map((s) => `${s.name} (${s.reason})`).join('; ')}.`
    : '';
  const disclaimer = scoreWithheld
    ? `None of the ${evidenceByDoc.length} document(s) read belong to this project, so readiness is withheld at 0 and the stage is reset to Concept until genuine project documentation is uploaded.`
    : evidenceBased
      ? `Read from ${evidenceByDoc.length} uploaded document(s) with the same engine that scores the project at submission${documentsExcluded > 0 ? ` (${documentsExcluded} excluded as not belonging to this project)` : ''}.${unreadableNote || ' '} Any document added later is read before the final stage is set.`
      : docs.length > 0
        ? `None of your ${docs.length} uploaded document(s) could be read, so this is an estimate from your answers alone.${unreadableNote}`
        : 'No documents have been read yet — this is an estimate from your answers alone. Upload documents and the AI reads every one of them to place your project accurately.';

  return {
    score: scored.score,
    stage: scored.stage,
    stageLabel: scored.stageLabel,
    unverifiedStage: scored.unverifiedStage,
    band: scored.band,
    consistency: scored.consistency,
    gaps: scored.gaps.map((g) => ({
      ...g,
      label: g.key.replace(/_/g, ' '),
    })),
    recommendedPartnerTypes: [...new Set(scored.gaps.map((g) => g.partnerType))],
    disclaimer,
    formHash: sha256(canonicalJson(form)),
    documentsRead: evidenceByDoc.length,
    documentsExcluded,
    documentsSkipped: skipped,
    evidenceBased,
    scoreWithheld,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Live documents for a project. Superseded versions (`replaced_by`) and
 * soft-deleted rows are skipped, and a file uploaded into several slots is read
 * once — the same bytes prove the same milestones and an extra AI call bills for
 * nothing.
 */
export async function loadProjectDocuments(
  sb: SupabaseClient,
  projectId: string,
  excludeDocIds?: string[],
): Promise<PreviewDocumentRow[]> {
  const excluded = new Set(excludeDocIds ?? []);
  const { data } = await sb
    .from('project_documents')
    .select('id, document_type, storage_path, file_hash, mime_type, replaced_by')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .is('replaced_by', null);

  const seen = new Set<string>();
  const rows: PreviewDocumentRow[] = [];
  for (const row of (data ?? []) as (PreviewDocumentRow & { replaced_by?: string | null })[]) {
    if (!row.storage_path) continue;
    if (excluded.has(row.id)) continue;
    const fingerprint = row.file_hash ?? row.storage_path;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    rows.push(row);
  }
  return rows;
}

/**
 * Evidence map built from the developer's own form answers, used when there is
 * no document to read. Every entry is `self_reported` and discounted, so the
 * engine can still position the stage while flagging it unverified — the same
 * treatment claims get when documents are present.
 */
function claimsOnlyEvidence(form: Record<string, unknown>): ResolvedEvidence {
  const resolved: ResolvedEvidence = {};
  for (const claim of formClaimsFromProject(form)) {
    if (!claim.value) continue;
    resolved[claim.key] = {
      key: claim.key,
      satisfied: true,
      confidence: SELF_REPORT_DISCOUNT,
      source: 'self_reported',
    };
  }
  return resolved;
}

function documentLabel(doc: PreviewDocumentRow): string {
  if (doc.document_type) return doc.document_type.replace(/_/g, ' ');
  return doc.storage_path.split('/').pop()?.replace(/^\d+_/, '') || doc.storage_path;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
