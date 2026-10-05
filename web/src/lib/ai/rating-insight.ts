import type { AIProvider, ProviderModel, RatingInsightOutput } from './types';
import { ratingInsightSchema } from './types';
import { RATING_INSIGHT_SYSTEM_PROMPT, buildRatingInsightPrompt, type RatingInsightInput } from './prompt';
import type { AIUsage } from './types';

/**
 * Rating explanations.
 *
 * The readiness score and every pillar rating are computed by the scoring
 * engine (lib/scoring/engine.ts). This module adds the sentence that tells a
 * developer WHY each of those numbers is what it is, written by the model.
 *
 * The division of labour is deliberate and is the whole safety argument:
 *
 * - The ENGINE decides the numbers and the ledger of what earned each point.
 * - The MODEL only phrases that ledger.
 *
 * The model is therefore never asked for a score, and its output has no field
 * that could hold one. Whatever it returns is filtered against the keys it was
 * actually asked about, so an explanation can be dropped but can never invent a
 * rating, credit a milestone that scored zero, or attach a reason to a pillar
 * that does not exist.
 *
 * Every failure mode here is non-fatal by design: an explanation is an
 * enhancement. A provider error, a schema rejection or an empty reply yields
 * `null`, and the analysis persists with its score and ledger intact.
 */

/** A `{ key, why }` line that survived validation and key-matching. */
export interface InsightLine {
  key: string;
  why: string;
}

/**
 * What gets persisted next to the score in `project_scores.breakdown`.
 *
 * `ledger` is included alongside the prose on purpose: the numbers and their
 * provenance are deterministic and always present, so the UI can render every
 * rating's full breakdown even when the model's wording is missing entirely.
 */
export interface RatingInsight {
  /** The narrative account of the analysis, in prose. */
  brief: string;
  strengths: string[];
  weaknesses: string[];
  overall: string;
  stage: string;
  pillars: InsightLine[];
  evidence: InsightLine[];
  next_steps: string[];
  provider: string;
  model: string;
  promptVersion: number;
  cost: number;
}

export interface RatingInsightResult {
  insight: RatingInsight | null;
  usage: AIUsage;
  cost: number;
  /** Machine-readable reason the explanation is absent, for the usage log. */
  skippedReason?: string;
}

/**
 * Keep only lines whose key was actually asked about, first occurrence wins.
 *
 * This is the guard that makes the explanation safe to render next to a number:
 * a hallucinated pillar key, a duplicated key, or an empty sentence are all
 * dropped here rather than surfacing as an explanation of something real.
 */
export function sanitizeInsightLines(
  lines: { key: string; why: string }[],
  allowedKeys: Iterable<string>,
): InsightLine[] {
  const allowed = new Set(allowedKeys);
  const seen = new Set<string>();
  const out: InsightLine[] = [];

  for (const line of lines) {
    const key = line.key.trim();
    const why = line.why.trim();
    if (!key || !why) continue;
    if (!allowed.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, why });
  }
  return out;
}

export interface GenerateRatingInsightArgs {
  provider: AIProvider;
  model: ProviderModel;
  promptVersion: number;
  input: RatingInsightInput;
  /** Approximate USD cost of the call, for the usage log. */
  estimateCost: (model: ProviderModel, usage: AIUsage) => number;
}

/**
 * Ask the model to explain the ratings. Returns `insight: null` rather than
 * throwing — see the module comment for why this must never fail an analysis.
 */
export async function generateRatingInsight({
  provider,
  model,
  promptVersion,
  input,
  estimateCost,
}: GenerateRatingInsightArgs): Promise<RatingInsightResult> {
  const usage: AIUsage = { inputTokens: 0, outputTokens: 0, latencyMs: 0 };

  let raw: unknown;
  try {
    const res = await provider.extractEvidence({
      systemPrompt: RATING_INSIGHT_SYSTEM_PROMPT,
      userPrompt: buildRatingInsightPrompt(input),
      // Text-only: the ledger already carries every excerpt that matters, so
      // re-sending the documents would cost tokens to say nothing new.
      content: { kind: 'text', meta: { ocrUsed: false, truncated: false, originalChars: 0 } },
      model: model.id,
      // The brief is four paragraphs, so this needs real room. A truncated
      // JSON object fails the schema and loses the whole explanation, which is
      // why the ceiling is generous rather than tight.
      maxOutputTokens: Math.min(model.maxOutputTokens, 2500),
    });
    raw = res.raw;
    usage.inputTokens = res.usage.inputTokens;
    usage.outputTokens = res.usage.outputTokens;
    usage.latencyMs = res.usage.latencyMs;
  } catch {
    // Provider error, rate limit, budget. The score stands on its own.
    return { insight: null, usage, cost: 0, skippedReason: 'provider_error' };
  }

  const cost = estimateCost(model, usage);
  const parsed = ratingInsightSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(
      '[RatingInsight] AI output rejected by the insight schema',
      parsed.error.issues.slice(0, 5),
    );
    return { insight: null, usage, cost, skippedReason: 'invalid_output' };
  }
  const out: RatingInsightOutput = parsed.data;

  const pillarKeys = input.ledger.map((p) => p.key);
  // Every evidence key the model was shown, so an explanation can only ever
  // attach to a milestone that exists in the scoring contract.
  const evidenceKeys = input.ledger.flatMap((p) => p.contributions.map((c) => c.key));

  const pillars = sanitizeInsightLines(out.pillars, pillarKeys);
  const evidence = sanitizeInsightLines(out.evidence, evidenceKeys);

  // Nothing usable came back — treat it as a miss rather than persisting an
  // empty object the UI would have to special-case.
  const strengths = out.strengths.map((s) => s.trim()).filter(Boolean);
  const weaknesses = out.weaknesses.map((s) => s.trim()).filter(Boolean);

  if (
    !out.brief.trim() && !out.overall.trim() && !out.stage.trim()
    && pillars.length === 0 && evidence.length === 0
    && strengths.length === 0 && weaknesses.length === 0
  ) {
    return { insight: null, usage, cost, skippedReason: 'empty_output' };
  }

  return {
    insight: {
      brief: out.brief.trim(),
      strengths,
      weaknesses,
      overall: out.overall.trim(),
      stage: out.stage.trim(),
      pillars,
      evidence,
      next_steps: out.next_steps.map((s) => s.trim()).filter(Boolean),
      provider: provider.id,
      model: model.id,
      promptVersion,
      cost,
    },
    usage,
    cost,
  };
}