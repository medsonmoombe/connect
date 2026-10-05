import type { EvidenceKey } from '../ai/types';
import {
  STAGE_BY_NUMBER,
  STAGE_SCORE_BANDS,
  evaluateStageConsistency,
  type StageConsistency,
  type StageScoreBand,
} from '../project-stages';

export interface EvidenceEntry {
  key: EvidenceKey;
  satisfied: boolean;
  confidence: number;
  source: 'document' | 'self_reported';
  documentId?: string;
  excerpt?: string;
  contested?: boolean;
}

export type ResolvedEvidence = Partial<Record<EvidenceKey, EvidenceEntry>>;

export const CONFIDENCE_THRESHOLD = 0.70;
export const SELF_REPORT_DISCOUNT = 0.5;
/**
 * Bumped to 3 when the score became strictly derived from the pillars and started
 * carrying its stage band. Rows persisted under version < 3 were produced by an
 * engine whose total was asserted by the LLM and could disagree with its own
 * breakdown — see normalizeBreakdown in this module.
 */
export const SCORING_VERSION = 3;
/** Max attainable score. Every pillar earn is a fraction of this. */
export const READINESS_MAX = 100;

/**
 * `label` is the human name of the milestone the rule proves. It is shown next
 * to the points the rule awarded ("EIA approved +14"), so a developer reading
 * the rating never has to decode a snake_case evidence key.
 */
interface Rule { key: EvidenceKey; label: string; points: number; group?: string }
interface Pillar { key: string; label: string; weight: number; rules: Rule[] }

/**
 * SCORING_V2 — 6-pillar model.
 *
 * Tier groups prevent double-counting: within a group, only the highest
 * satisfied tier scores (e.g. eia_approved replaces eia_completed).
 * Every pillar's max is reachable; partial credit exists at every rung.
 * Total max = 10 + 20 + 20 + 15 + 20 + 15 = 100.
 */
export const SCORING_V2: Pillar[] = [
  {
    key: 'land',
    label: 'Land & Site Control',
    weight: 10,
    rules: [{ key: 'land_secured', label: 'Site control secured', points: 10 }],
  },
  {
    key: 'technical',
    label: 'Technical Readiness',
    weight: 20,
    rules: [
      { key: 'pre_feasibility',  label: 'Pre-feasibility study',     points: 8,  group: 'feasibility' },
      { key: 'full_feasibility', label: 'Bankable feasibility study', points: 20, group: 'feasibility' },
    ],
  },
  {
    key: 'regulatory',
    label: 'Regulatory Readiness',
    weight: 20,
    rules: [
      { key: 'eia_completed',      label: 'EIA prepared and submitted', points: 8,  group: 'eia' },
      { key: 'eia_approved',       label: 'EIA approved by regulator', points: 14, group: 'eia' },
      { key: 'generation_licence', label: 'Generation licence issued', points: 6 },
    ],
  },
  {
    key: 'grid',
    label: 'Grid Readiness',
    weight: 15,
    rules: [
      { key: 'grid_application_submitted', label: 'Grid application filed', points: 6,  group: 'grid' },
      { key: 'grid_connection_agreement',  label: 'Grid connection agreement executed', points: 15, group: 'grid' },
    ],
  },
  {
    key: 'financial',
    label: 'Financial Readiness',
    weight: 20,
    rules: [
      { key: 'financial_model',       label: 'Financial model', points: 5 },
      { key: 'ppa_under_negotiation', label: 'PPA under negotiation', points: 3, group: 'ppa' },
      { key: 'ppa_signed',            label: 'PPA signed', points: 8, group: 'ppa' },
      { key: 'financing_term_sheet',  label: 'Financing term sheet', points: 3 },
      { key: 'financial_close',       label: 'Financial close', points: 4 },
    ],
  },
  {
    key: 'construction',
    label: 'Construction Readiness',
    weight: 15,
    rules: [
      { key: 'construction_started',  label: 'Construction started', points: 10, group: 'construction' },
      { key: 'commercial_operation',  label: 'Commercial operation', points: 15, group: 'construction' },
    ],
  },
];

/**
 * Evidence gate for each of the 8 stages. Labels come from project-stages.ts so
 * the lifecycle vocabulary lives in exactly one place.
 */
const STAGE_GATE_REQUIREMENTS: { stage: number; required: EvidenceKey[] }[] = [
  { stage: 1, required: [] },
  { stage: 2, required: ['land_secured'] },
  { stage: 3, required: ['full_feasibility'] },
  { stage: 4, required: ['full_feasibility', 'eia_completed'] },
  { stage: 5, required: ['eia_approved', 'generation_licence'] },
  { stage: 6, required: ['ppa_signed'] },
  { stage: 7, required: ['financial_close'] },
  { stage: 8, required: ['commercial_operation'] },
];

export const STAGE_GATES: { stage: number; label: string; required: EvidenceKey[] }[] =
  STAGE_GATE_REQUIREMENTS.map((g) => ({ ...g, label: STAGE_BY_NUMBER[g.stage].label }));

/* ────────────────────────────────────────────────────────────────────────────
 * Pillar metadata — the single definition the API layer and the UI both read.
 *
 * `legacyColumn` maps a pillar onto the scalar project_scores column that feeds
 * historical consumers (matching engine, review recommendations). Grid and
 * construction evidence has no scalar column, so it lives only in the pillar
 * breakdown — it is still part of the headline score.
 * ──────────────────────────────────────────────────────────────────────────── */

export type ScoreScalarColumn = 'regulatory_score' | 'technical_score' | 'financial_score' | 'developer_score';

export interface PillarMeta {
  key: string;
  label: string;
  max: number;
  legacyColumn: ScoreScalarColumn | null;
}

export const PILLAR_META: PillarMeta[] = SCORING_V2.map((p) => ({
  key: p.key,
  label: p.label,
  max: p.weight,
  // v2 has no "developer strength" pillar: developer_score must never be filled
  // from an unrelated pillar (it previously carried land control — a defect that
  // rendered as "Developer 10/25"). It stays 0 until a real pillar backs it.
  legacyColumn: p.key === 'regulatory' ? 'regulatory_score'
    : p.key === 'technical' ? 'technical_score'
    : p.key === 'financial' ? 'financial_score'
    : null,
}));

export function pillarMeta(key: string): PillarMeta | undefined {
  return PILLAR_META.find((p) => p.key === key);
}

/** Max score each pillar can contribute, keyed by pillar key. */
export const PILLAR_MAXIMA: Record<string, number> = Object.fromEntries(
  PILLAR_META.map((p) => [p.key, p.max]),
);

/**
 * Legacy LLM breakdown maxima (regulatory 40 / financial 35 / developer 25).
 * Kept only to normalise and reconcile rows produced before SCORING_VERSION 3;
 * no new analysis may write them.
 */
export const LEGACY_BREAKDOWN_MAXIMA = { regulatory: 40, financial: 35, developer: 25 } as const;

export type BreakdownDimension = keyof typeof LEGACY_BREAKDOWN_MAXIMA;

/**
 * One scoring dimension after normalisation: its value, its documented ceiling,
 * and whether the value had to be clamped to fit that ceiling.
 */
export interface NormalizedDimension {
  dimension: BreakdownDimension;
  score: number;
  max: number;
  /** True when an asserted sub-score exceeded its documented maximum and was reduced. */
  clamped: boolean;
}

export interface NormalizedBreakdown {
  dimensions: NormalizedDimension[];
  /** Regulator/financial/developer sub-scores summed strictly from the dimensions. */
  total: number;
  /** Whatever total the AI asserted, for reconciliation reporting. Null when it asserted none. */
  assertedTotal: number | null;
  /** True when the asserted total disagreed with the sub-scores. */
  reconciled: boolean;
  /** Human-readable notes for the audit log; empty when nothing had to be corrected. */
  notes: string[];
}

function asNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/**
 * Normalise an asserted breakdown (AI output or a manual override) into
 * sub-scores that respect their documented maxima, with the total computed
 * from those sub-scores.
 *
 * This is the fix for the class of bug where a stored total (57) disagreed with
 * its own displayed breakdown (14 + 8 + 10 = 32): the total is never trusted, it
 * is composed. A total the caller asserts is returned only as `assertedTotal`,
 * so the caller can log the discrepancy instead of persisting it.
 */
export function normalizeBreakdown(
  breakdown: unknown,
  maxima: Record<BreakdownDimension, number> = LEGACY_BREAKDOWN_MAXIMA,
): NormalizedBreakdown {
  const source = (breakdown ?? {}) as Record<string, unknown>;
  const notes: string[] = [];

  const dimensions = (Object.keys(LEGACY_BREAKDOWN_MAXIMA) as BreakdownDimension[]).map((dimension) => {
    const max = maxima[dimension] ?? LEGACY_BREAKDOWN_MAXIMA[dimension];
    const raw = asNumber((source[dimension] as Record<string, unknown> | undefined)?.score)
      ?? asNumber(source[`${dimension}_score`]);
    const requested = Math.round(raw ?? 0);
    const bounded = Math.min(Math.max(requested, 0), max);
    const clamped = bounded !== requested;
    if (clamped) {
      notes.push(`${dimension} sub-score ${requested} was outside 0–${max}; stored as ${bounded}.`);
    }
    return { dimension, score: bounded, max, clamped };
  });

  const total = dimensions.reduce((sum, d) => sum + d.score, 0);
  const asserted = asNumber(source.total_score);
  const assertedTotal = asserted === null ? null : Math.round(asserted);
  const reconciled = assertedTotal !== null && assertedTotal !== total;
  if (reconciled) {
    notes.push(
      `Asserted total ${assertedTotal} did not match the sub-scores (${dimensions.map((d) => d.score).join(' + ')} = ${total}); the derived total is authoritative.`,
    );
  }

  return { dimensions, total, assertedTotal, reconciled, notes };
}

/**
 * The maxima a stored score was actually measured against, read from its own
 * provenance. A v3 (evidence) score publishes its maxima in `pillars`; a
 * pre-v3 score carries them on each dimension (40/35/25). Callers validating an
 * edit use these so a value from one model can never be written onto a score
 * produced by the other — e.g. a 30/40 regulatory sub-score on a project whose
 * regulatory pillar is measured out of 20.
 */
export function dimensionMaximaFromBreakdown(
  breakdown: unknown,
): Record<BreakdownDimension, number> {
  const source = (breakdown ?? {}) as Record<string, any>;
  const pillars = source.pillars;

  if (Array.isArray(pillars) && pillars.length > 0) {
    const maxFor = (key: string) => {
      const p = pillars.find((x: any) => x?.key === key);
      if (typeof p?.max === 'number') return p.max;
      if (typeof p?.weight === 'number') return p.weight;
      return 0;
    };
    return {
      regulatory: maxFor('regulatory'),
      financial: maxFor('financial'),
      // SCORING_V2 has no developer-strength pillar: nothing may be written here.
      developer: maxFor('developer'),
    };
  }

  const recorded = (dim: BreakdownDimension) =>
    typeof source[dim]?.max === 'number' ? source[dim].max : LEGACY_BREAKDOWN_MAXIMA[dim];
  return {
    regulatory: recorded('regulatory'),
    financial: recorded('financial'),
    developer: recorded('developer'),
  };
}

/**
 * Max attainable score at each stage, derived from the pillar rules and the
 * evidence gates.
 *
 * For stage N, the gate requirements of every later stage are unproven, so each
 * tier group forfeits the gap between its highest gate-gated tier and the best
 * tier still attainable without proving that gate. The result is monotonic and
 * is asserted against STAGE_SCORE_BANDS by scoring-engine.test.ts — if a rule
 * point changes, the bands must be updated deliberately.
 */
export function deriveStageCeilings(
  pillars: Pillar[] = SCORING_V2,
  gates: { stage: number; required: EvidenceKey[] }[] = STAGE_GATES,
): Record<number, number> {
  type RuleInfo = { key: EvidenceKey; points: number; group?: string };
  const rules: RuleInfo[] = pillars.flatMap((p) => p.rules.map((r) => ({ ...r })));
  const gateGated = new Set<EvidenceKey>(gates.flatMap((g) => g.required));

  const groupMembers = new Map<string, RuleInfo[]>();
  for (const r of rules) {
    if (!r.group) continue;
    groupMembers.set(r.group, [...(groupMembers.get(r.group) ?? []), r]);
  }

  const ceilings: Record<number, number> = {};
  for (let stage = 1; stage <= 8; stage++) {
    // Evidence the position PROVES: every requirement of a gate up to and
    // including this stage. Everything else that a gate demands is unproven and
    // cannot be claimed — except a lower tier of a gated group, which a project
    // can genuinely hold without having earned the higher one.
    const proven = new Set<EvidenceKey>(gates.filter((g) => g.stage <= stage).flatMap((g) => g.required));
    const attainable = (r: RuleInfo) => proven.has(r.key) || !gateGated.has(r.key);

    let forfeited = 0;
    for (const r of rules) {
      if (r.group) continue;
      if (!attainable(r)) forfeited += r.points;
    }
    for (const [, members] of groupMembers) {
      const groupMax = Math.max(...members.map((m) => m.points));
      const attainableMax = Math.max(0, ...members.filter(attainable).map((m) => m.points));
      forfeited += Math.max(0, groupMax - attainableMax);
    }

    ceilings[stage] = Math.max(0, READINESS_MAX - forfeited);
  }
  return ceilings;
}

/** The band a stage position allows (from project-stages.ts). */
export function stageBand(stage: number): StageScoreBand | null {
  const info = STAGE_BY_NUMBER[stage];
  return info ? STAGE_SCORE_BANDS[info.value] ?? null : null;
}

export const GAP_PARTNER_MAP: Record<EvidenceKey, string> = {
  land_secured:                'consultant',
  site_lease:                  'consultant',
  pre_feasibility:             'consultant',
  full_feasibility:            'consultant',
  financial_model:             'consultant',
  eia_completed:               'consultant',
  eia_approved:                'authority',
  generation_licence:          'authority',
  grid_application_submitted:  'technical_partner',
  grid_connection_agreement:   'technical_partner',
  ppa_signed:                  'power_trader',
  ppa_under_negotiation:       'power_trader',
  financing_term_sheet:        'capital_partner',
  financial_close:             'capital_partner',
  construction_started:        'technical_partner',
  commercial_operation:        'technical_partner',
  permits_general:             'consultant',
};

/**
 * Keys that must come from a document (not a self-reported claim) to advance
 * a stage gate in full-analysis mode.
 */
export const GATED_KEYS: EvidenceKey[] = [
  'land_secured',
  'eia_approved',
  'generation_licence',
  'grid_connection_agreement',
  'ppa_signed',
  'financial_close',
  'construction_started',
  'commercial_operation',
];

export interface ScoreOptions {
  threshold: number;
  /** full = documents only for stage gates; preview = claims may advance stage (discounted) */
  mode: 'preview' | 'full';
}

function gatePasses(e: EvidenceEntry | undefined, opts: ScoreOptions): boolean {
  if (!e || !e.satisfied || e.contested) return false;
  if (opts.mode === 'preview') return true; // preview may advance on claims — flagged unverified
  return e.source === 'document' && e.confidence >= opts.threshold;
}

/**
 * Tier-group metadata derived from the active pillars. Within a group, keys are
 * maturity tiers ordered by their points (e.g. eia_completed(8) < eia_approved(14),
 * grid_application_submitted(6) < grid_connection_agreement(15),
 * ppa_under_negotiation(3) < ppa_signed(8)). A higher tier implies all lower
 * tiers are satisfied, so a stage gate on a lower-tier key is met by a higher
 * tier too ("EIA approved" is one fact at a higher maturity than "EIA completed").
 */
interface TierMeta { group?: string; points: number }

function buildTierIndex(pillars: Pillar[]): Map<EvidenceKey, TierMeta> {
  const index = new Map<EvidenceKey, TierMeta>();
  for (const p of pillars) {
    for (const r of p.rules) {
      index.set(r.key, { group: r.group, points: r.points });
    }
  }
  return index;
}

/**
 * Does the gate requirement `key` pass? True if the key itself passes, or if a
 * higher tier within the same tier group passes (higher maturity subsumes lower).
 */
function gateRequirementMet(
  key: EvidenceKey,
  evidence: ResolvedEvidence,
  opts: ScoreOptions,
  tierIndex: Map<EvidenceKey, TierMeta>,
): boolean {
  if (gatePasses(evidence[key], opts)) return true;

  const meta = tierIndex.get(key);
  if (!meta?.group) return false;

  for (const [otherKey, otherMeta] of tierIndex) {
    if (
      otherMeta.group === meta.group &&
      otherMeta.points > meta.points &&
      gatePasses(evidence[otherKey], opts)
    ) {
      return true;
    }
  }
  return false;
}

export interface PillarResult {
  key: string;
  label: string;
  /** Max this pillar can contribute. */
  max: number;
  /** Alias of `max`, kept for existing consumers. */
  weight: number;
  earned: number;
  missing: number;
  /** True when the rules summed above `max` and the earn was capped. */
  overflowed: boolean;
}

export interface ScoreResult {
  /** Evidence score: strictly the sum of the pillar earns, 0–100. */
  score: number;
  /** Sum recomputed from the persisted pillar values — must equal `score`. */
  derivedTotal: number;
  /** True when `score === derivedTotal`. False means the pillars and total disagree. */
  consistent: boolean;
  maxScore: number;
  stage: number;
  stageValue: string | null;
  stageLabel: string;
  unverifiedStage: boolean;
  /** Score band the stage position allows (null when the stage is unknown). */
  band: StageScoreBand | null;
  /** Whether the score sits inside that band. */
  consistency: StageConsistency;
  pillars: PillarResult[];
  gaps: { key: EvidenceKey; partnerType: string; claimedButUnproven: boolean }[];
  scoringVersion: number;
}

/**
 * The ONLY legitimate way to produce a readiness total: sum of the pillar earns.
 * Any total that does not equal this is not a readiness score.
 */
export function deriveTotal(pillars: { earned: number }[]): number {
  return Math.round(pillars.reduce((s, p) => s + p.earned, 0));
}

/**
 * Verify the total/pillars invariant before persisting. Returns null when the
 * values agree, otherwise a message suitable for a log or an audit entry.
 */
export function verifyScoreInvariant(
  pillars: { key: string; earned: number }[],
  total: number,
): string | null {
  const derived = deriveTotal(pillars);
  if (derived === total) return null;
  return `Readiness invariant violated: stored total ${total} ≠ Σ pillars ${derived} (${pillars.map((p) => `${p.key}=${p.earned}`).join(', ')}).`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * The point ledger — why a pillar holds the rating it holds.
 *
 * A rating is only useful if it can be defended line by line, so the engine
 * records what each rule inside a pillar actually contributed. This is the
 * factual substrate for the AI explanation: the model is handed these
 * contributions and asked only to phrase them, so its prose can never claim a
 * different number or credit a milestone the engine did not award.
 *
 * Deliberately deterministic — it is the same resolution scoreProject uses, so
 * Σ contribution.points === pillar.earned by construction.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * What the engine did with one milestone inside a pillar.
 *
 * `documented` is the only status that means "proven". The rest are distinct
 * because they need different fixes: a `self_reported` milestone needs a
 * document, a `weak_evidence` one needs a clearer one, a `contested` one needs
 * a human decision, and an `absent` one needs the milestone itself.
 */
export type ContributionStatus =
  | 'documented'
  | 'self_reported'
  | 'contested'
  | 'weak_evidence'
  | 'absent';

export interface KeyContribution {
  key: EvidenceKey;
  /** Human name of the milestone, e.g. "EIA approved by regulator". */
  label: string;
  /** Points this milestone actually contributed to the pillar. */
  points: number;
  /** Points the rule is worth when fully proven. */
  maxPoints: number;
  status: ContributionStatus;
  source: 'document' | 'self_reported' | null;
  confidence: number;
  /** The verbatim text that proved it, when a document did. */
  excerpt?: string;
}

export interface PillarExplanation {
  key: string;
  label: string;
  earned: number;
  max: number;
  contributions: KeyContribution[];
}

/**
 * Points a single rule contributes, and why. This is the single place the
 * scoring mode, the self-report discount and the confidence threshold are
 * applied — the score and the ledger cannot drift apart because there is only
 * one implementation.
 */
function contributionFor(rule: Rule, evidence: ResolvedEvidence, opts: ScoreOptions): KeyContribution {
  const base = { key: rule.key, label: rule.label, maxPoints: rule.points };
  const e = evidence[rule.key];

  if (!e) {
    return { ...base, points: 0, status: 'absent', source: null, confidence: 0 };
  }
  if (e.contested) {
    // Documents disagreed with comparable confidence, so the milestone is left
    // unresolved — a reviewer has to decide, not the engine.
    return {
      ...base, points: 0, status: 'contested',
      source: e.source, confidence: e.confidence, excerpt: e.excerpt,
    };
  }
  if (!e.satisfied) {
    return {
      ...base, points: 0, status: 'absent',
      source: e.source, confidence: e.confidence, excerpt: e.excerpt,
    };
  }
  if (e.source === 'self_reported') {
    // A claim scores half its points in preview mode and nothing in full mode,
    // where documents are required. Either way it is never "documented".
    return {
      ...base,
      points: opts.mode === 'preview' ? rule.points * SELF_REPORT_DISCOUNT : 0,
      status: 'self_reported',
      source: 'self_reported',
      confidence: e.confidence,
      excerpt: e.excerpt,
    };
  }
  if (e.confidence < opts.threshold) {
    // Present but not convincing enough to count on its own.
    return {
      ...base, points: 0, status: 'weak_evidence',
      source: 'document', confidence: e.confidence, excerpt: e.excerpt,
    };
  }
  return {
    ...base, points: rule.points, status: 'documented',
    source: 'document', confidence: e.confidence, excerpt: e.excerpt,
  };
}

/**
 * Contributions for one pillar, with tier-group double-counting resolved: within
 * a group only the highest satisfied tier scores (e.g. `eia_approved` replaces
 * `eia_completed`, and the superseded tier reports 0 points). This is the single
 * resolution used by both the score and the ledger.
 */
export function pillarContributions(
  pillar: Pillar,
  evidence: ResolvedEvidence,
  opts: ScoreOptions,
): KeyContribution[] {
  const resolved = pillar.rules.map((r) => ({ rule: r, c: contributionFor(r, evidence, opts) }));

  for (const group of new Set(pillar.rules.map((r) => r.group).filter((g): g is string => !!g))) {
    const scoring = resolved.filter((x) => x.rule.group === group && x.c.points > 0);
    if (scoring.length < 2) continue;
    // Highest maturity tier wins the group's points, which is what taking the
    // maximum over the satisfied tiers always yielded.
    const winner = scoring.reduce((a, b) => (b.c.points > a.c.points ? b : a));
    for (const x of scoring) {
      if (x !== winner) x.c = { ...x.c, points: 0 };
    }
  }

  return resolved.map((x) => x.c);
}

/**
 * The full ledger: every pillar with what earned and what did not. This is what
 * gets persisted and what the explanation prompt is built from.
 */
export function explainPillars(
  pillars: Pillar[],
  evidence: ResolvedEvidence,
  opts: ScoreOptions,
): PillarExplanation[] {
  return pillars.map((p) => {
    const contributions = pillarContributions(p, evidence, opts);
    return {
      key: p.key,
      label: p.label,
      earned: Math.min(p.weight, contributions.reduce((s, c) => s + c.points, 0)),
      max: p.weight,
      contributions,
    };
  });
}

export function scoreProject(
  evidence: ResolvedEvidence,
  pillars: Pillar[],
  opts: ScoreOptions,
): ScoreResult {
  const pillarResults: PillarResult[] = pillars.map((p) => {
    const contributions = pillarContributions(p, evidence, opts);
    const raw = contributions.reduce((s, c) => s + c.points, 0);
    // A pillar may never contribute more than its declared max, even if rules
    // are added carelessly — the total (and the 0–100 scale) depends on it.
    const earned = Math.min(p.weight, raw);
    return {
      key: p.key,
      label: p.label,
      max: p.weight,
      weight: p.weight,
      earned,
      missing: Math.max(0, p.weight - earned),
      overflowed: raw > p.weight,
    };
  });

  const derivedTotal = deriveTotal(pillarResults);
  const score = derivedTotal;
  const tierIndex = buildTierIndex(pillars);

  let stage = 1;
  let stageLabel = STAGE_GATES[0].label;
  for (const g of STAGE_GATES) {
    const met =
      g.required.length === 0 ||
      g.required.every((k) => gateRequirementMet(k, evidence, opts, tierIndex));
    if (met) {
      stage = g.stage;
      stageLabel = g.label;
    } else {
      break;
    }
  }

  // A stage is "unverified" if any of its required evidence (or a higher tier
  // standing in for it) is only self-reported.
  const unverifiedStage = STAGE_GATES[stage - 1].required.some((k) => {
    const e = evidence[k]?.source === 'self_reported' ? evidence[k] : null;
    if (e) return true;
    const meta = tierIndex.get(k);
    if (!meta?.group) return false;
    for (const [otherKey, otherMeta] of tierIndex) {
      if (
        otherMeta.group === meta.group &&
        otherMeta.points > meta.points &&
        evidence[otherKey]?.source === 'self_reported'
      ) {
        return true;
      }
    }
    return false;
  });

  const nextGate = STAGE_GATES.find((g) => g.stage === stage + 1);
  const gaps = (nextGate?.required ?? [])
    .filter((k) => !gateRequirementMet(k, evidence, opts, tierIndex))
    .map((k) => ({
      key: k,
      partnerType: GAP_PARTNER_MAP[k],
      claimedButUnproven:
        evidence[k]?.satisfied === true && evidence[k]!.source === 'self_reported',
    }));

  const stageValue = STAGE_BY_NUMBER[stage]?.value ?? null;
  const consistency = evaluateStageConsistency(
    score,
    stageValue,
    opts.mode === 'preview' ? 'preview' : 'verified',
  );

  return {
    score,
    derivedTotal,
    consistent: score === derivedTotal,
    maxScore: READINESS_MAX,
    stage,
    stageValue,
    stageLabel,
    unverifiedStage,
    band: consistency.band,
    consistency,
    pillars: pillarResults,
    gaps,
    scoringVersion: SCORING_VERSION,
  };
}
