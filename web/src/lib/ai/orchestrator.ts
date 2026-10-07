import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../supabase-server';
import { getAIConfig, type AIConfig } from './config';
import { createProvider } from './factory';
import { resolveModel, estimateCost } from './catalog';
import { normalizeDocument } from './document-processing';
import { SYSTEM_PROMPT, buildUserPrompt, projectProfileKey, type ProjectProfile } from './prompt';
import { evidenceOutputSchema, AIProviderError, type EvidenceOutput, type AIUsage } from './types';
import { reconcileDocuments, reconciliationRiskFlags, mustWithholdScore, withheldScoreResult } from './reconciliation';
import { generateRatingInsight, type RatingInsight } from './rating-insight';
import {
  scoreProject, SCORING_V2, verifyScoreInvariant, explainPillars,
  type ResolvedEvidence, type EvidenceEntry, type ScoreResult, type ScoreOptions, GATED_KEYS,
} from '../scoring/engine';
import { mergeEvidence, formClaimsFromProject } from '../scoring/merge';
import { isSubmittedForReview } from '../project-state-machine';
import { analysisFormSignal, computeAnalysisSignalHash } from '../analysis-guard';

// ── Canonical JSON (for cache keys) ──────────────────────────────────────────

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as object)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * The project-profile fields that shape the evidence-extraction prompt. The
 * per-document cache key must include these: the prompt tells the model which
 * project the file must belong to, so a capacity/name/location edit changes the
 * verdict (`belongs_to_project` / `contradicts_project`) for the SAME file. If
 * the key were content-only, the old verdict — e.g. "document contradicts the
 * project's 50 MW" — would be replayed verbatim after the capacity changed.
 */
export function profileCacheKey(profile: ProjectProfile): string {
  return sha256(projectProfileKey(profile));
}

// ── Budget guard ──────────────────────────────────────────────────────────────

export async function assertWithinBudget(sb: SupabaseClient, cfg: AIConfig): Promise<void> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data } = await sb
    .from('ai_usage_logs')
    .select('estimated_cost')
    .gte('created_at', monthStart.toISOString());

  const spent = (data ?? []).reduce((s, r) => s + Number(r.estimated_cost), 0);
  if (spent >= cfg.platformMonthlyBudgetUsd) {
    throw new AIProviderError(
      'BUDGET_EXCEEDED',
      `Platform AI budget exhausted ($${spent.toFixed(2)} / $${cfg.platformMonthlyBudgetUsd})`,
    );
  }
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

interface CacheKey { hash: string; provider: string; model: string; pv: number }

export async function getCached(sb: SupabaseClient, k: CacheKey): Promise<EvidenceOutput | null> {
  const { data } = await sb
    .from('ai_analysis_cache')
    .select('result')
    .match({ content_hash: k.hash, provider: k.provider, model: k.model, prompt_version: k.pv })
    .maybeSingle();
  return data ? (data.result as EvidenceOutput) : null;
}

export async function putCache(
  sb: SupabaseClient,
  k: CacheKey,
  result: EvidenceOutput,
  usage: AIUsage,
): Promise<void> {
  await sb.from('ai_analysis_cache').upsert({
    content_hash: k.hash,
    provider: k.provider,
    model: k.model,
    prompt_version: k.pv,
    result,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
  });
}

// ── Usage logging ─────────────────────────────────────────────────────────────

export async function logUsage(
  sb: SupabaseClient,
  p: {
    projectId?: string;
    userId?: string;
    docId?: string;
    provider: string;
    model: string;
    type: string;
    status: string;
    usage: AIUsage;
    cost: number;
    errorCode?: string;
  },
): Promise<void> {
  await sb.from('ai_usage_logs').insert({
    project_id: p.projectId ?? null,
    user_id: p.userId ?? null,
    document_id: p.docId ?? null,
    provider: p.provider,
    model: p.model,
    request_type: p.type,
    status: p.status,
    input_tokens: p.usage.inputTokens,
    output_tokens: p.usage.outputTokens,
    estimated_cost: p.cost,
    latency_ms: p.usage.latencyMs,
    error_code: p.errorCode ?? null,
  });
}

// ── Storage helper ────────────────────────────────────────────────────────────

const DOC_BUCKET = 'project-documents';

export async function downloadDocument(
  sb: SupabaseClient,
  storagePath: string,
): Promise<ArrayBuffer> {
  const { data, error } = await sb.storage.from(DOC_BUCKET).download(storagePath);
  if (error || !data) {
    throw new AIProviderError('PROVIDER_ERROR', `Document download failed: ${error?.message}`);
  }
  return data.arrayBuffer();
}

// ── Evidence persistence ──────────────────────────────────────────────────────

export async function persistEvidence(
  sb: SupabaseClient,
  projectId: string,
  analysisId: number,
  provider: string,
  model: string,
  promptVersion: number,
  merged: ResolvedEvidence,
): Promise<void> {
  // Latest analysis replaces previous evidence rows
  await sb.from('ai_evidence').delete().eq('project_id', projectId);

  const rows = Object.values(merged)
    .filter((e): e is EvidenceEntry => !!e)
    .map((e) => ({
      project_id: projectId,
      analysis_id: analysisId,
      document_id: e.documentId ?? null,
      evidence_key: e.key,
      value: { satisfied: e.satisfied, contested: e.contested ?? false },
      confidence: e.confidence,
      source: e.source,
      excerpt: e.excerpt ?? null,
      provider,
      model,
      prompt_version: promptVersion,
    }));

  for (let i = 0; i < rows.length; i += 500) {
    await sb.from('ai_evidence').insert(rows.slice(i, i + 500));
  }
}

/**
 * Persist the scored result onto project_scores.
 *
 * The scalar columns are filled ONLY from the pillar that genuinely backs them
 * (see PILLAR_META). Historical code wrote the Land pillar into
 * `developer_score`, which rendered as "Developer 10/25" — a value that had
 * nothing to do with developer strength. Pillars with no matching scalar column
 * (grid, construction) are persisted in `breakdown.pillars` and still count
 * towards the headline score.
 */
function scalarColumns(pillars: ScoreResult['pillars']): {
  regulatory_score: number;
  financial_score: number;
  developer_score: number;
} {
  const earned = (key: string) => pillars.find((p) => p.key === key)?.earned ?? 0;
  // developer_score has no backing pillar in SCORING_V2 — it is left at 0 rather
  // than filled from an unrelated pillar. See readPillarMaxima in the UI, which
  // renders "—" for dimensions the engine does not measure.
  return {
    regulatory_score: Math.round(earned('regulatory')),
    financial_score: Math.round(earned('financial')),
    developer_score: 0,
  };
}

// ── Rating explanations ───────────────────────────────────────────────────────

/**
 * Build the scorecard the explanation prompt is written from, and keep the same
 * ledger for persistence.
 *
 * The ledger is the deterministic half of the explanation: it records what each
 * milestone inside each pillar actually won. Passing it to the model is what
 * keeps the model's prose tethered to the score — it can only talk about the
 * contributions listed here.
 */
/**
 * The human label the AI was shown for a document, rebuilt from the loaded
 * project so the brief can name the same document the developer recognises.
 * Mirrors `analysisLabelForDoc` in the panel.
 */
function documentLabelFor(
  docs: { id: string; document_type?: string; storage_path?: string }[],
  docId: string,
): string {
  const doc = docs.find((d) => d.id === docId);
  if (!doc) return 'uploaded document';
  if (doc.document_type) return doc.document_type.replace(/_/g, ' ');
  const file = doc.storage_path?.split('/').pop() ?? '';
  return file.replace(/^\d+_/, '') || 'uploaded document';
}

function buildInsightInput(args: {
  project: Record<string, unknown>;
  scored: ScoreResult;
  evidence: ResolvedEvidence;
  scoreOptions: ScoreOptions;
  caveats: string[];
  /** Per-document extraction results, so the brief can describe what each one says. */
  docResults: { docId: string; out: EvidenceOutput; label: string }[];
}) {
  const { scored, scoreOptions } = args;
  const ledger = explainPillars(SCORING_V2, args.evidence, scoreOptions);

  // Gate labels for the blocking milestones come from the ledger where the key
  // is a scoring rule; the fallback keeps an unknown key readable rather than raw.
  const labelByKey = new Map<string, string>(
    ledger.flatMap((p) => p.contributions.map((c) => [c.key, c.label] as const)),
  );
  const labelFor = (key: string) => labelByKey.get(key) ?? key.replace(/_/g, ' ');

  return {
    input: {
      project: {
        name: (args.project.name as string) ?? 'this project',
        technology: (args.project.technology_type as string) ?? null,
        capacityMW: (args.project.project_size_mw as number) ?? null,
        location: [args.project.location_region, args.project.location_country]
          .filter(Boolean)
          .join(', ') || null,
      },
      score: scored.score,
      maxScore: scored.maxScore,
      stage: scored.stage,
      stageLabel: scored.stageLabel,
      ledger,
      blocking: scored.gaps.map((g) => ({ key: g.key, label: labelFor(g.key) })),
      caveats: args.caveats,
      projectFacts: [
        (args.project.name as string) ? `Project: ${args.project.name as string}` : null,
        (args.project.technology_type as string) ? `Technology: ${args.project.technology_type as string}` : null,
        (args.project.project_size_mw as number) != null
          ? `Capacity: ${args.project.project_size_mw as number} MW` : null,
        [args.project.location_region, args.project.location_country].filter(Boolean).join(', ') || null,
        (args.project.developer_name as string) ? `Developer: ${args.project.developer_name as string}` : null,
        (args.project.counterparty_name as string) ? `Counterparty: ${args.project.counterparty_name as string}` : null,
      ].filter((v): v is string => typeof v === 'string' && v.length > 0),
      /**
       * The per-document digests the evidence stage already produced. Feeding
       * these back in is what lets the brief say "the signed PPA shows a 20-year
       * term" instead of restating the ledger, which is the difference between
       * a report that reads like it read the paperwork and one that does not.
       */
      documentDigests: args.docResults.map((d) => ({
        label: d.label,
        type: d.out.document_type,
        summary: d.out.summary,
        findings: d.out.key_findings ?? [],
        integrity: d.out.authenticity?.assessment ?? '',
      })),
    },
    ledger,
  };
}

// ── Risk flag collector ───────────────────────────────────────────────────────

export function collectRisks(
  docResults: { out: EvidenceOutput }[],
  skipped: { name: string; reason: string }[],
  merged: ResolvedEvidence,
): { severity: 'low' | 'medium' | 'high'; flag: string; detail: string }[] {
  const risks = docResults.flatMap((d) => d.out.risk_flags);

  if (skipped.length) {
    risks.push({
      severity: 'medium',
      flag: 'documents_skipped',
      detail: `Not analyzed: ${skipped.map((s) => `${s.name} (${s.reason})`).join('; ')}`,
    });
  }

  for (const e of Object.values(merged)) {
    if (e?.contested) {
      risks.push({
        severity: 'high',
        flag: 'conflicting_evidence',
        detail: `Documents disagree on "${e.key}" — reviewer must verify manually.`,
      });
    }
    if (e?.satisfied && e.source === 'self_reported' && GATED_KEYS.includes(e.key)) {
      risks.push({
        severity: 'medium',
        flag: 'unverified_claim',
        detail: `Developer claims "${e.key}" but no uploaded document proves it.`,
      });
    }
  }

  return risks;
}

type RiskFlag = { severity: 'low' | 'medium' | 'high'; flag: string; detail: string };

const SEVERITY_RANK: Record<RiskFlag['severity'], number> = { high: 3, medium: 2, low: 1 };

function detailTokens(detail: string): Set<string> {
  return new Set(
    detail.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3 && !STOPWORDS.has(t)),
  );
}

const STOPWORDS = new Set(['that', 'this', 'with', 'from', 'have', 'been', 'were', 'will', 'they', 'their', 'which', 'into', 'also', 'than', 'when', 'over', 'such', 'only', 'some', 'more', 'most', 'other', 'same', 'very', 'still', 'must', 'each']);

/** True when two details are restatements of one finding rather than new evidence. */
function sameStatement(a: string, b: string): boolean {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la.includes(lb) || lb.includes(la)) return true;

  const ta = detailTokens(a);
  const tb = detailTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared) >= 0.6;
}

/**
 * Collapse repeated risk flags into one row per finding.
 *
 * Risk flags arrive per document, so two documents covering the same open
 * milestone (a financial model and an offtake letter both noting the PPA is
 * unsigned) produce the same finding twice. The stored `project_scores.risk_flags`
 * is a flat list of rendered strings, so the reviewer used to see "MEDIUM:
 * Unexecuted PPA" verbatim twice in a row — which reads as a bug and erodes trust
 * in the report.
 *
 * Merging is deliberately conservative: two flags are the same finding only when
 * their normalised `flag` labels match. Flags with different labels are kept even
 * if their prose overlaps, because merging those risks silently discarding a real
 * finding. The survivor carries the highest severity and the most specific detail.
 */
export function dedupeRiskFlags(flags: RiskFlag[]): RiskFlag[] {
  const byKey = new Map<string, RiskFlag>();

  for (const f of flags) {
    const key = f.flag.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key) continue;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...f });
      continue;
    }

    const keepNew =
      SEVERITY_RANK[f.severity] > SEVERITY_RANK[existing.severity] ||
      (SEVERITY_RANK[f.severity] === SEVERITY_RANK[existing.severity] &&
        f.detail.length > existing.detail.length);

    const winner = keepNew ? { ...f } : existing;
    const loser = keepNew ? existing : f;
    // Fold the loser's detail in only when it actually adds information: it has
    // to be longer than the winner's and not merely a rephrasing of it. Appending
    // a shorter or restated variant just produces "… (also reported: same thing)".
    if (loser.detail && loser.detail.length > winner.detail.length && !sameStatement(loser.detail, winner.detail)) {
      winner.detail = `${winner.detail} (also reported: ${loser.detail})`;
    }
    byKey.set(key, winner);
  }

  return [...byKey.values()].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.flag.localeCompare(b.flag),
  );
}

// ── One-retry wrapper ─────────────────────────────────────────────────────────

async function withOneRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof SyntaxError) return fn(); // invalid JSON → one corrective retry
    throw e;
  }
}

// ── State transition (thin CAS wrapper; project-state-machine.ts is source of truth) ──

const EXPECTED_FROM: Record<string, string[]> = {
  // 'scoring' is already included so the orchestrator is idempotent when
  // analyze/route.ts has already transitioned the project before enqueuing.
  scoring: ['draft', 'scoring_retry', 'scoring', 'under_review', 'live'],
  under_review: ['scoring'],
  scoring_retry: ['scoring'],
};

export async function transitionProjectInternal(
  sb: SupabaseClient,
  projectId: string,
  to: string,
  opts: { expected?: string[]; actor: string; reason?: string },
): Promise<void> {
  const { data: cur } = await sb
    .from('projects')
    .select('status')
    .eq('id', projectId)
    .single();

  // Already at target — idempotent, nothing to do.
  if (cur?.status === to) return;

  const expected = opts.expected ?? EXPECTED_FROM[to] ?? [];
  if (!cur || !expected.includes(cur.status)) {
    throw new Error(`transition to ${to} blocked: project is ${cur?.status ?? 'unknown'}`);
  }

  const { data, error } = await sb
    .from('projects')
    .update({ status: to })
    .eq('id', projectId)
    .eq('status', cur.status)
    .select('id')
    .single();

  if (error || !data) throw new Error(`CAS transition to ${to} failed`);

  // Best-effort history insert — table may not exist in older envs.
  // actor_id is a uuid column — only insert when it is a valid uuid.
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const actorUuid = uuidRe.test(opts.actor) ? opts.actor : null;
  await sb.from('project_status_history').insert({
    project_id: projectId,
    from_status: cur.status,
    to_status: to,
    actor_id: actorUuid,
    reason: opts.reason ?? null,
  }).then(({ error: e }) => {
    if (e) console.warn('[Orchestrator] status history insert skipped:', e.message);
  });
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function runProjectAnalysis(jobId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const cfg = await getAIConfig(sb);
  const provider = createProvider(cfg.activeProvider);
  const model = await resolveModel(sb, cfg.activeProvider, cfg.activeModel);

  const { data: job } = await sb
    .from('ai_jobs')
    .select('*, projects(*)')
    .eq('id', jobId)
    .single();

  if (!job) throw new Error(`Job ${jobId} not found`);
  const project = (job as any).projects;

  // Developer company name — used by the reconciliation profile for party
  // matching (a document naming the developer/SPV is positive identity).
  let developerName: string | null = null;
  if (project?.developer_id) {
    const { data: devCompany } = await sb
      .from('companies')
      .select('name')
      .eq('id', project.developer_id)
      .maybeSingle();
    developerName = devCompany?.name ?? null;
  }

  try {
    await assertWithinBudget(sb, cfg);

    // A project only enters the review pipeline when the developer's FINAL
    // submission moves it to `scoring` (POST /api/projects/[id]/submit). A job
    // can be queued while the project is still a `draft` (a document uploaded
    // mid-form, or a manual re-analysis from the project/insights pages); those
    // runs must score the project WITHOUT touching its status, so an unfinished
    // draft can never end up in the review queue.
    const submittedFlow = isSubmittedForReview(project?.status);
    if (submittedFlow) {
      await transitionProjectInternal(sb, project.id, 'scoring', { actor: 'system:ai' });
    }

    const { data: docRows } = await sb
      .from('project_documents')
      .select('id, document_type, storage_path, file_hash, mime_type')
      .eq('project_id', project.id)
      .is('deleted_at', null);

    // Recompute the guard's signal hash from the state this run actually saw, so
    // the stored hash matches what a later `/analyze` computes. The doc-hash
    // filter mirrors the route exactly — a document without a file_hash (or one
    // stored outside this project's prefix) must be ignored on both sides or the
    // two hashes would never agree and the cache would permanently miss.
    const { data: techReqForSignal } = await sb
      .from('project_tech_requirements')
      .select('grid_status, ppa_status, required_services')
      .eq('project_id', project.id)
      .maybeSingle();

    const signalDocHashes = (docRows ?? [])
      .filter((d) => d.file_hash && d.storage_path?.startsWith(`${project.id}/`))
      .map((d) => d.file_hash!)
      .sort();

    const analysisSignalHash = computeAnalysisSignalHash(
      signalDocHashes,
      analysisFormSignal(project ?? {}, techReqForSignal ?? null),
    );

    const evidenceByDoc: { docId: string; out: EvidenceOutput }[] = [];
    const skipped: { name: string; reason: string }[] = [];
    let totalCost = 0;

    // The extraction verdict is profile-relative (does THIS file belong to THIS
    // project?), so the cache key folds in the project profile as well as the
    // file hash — otherwise a capacity/name edit would replay the stale verdict.
    const profileHash = profileCacheKey({
      name: project.name,
      developer: developerName,
      technology: project.technology_type,
      capacityMW: project.project_size_mw,
      location: [project.location_region, project.location_country].filter(Boolean).join(', ') || null,
    });

    for (const doc of docRows ?? []) {
      const cacheKey: CacheKey = {
        hash: doc.file_hash ? `${doc.file_hash}:${profileHash}` : sha256(doc.storage_path),
        provider: provider.id,
        model: model.id,
        pv: cfg.promptVersion,
      };

      const cached = await getCached(sb, cacheKey);
      if (cached) {
        await logUsage(sb, {
          projectId: project.id, docId: doc.id, provider: provider.id, model: model.id,
          type: 'evidence_extraction', status: 'cache_hit',
          usage: { inputTokens: 0, outputTokens: 0, latencyMs: 0 }, cost: 0,
        });
        evidenceByDoc.push({ docId: doc.id, out: cached });
        continue;
      }

      let bytes: ArrayBuffer;
      try {
        bytes = await downloadDocument(sb, doc.storage_path);
      } catch (err) {
        skipped.push({ name: doc.document_type ?? doc.storage_path, reason: 'download failed' });
        continue;
      }

      const mimeType = doc.mime_type ?? 'application/pdf';
      let content;
      try {
        content = await normalizeDocument(
          { bytes, mimeType, name: doc.document_type ?? doc.storage_path },
          cfg.maxCharsPerDoc,
        );
      } catch (err) {
        skipped.push({ name: doc.document_type ?? doc.storage_path, reason: 'normalization failed' });
        continue;
      }

      if (content.kind === 'vision' && !model.vision) {
        skipped.push({ name: doc.document_type ?? doc.storage_path, reason: 'provider lacks vision' });
        continue;
      }

      let res;
      try {
        const profile: ProjectProfile = {
          name: project.name,
          developer: developerName,
          technology: project.technology_type,
          capacityMW: project.project_size_mw,
          location: [project.location_region, project.location_country].filter(Boolean).join(', ') || null,
        };
        res = await withOneRetry(() =>
          provider.extractEvidence({
            systemPrompt: SYSTEM_PROMPT,
            userPrompt: buildUserPrompt(
              { name: doc.document_type ?? doc.storage_path, category: doc.document_type ?? 'unknown' },
              undefined,
              profile,
            ),
            content,
            model: model.id,
            maxOutputTokens: Math.min(model.maxOutputTokens, 4000),
          }),
        );
      } catch (err) {
        skipped.push({ name: doc.document_type ?? doc.storage_path, reason: 'AI call failed' });
        continue;
      }

      const parsed = evidenceOutputSchema.safeParse(res.raw);
      if (!parsed.success) {
        // Log the issues: a schema rejection silently removes a document from
        // scoring, so a drifting model must be visible in the logs.
        console.warn(
          `[Orchestrator] ${doc.document_type ?? doc.storage_path}: AI output rejected by the evidence schema`,
          parsed.error.issues.slice(0, 5),
        );
        skipped.push({ name: doc.document_type ?? doc.storage_path, reason: 'invalid AI output' });
        continue;
      }
      const out: EvidenceOutput = parsed.data;

      const cost = estimateCost(model, res.usage);
      totalCost += cost;

      await putCache(sb, cacheKey, out, res.usage);
      await logUsage(sb, {
        projectId: project.id, docId: doc.id, provider: provider.id, model: model.id,
        type: 'evidence_extraction', status: 'ok', usage: res.usage, cost,
      });
      evidenceByDoc.push({ docId: doc.id, out });
    }

    // ── Reconciliation gate: does each document belong to THIS project? ──────
    // The AI's verdict per document is enforced mechanically: documents that
    // contradict or do not match the project are EXCLUDED from scoring. If no
    // document belongs to the project, the score is withheld (0) instead of
    // being invented from foreign documents (the 61%-with-wrong-docs failure).
    const profile = {
      name: project.name,
      technology_type: project.technology_type,
      project_size_mw: project.project_size_mw,
      location_country: project.location_country,
      location_region: project.location_region,
      company_name: developerName,
    };
    const reconciliation = reconcileDocuments(evidenceByDoc, profile);
    const excludedDocIds = new Set(reconciliation.excluded.map((e) => e.docId));
    const scorableDocs = evidenceByDoc.filter((d) => !excludedDocIds.has(d.docId));

    const merged = mergeEvidence(scorableDocs, formClaimsFromProject(project));
    const scoreOptions: ScoreOptions = {
      threshold: cfg.confidenceThreshold,
      mode: 'full',
    };
    const scoreWithheld = mustWithholdScore(reconciliation);
    const scored = scoreWithheld
      ? withheldScoreResult(reconciliation)
      : scoreProject(merged, SCORING_V2, scoreOptions);

    const riskFlags = dedupeRiskFlags(
      [
        collectRisks(evidenceByDoc, skipped, merged),
        reconciliationRiskFlags(reconciliation),
      ].flat(),
    );

    // ── Rating explanations ────────────────────────────────────────────────
    // One extra call that turns the computed score into a sentence per rating.
    // It runs AFTER scoring and can never change a number: the engine's ledger
    // is both the input to the prompt and the persisted source of truth for
    // every rating. Failure is non-fatal — the score persists either way.
    const caveats: string[] = [];
    if (scoreWithheld) {
      caveats.push('No analyzed document belongs to this project, so the score is withheld at 0.');
    }
    if (reconciliation.excluded.length > 0) {
      caveats.push(
        `${reconciliation.excluded.length} of ${evidenceByDoc.length} document(s) were excluded as not belonging to this project and did not contribute to the score.`,
      );
    }
    if (skipped.length > 0) {
      caveats.push(`Documents that could not be read: ${skipped.map((s) => `${s.name} (${s.reason})`).join('; ')}.`);
    }
    if (scored.unverifiedStage) {
      caveats.push('The current stage rests on a self-reported claim rather than a document.');
    }

    const { input: insightInput, ledger } = buildInsightInput({
      project,
      scored,
      evidence: merged,
      scoreOptions,
      caveats,
      docResults: evidenceByDoc.map((d) => ({
        docId: d.docId,
        out: d.out,
        label: documentLabelFor(docRows ?? [], d.docId),
      })),
    });

    let ratingInsight: RatingInsight | null = null;
    let insightCost = 0;
    try {
      const result = await generateRatingInsight({
        provider,
        model,
        promptVersion: cfg.promptVersion,
        input: insightInput,
        estimateCost: estimateCost,
      });
      ratingInsight = result.insight;
      insightCost = result.cost;
      await logUsage(sb, {
        projectId: project.id,
        provider: provider.id,
        model: model.id,
        type: 'rating_insight',
        status: result.skippedReason ?? 'ok',
        usage: result.usage,
        cost: result.cost,
        errorCode: result.skippedReason,
      });
    } catch (err) {
      // Defensive: generateRatingInsight already swallows provider and schema
      // failures. This catches anything unforeseen so an explanation can never
      // take down a scoring run that has already succeeded.
      console.warn('[Orchestrator] rating explanation skipped:', (err as Error)?.message);
      await logUsage(sb, {
        projectId: project.id,
        provider: provider.id,
        model: model.id,
        type: 'rating_insight',
        status: 'error',
        usage: { inputTokens: 0, outputTokens: 0, latencyMs: 0 },
        cost: 0,
        errorCode: 'INSIGHT_FAILED',
      });
    }
    totalCost += insightCost;

    const { data: analysis, error: analysisWriteError } = await sb
      .from('ai_analyses')
      .insert({
        project_id: project.id,
        provider: provider.id,
        model: model.id,
        prompt_version: cfg.promptVersion,
        scoring_version: scored.scoringVersion,
        score: scored.score,
        stage: scored.stage,
        pillars: scored.pillars,
        gaps: scored.gaps,
        risk_flags: riskFlags,
        docs_analyzed: evidenceByDoc.length,
        docs_skipped: skipped.length,
        total_cost: totalCost,
      })
      .select('id')
      .single();

    // Checked explicitly: `analysis` being null on a failed insert would
    // otherwise surface as an opaque "cannot read id of null" further down.
    if (analysisWriteError || !analysis?.id) {
      throw new AIProviderError(
        'PROVIDER_ERROR',
        `Failed to record the analysis run: ${analysisWriteError?.message ?? 'no row returned'}`,
      );
    }

    await persistEvidence(
      sb, project.id, analysis.id, provider.id, model.id, cfg.promptVersion, merged,
    );

    // Invariant guard: the headline total is the sum of the pillars, always.
    const mismatch = verifyScoreInvariant(scored.pillars, scored.score);
    if (mismatch) console.error('[Orchestrator]', mismatch, { projectId: project.id });

    // Persist scores to project_scores table (existing schema)
    //
    // The error is checked, not swallowed. supabase-js resolves rather than
    // throws, so an unchecked upsert reports success on a write that never
    // happened — which is how a project ends up `under_review` with no score
    // row and the UI claiming it "wasn't analysed".
    const { error: scoreWriteError } = await sb.from('project_scores').upsert({
      project_id: project.id,
      capital_readiness_score: scored.score,
      ...scalarColumns(scored.pillars),
      breakdown: {
        pillars: scored.pillars,
        gaps: scored.gaps,
        readiness: {
          version: scored.scoringVersion,
          max_score: scored.maxScore,
          derived_total: scored.derivedTotal,
          stage_band: scored.band,
          stage_consistent: scored.consistency.inBand,
          consistency_note: scored.consistency.message,
        },
        evidence_summary: Object.fromEntries(
          Object.entries(merged).map(([k, v]) => [k, { satisfied: v?.satisfied, confidence: v?.confidence, source: v?.source, excerpt: v?.excerpt }]),
        ),
        // Per-document detail for the review UI — includes the reconciliation
        // verdict so reviewers see which documents back the project and which
        // were excluded from scoring.
        document_analysis: evidenceByDoc.map((d) => {
          const rec = reconciliation.perDoc.find((r) => r.docId === d.docId);
          return {
            doc_id: d.docId,
            summary: d.out.summary,
            key_findings: d.out.key_findings ?? [],
            document_type: d.out.document_type,
            authenticity: d.out.authenticity,
            risk_flags: d.out.risk_flags,
            project_match: rec ? {
              status: rec.status,
              excluded: rec.excluded,
              reason: rec.reason,
              identity: rec.identity,
            } : { status: 'unreviewed', excluded: false, reason: 'No reconciliation verdict recorded.', identity: null },
          };
        }),
        reconciliation: {
          docs_analyzed: evidenceByDoc.length,
          docs_matched: reconciliation.included.length,
          docs_excluded: reconciliation.excluded.map((e) => ({ doc_id: e.docId, status: e.status, reason: e.reason })),
          score_withheld: mustWithholdScore(reconciliation),
        },
        /**
         * Why the score is what it is.
         *
         * `ledger` is deterministic and always written — the per-milestone point
         * breakdown behind every pillar rating. `insight` is the model's short
         * prose over that ledger, and may be absent (a failed or rejected call)
         * without affecting the score. `next_steps` prefers the model's ordering
         * when it produced any, falling back to the engine's gap list.
         */
        rating_insight: {
          ledger,
          insight: ratingInsight
            ? {
                brief: ratingInsight.brief,
                strengths: ratingInsight.strengths,
                weaknesses: ratingInsight.weaknesses,
                overall: ratingInsight.overall,
                stage: ratingInsight.stage,
                pillars: ratingInsight.pillars,
                evidence: ratingInsight.evidence,
                next_steps: ratingInsight.next_steps,
                provider: ratingInsight.provider,
                model: ratingInsight.model,
                prompt_version: ratingInsight.promptVersion,
              }
            : null,
        },
      },
      risk_flags: [
        ...riskFlags.map((r) => `${r.severity.toUpperCase()}: ${r.flag} — ${r.detail}`),
        ...(scored.consistency.message ? [`MEDIUM: Stage/readiness mismatch — ${scored.consistency.message}`] : []),
      ],
      recommendations: ratingInsight?.next_steps.length
        ? ratingInsight.next_steps
        : scored.gaps.map((g) => `Address gap: ${g.key.replace(/_/g, ' ')} (contact a ${g.partnerType})`),
      // The headline summary leads with the model's own one-or-two sentence
      // account of the score; the mechanical provenance line is kept as the
      // fallback so a run without an explanation still says what produced it.
      // The summary is the one-paragraph account a reviewer reads first, so it is
      // prose plus the headline numbers — not a metrics dump. The score, stage
      // and band are already displayed on their own in the panel.
      summary: ratingInsight?.overall
        ? `${ratingInsight.overall} The project sits at ${scored.stageLabel} with a readiness score of ${scored.score} out of ${scored.maxScore}.`
        : `The project sits at ${scored.stageLabel} with a readiness score of ${scored.score} out of ${scored.maxScore}.`,
      determined_stage: scored.stageValue,
      // Prose only. The engine version and provenance line live in
      // `breakdown.readiness`, where they belong; appending them here meant
      // every rendered stage rationale ended in a log line.
      stage_rationale: [
        ratingInsight?.stage,
        mustWithholdScore(reconciliation)
          ? 'The score is withheld because no analyzed document belongs to this project.'
          : '',
      ]
        .filter(Boolean)
        .join(' '),
      // The guard hash for THIS run. `/analyze` computes the identical value to
      // decide cached/proceed, but nothing used to write it back — so the stored
      // hash stayed null and the exact-revert cache could never hit again.
      analysis_signal_hash: analysisSignalHash,
    }, { onConflict: 'project_id' });

    if (scoreWriteError) {
      // A score that was computed but not stored is a failed analysis. Throwing
      // parks the project in `scoring_retry` where an operator can see it,
      // rather than silently completing the run.
      throw new AIProviderError('PROVIDER_ERROR', `Failed to persist scores: ${scoreWriteError.message}`);
    }

    // Close the analysis loop: stamp the run time and clear the dirty flag set
    // by invalidateProjectAnalysis. Without this the cooldown in
    // evaluateAnalysisGuard had no anchor (always "proceed") and the exact-revert
    // cache had nothing to compare against.
    const { error: stampError } = await sb
      .from('projects')
      .update({ last_actual_analysis_at: new Date().toISOString(), analysis_dirty: false })
      .eq('id', project.id);
    if (stampError) {
      console.error('[Orchestrator] Failed to stamp analysis time:', stampError.message, { projectId: project.id });
    }

    // Only a SUBMITTED project completes into the review queue. The status is
    // re-read here (rather than trusting the load-time snapshot) so a submission
    // that happened while the analysis was running still completes correctly.
    // `transitionProjectInternal` throws for an unexpected status and the catch
    // below would turn that into a `scoring_retry`, so gate it explicitly.
    const { data: statusNow } = await sb
      .from('projects').select('status').eq('id', project.id).maybeSingle();
    if (statusNow?.status === 'scoring') {
      await transitionProjectInternal(sb, project.id, 'under_review', { actor: 'system:ai' });
    }

    await sb.from('ai_jobs').update({ status: 'done', finished_at: new Date() }).eq('id', jobId);

  } catch (err) {
    const code = err instanceof AIProviderError ? err.code : 'ANALYSIS_FAILED';
    try {
      await transitionProjectInternal(sb, project.id, 'scoring_retry', {
        actor: 'system:ai',
        reason: code,
        // Only a submitted project is parked in the retry state; a draft is left
        // exactly as the developer left it (they can retry from the wizard).
        expected: ['scoring', 'scoring_retry'],
      });
    } catch { /* best-effort */ }
    await sb.from('ai_jobs').update({
      status: 'error',
      error_code: code,
      finished_at: new Date(),
    }).eq('id', jobId);
    throw err;
  }
}
