import { z } from 'zod';

export type ProviderId = 'mistral' | 'gemini' | 'deepseek';

/**
 * A model as advertised by `ai_model_catalog` — the single source of truth for
 * which models exist, what they cost, and how much they accept. Providers no
 * longer carry their own copies: a retired model is fixed in one place.
 */
export interface ProviderModel {
  id: string;
  label: string;
  inputPer1M: number;
  outputPer1M: number;
  vision: boolean;
  maxInputTokens: number;
  maxOutputTokens: number;
  enabled: boolean;
}

export interface NormalizedContent {
  kind: 'text' | 'vision';
  text?: string;
  images?: { mimeType: string; base64: string }[];
  meta: { pages?: number; ocrUsed: boolean; truncated: boolean; originalChars: number };
}

export interface EvidenceExtractionInput {
  systemPrompt: string;
  userPrompt: string;
  content: NormalizedContent;
  /** Model id resolved from `ai_model_catalog` (see lib/ai/catalog.ts). */
  model: string;
  maxOutputTokens: number;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface EvidenceExtractionResult {
  raw: unknown;
  usage: AIUsage;
}

export interface AIProvider {
  id: ProviderId;
  extractEvidence(input: EvidenceExtractionInput): Promise<EvidenceExtractionResult>;
}

// ── Evidence keys: the contract between AI output and the scoring engine ──

export const EVIDENCE_KEYS = [
  'land_secured',
  'site_lease',
  'pre_feasibility',
  'full_feasibility',
  'financial_model',
  'eia_completed',
  'eia_approved',
  'generation_licence',
  'grid_application_submitted',
  'grid_connection_agreement',
  'ppa_signed',
  'ppa_under_negotiation',
  'financing_term_sheet',
  'financial_close',
  'construction_started',
  'commercial_operation',
  'permits_general',
] as const;

export type EvidenceKey = (typeof EVIDENCE_KEYS)[number];

/* ──────────────────────────────────────────────────────────────────────────
 * Lenient parsing at the model boundary.
 *
 * Models do not honour JSON types reliably: asked for `belongs_to_project`,
 * `contradicts_project` and `capacity_mw`, the same reply routinely carries
 * "true" / "false" and "50" as STRINGS, and prose where an enum is expected.
 * A strict schema turns that into a total loss — the document is discarded as
 * "invalid AI output" and its evidence never reaches the score, silently. So
 * values are coerced here, and every field falls back to its conservative
 * default rather than failing the parse. A document kept but parsed
 * conservatively is recoverable; a document dropped from scoring is not.
 * ────────────────────────────────────────────────────────────────────────── */

const TRUEISH = new Set(['true', 'yes', 'y', '1', 'high', 'positive', 'confirmed', 'present']);
const FALSEISH = new Set(['false', 'no', 'n', '0', 'low', 'negative', 'none', 'null', 'n/a', 'absent', '']);

/** "50" → 50, "50 MW" → 50, "" / prose → null. */
function coerceNumber(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const match = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/** "true" / "Yes" / 1 → true, "false" / "no" → false; anything unreadable → false. */
function coerceBoolean(value: unknown): unknown {
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return value;
  const v = value.trim().toLowerCase();
  if (TRUEISH.has(v)) return true;
  if (FALSEISH.has(v)) return false;
  return false;
}

/** Drop evidence items whose key is not in the contract instead of losing them all. */
function keepKnownEvidenceKeys(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.filter(
    (item) => !!item && typeof item === 'object' &&
      EVIDENCE_KEYS.includes((item as { key?: EvidenceKey }).key as EvidenceKey),
  );
}

export const evidenceOutputSchema = z.object({
  document_type: z.enum([
    'land_title', 'lease_agreement', 'feasibility_study', 'financial_model',
    'eia_esia', 'regulatory_permit', 'ppa', 'term_sheet', 'financing_agreement',
    'grid_application', 'technical_report', 'pitch_deck', 'other',
  ]).catch('other'),
  authenticity: z.object({
    assessment: z.enum(['authentic', 'likely_authentic', 'uncertain', 'suspicious']).catch('uncertain'),
    notes: z.string().max(1000).catch(''),
  }).catch({ assessment: 'uncertain', notes: '' }),
  evidence: z.preprocess(
    keepKnownEvidenceKeys,
    z.array(z.object({
      key: z.enum(EVIDENCE_KEYS),
      value: z.union([z.boolean(), z.string(), z.number()]),
      confidence: z.preprocess(coerceNumber, z.number().min(0).max(1)).catch(0),
      excerpt: z.string().max(500).optional().catch(undefined),
    })).max(30),
  ).catch([]),
  /**
   * Document ↔ project reconciliation (see lib/ai/reconciliation.ts).
   * What the document ITSELF names about the project it describes — used to
   * mechanically decide whether the document belongs to this project before
   * its evidence can count towards the score.
   */
  project_identity: z.object({
    project_name: z.string().max(300).nullable().optional().catch(null),
    capacity_mw: z.preprocess(coerceNumber, z.number().positive().nullable().optional()).catch(null),
    location: z.string().max(300).nullable().optional().catch(null),
    parties: z.array(z.string().max(200)).max(12).nullable().optional().catch(null),
  }).nullable().optional().catch(null),
  /** The AI's relevance/belonging judgement; exclusion is enforced in code. */
  relevance: z.object({
    level: z.enum(['HIGH', 'MEDIUM', 'LOW']).catch('LOW'),
    // Missing/unreadable identity is treated as "not this project" — the
    // conservative direction, since belonging is what unlocks scoring.
    belongs_to_project: z.preprocess(coerceBoolean, z.boolean()).catch(false),
    contradicts_project: z.preprocess(coerceBoolean, z.boolean().optional()).catch(undefined),
    reason: z.string().min(1).max(1000).catch(''),
  }).optional().catch(undefined),
  key_findings: z.array(z.string().max(300)).max(8).optional().catch(undefined),
  risk_flags: z.array(z.object({
    severity: z.enum(['low', 'medium', 'high']).catch('medium'),
    flag: z.string().max(200).catch(''),
    detail: z.string().max(1000).catch(''),
  })).max(10).catch([]),
  summary: z.string().max(3000).catch(''),
});

export type EvidenceOutput = z.infer<typeof evidenceOutputSchema>;

/* ──────────────────────────────────────────────────────────────────────────
 * Rating explanations.
 *
 * The readiness numbers are computed by the scoring engine, never by the model.
 * This schema carries only the PROSE the model writes about those numbers — a
 * short reason per rating. It deliberately has no field for a score: a model
 * cannot restate a rating here even if it tries, so an explanation can never
 * disagree with the number it explains.
 * ────────────────────────────────────────────────────────────────────────── */

/** Keep only object items, so one malformed entry doesn't void the whole array. */
function keepInsightItems(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.filter((v) => !!v && typeof v === 'object' && !Array.isArray(v));
}

/**
 * Keep only usable strings: non-strings and blank/whitespace-only entries are
 * dropped rather than trimmed to nothing, so a list never renders a bullet with
 * no text in it.
 */
function keepStrings(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

/**
 * One `{ key, why }` line. The key is a plain string, not an enum: an unrecognised
 * key is dropped by the caller rather than failing the parse, because losing one
 * line of prose is never worth losing the rest of the explanation.
 */
const insightLine = z.object({
  key: z.string().max(80).catch(''),
  why: z.string().max(400).catch(''),
}).catch({ key: '', why: '' });

export const ratingInsightSchema = z.object({
  /**
   * The narrative account — the readable "what the AI found" story, in prose.
   *
   * This is prose only, like every other field here: there is nowhere in this
   * schema to put a number, so a narrative can describe evidence but can never
   * restate or contradict a rating.
   */
  brief: z.string().max(4000).catch(''),
  /** What is genuinely working — the proven ground the project stands on. */
  strengths: z.preprocess(keepStrings, z.array(z.string().max(300)).max(8)).catch([]),
  /** What is weak or missing — the honest weaknesses behind the score. */
  weaknesses: z.preprocess(keepStrings, z.array(z.string().max(300)).max(8)).catch([]),
  /** 1–2 sentences on what drives the headline readiness score. */
  overall: z.string().max(800).catch(''),
  /** One entry per pillar, including pillars that scored zero. */
  pillars: z.preprocess(keepInsightItems, z.array(insightLine).max(12)).catch([]),
  /** One entry per evidence key that mattered — the ones that won or lost points. */
  evidence: z.preprocess(keepInsightItems, z.array(insightLine).max(40)).catch([]),
  /** 1–2 sentences on why the project sits at this stage, not the one above. */
  stage: z.string().max(800).catch(''),
  /** At most 3 concrete next actions. */
  next_steps: z.preprocess(keepStrings, z.array(z.string().max(300)).max(5)).catch([]),
});

export type RatingInsightOutput = z.infer<typeof ratingInsightSchema>;

export class AIProviderError extends Error {
  constructor(
    public code: 'PROVIDER_ERROR' | 'INVALID_OUTPUT' | 'BUDGET_EXCEEDED' | 'RATE_LIMITED' | 'UNSUPPORTED_CONTENT',
    message: string,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}
