/**
 * project-stages.ts — SINGLE SOURCE OF TRUTH for the 8-stage development
 * taxonomy, the stage → recommended-service mapping, and the score band each
 * stage position is allowed to occupy.
 *
 * The AI determines which stage a project is at (1–8) from the form data and
 * documents. This module maps that number to the DB enum value, provides the
 * recommended services/partner types the developer should engage next, and
 * states the readiness band implied by the stage so the two numbers can never
 * silently disagree.
 *
 * Stage flow:
 *   1 Concept → 2 Pre-Feasibility → 3 Full Feasibility → 4 Regulatory Approval
 *   → 5 PPA Ready → 6 Financial Close → 7 Construction → 8 Operation
 */

import type { ProjectStage } from '@/types';

export interface StageInfo {
  /** Position in the lifecycle (1–8). */
  number: number;
  /** DB enum value. */
  value: ProjectStage;
  /** Human label. */
  label: string;
  /** One-line description shown to developers. */
  description: string;
  /** Recommended service codes (match the project form `required_services`). */
  recommendedServices: string[];
  /** Human-readable partner types to engage at this stage. */
  recommendedPartnerTypes: string[];
}

export const PROJECT_STAGE_FLOW: StageInfo[] = [
  {
    number: 1,
    value: 'CONCEPT',
    label: 'Concept',
    description: 'Early project idea — site identified, viability not yet proven.',
    recommendedServices: ['FEASIBILITY_STUDY'],
    recommendedPartnerTypes: ['Consultant', 'Grant Provider'],
  },
  {
    number: 2,
    value: 'PRE_FEASIBILITY',
    label: 'Pre-Feasibility',
    description: 'Initial studies underway — resource assessment, preliminary design.',
    recommendedServices: ['FEASIBILITY_STUDY', 'ENVIRONMENTAL_ASSESSMENT', 'GRID_CONNECTION'],
    recommendedPartnerTypes: ['Consultant', 'Grant Provider'],
  },
  {
    number: 3,
    value: 'FULL_FEASIBILITY',
    label: 'Full Feasibility',
    description: 'Bankable feasibility study in progress — technical, financial, and economic validation.',
    recommendedServices: ['FINANCIAL_ADVISORY', 'EPC_CONSTRUCTION'],
    recommendedPartnerTypes: ['Financial', 'EPC', 'Grant Provider'],
  },
  {
    number: 4,
    value: 'REGULATORY_APPROVAL',
    label: 'Regulatory Approval',
    description: 'Securing environmental and grid approvals (e.g. ZEMA, ERB, ZESCO).',
    recommendedServices: ['LEGAL_ADVISORY', 'ENVIRONMENTAL_ASSESSMENT'],
    recommendedPartnerTypes: ['Consultant', 'Grant Provider'],
  },
  {
    number: 5,
    value: 'PPA_READY',
    label: 'PPA Ready',
    description: 'Offtake secured or well advanced — preparing for financing.',
    recommendedServices: ['FINANCIAL_ADVISORY'],
    recommendedPartnerTypes: ['Financial', 'Grant Provider'],
  },
  {
    number: 6,
    value: 'FINANCIAL_CLOSE',
    label: 'Financial Close',
    description: 'Financing being finalised — contracting the build team.',
    recommendedServices: ['EPC_CONSTRUCTION', 'O_AND_M'],
    recommendedPartnerTypes: ['EPC', 'O&M', 'Grant Provider'],
  },
  {
    number: 7,
    value: 'CONSTRUCTION',
    label: 'Construction',
    description: 'Under construction — planning operations handover and closeout.',
    recommendedServices: ['O_AND_M', 'EPC_CONSTRUCTION'],
    recommendedPartnerTypes: ['O&M', 'EPC', 'Grant Provider'],
  },
  {
    number: 8,
    value: 'OPERATION',
    label: 'Operation',
    description: 'Operational — optimising performance and maintenance.',
    recommendedServices: ['O_AND_M'],
    recommendedPartnerTypes: ['O&M', 'Grant Provider'],
  },
];

export const STAGE_BY_NUMBER: Record<number, StageInfo> = Object.fromEntries(
  PROJECT_STAGE_FLOW.map((s) => [s.number, s]),
);

export const STAGE_BY_VALUE: Record<string, StageInfo> = Object.fromEntries(
  PROJECT_STAGE_FLOW.map((s) => [s.value, s]),
);

/* ────────────────────────────────────────────────────────────────────────────
 * Stage ↔ readiness bands
 *
 * A stage and a readiness score are two views of the same evidence. The stage
 * is derived by walking the evidence gates (see lib/scoring/engine.ts); the
 * score is the sum of the readiness pillars. They must be consistent: a project
 * cannot be "57% capital ready" while sitting at Concept.
 *
 * `min` — cumulative points of the evidence every stage gate up to and
 *   including this stage guarantees (land 10 → +full feasibility 20 →
 *   +EIA completed 8 → +EIA approved 14 & licence 6 → +PPA 8 → +financial
 *   close 4 → +commercial operation 15): 0, 10, 30, 38, 50, 58, 62, 77.
 * `max` — 100 minus the points unreachable while the later gates remain
 *   unproven (a tier group forfeits only the gap between its highest tier and
 *   the best tier still attainable): 44, 54, 66, 74, 86, 91, 95, 100.
 *
 * These are derived, not invented: `deriveStageCeilings()` in
 * lib/scoring/engine.ts recomputes `max` from the pillar rules and gates, and
 * scoring-engine.test.ts asserts this table still matches it. Change a rule
 * point and the test fails until the bands are updated deliberately.
 *
 * `min` is only a guarantee when evidence is document-verified: in preview mode
 * self-reported claims score at 50% discount, so a stage can legitimately sit
 * below its floor. A score *above* `max` is never legitimate.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface StageScoreBand {
  /** Lowest score a document-verified project at this stage should normally hold. */
  min: number;
  /** Highest score logically possible at this stage — above this, stage and score disagree. */
  max: number;
  /** One-line justification shown to developers and reviewers. */
  rationale: string;
}

export const STAGE_SCORE_BANDS: Record<ProjectStage, StageScoreBand> = {
  CONCEPT: {
    min: 0,
    max: 44,
    rationale: 'Land control is not yet documented, so nothing beyond early feasibility, grid-application and modelling evidence can be in place.',
  },
  PRE_FEASIBILITY: {
    min: 10,
    max: 54,
    rationale: 'Land control is documented; the bankable feasibility case is still outstanding.',
  },
  FULL_FEASIBILITY: {
    min: 30,
    max: 66,
    rationale: 'A bankable feasibility study is verified; regulatory approvals are not.',
  },
  REGULATORY_APPROVAL: {
    min: 38,
    max: 74,
    rationale: 'Environmental clearance is verified; EIA approval, the generation licence, offtake and financing are not.',
  },
  PPA_READY: {
    min: 50,
    max: 86,
    rationale: 'Approvals and the generation licence are verified; offtake and financing are outstanding.',
  },
  FINANCIAL_CLOSE: {
    min: 58,
    max: 91,
    rationale: 'A signed PPA is verified; financial close and construction evidence are outstanding.',
  },
  CONSTRUCTION: {
    min: 62,
    max: 95,
    rationale: 'Financial close is verified; operating evidence is outstanding.',
  },
  OPERATION: {
    min: 77,
    max: 100,
    rationale: 'Commercial operation is verified — the full evidence set is attainable.',
  },
};

export interface StageConsistency {
  /** The band this stage is allowed to occupy (null for an unknown stage). */
  band: StageScoreBand | null;
  /** Whether the score sits inside the band. */
  inBand: boolean;
  /** Score exceeds what this stage can logically support. */
  aboveMax: boolean;
  /** Score is below the stage floor (normal for discounted, self-reported evidence). */
  belowMin: boolean;
  /** Human-readable explanation, or null when consistent. */
  message: string | null;
}

/** The score band implied by a stage enum value. */
function bandFor(stage: string | null | undefined): StageScoreBand | null {
  if (!stage) return null;
  return STAGE_SCORE_BANDS[stage as ProjectStage] ?? null;
}

/**
 * Check a readiness score against the band its stage position allows.
 *
 * `level` is 'verified' when the score comes from document evidence, 'preview'
 * when it comes from discounted self-reported claims. Preview scores are not
 * flagged for sitting below the floor — only for exceeding the ceiling, which
 * no amount of self-reporting can justify.
 */
export function evaluateStageConsistency(
  score: number,
  stage: string | null | undefined,
  level: 'verified' | 'preview' = 'verified',
): StageConsistency {
  const band = bandFor(stage);
  if (!band || !Number.isFinite(score)) {
    return { band: null, inBand: true, aboveMax: false, belowMin: false, message: null };
  }

  const aboveMax = score > band.max;
  const belowMin = level === 'verified' && score < band.min;

  if (aboveMax) {
    return {
      band,
      inBand: false,
      aboveMax,
      belowMin,
      message: `Score ${score}/100 exceeds the maximum this stage can support (${band.max}). ${band.rationale}`,
    };
  }
  if (belowMin) {
    return {
      band,
      inBand: false,
      aboveMax,
      belowMin,
      message: `Score ${score}/100 is below the floor expected at this stage (${band.min}) — part of this stage's evidence is unverified or discounted.`,
    };
  }
  return { band, inBand: true, aboveMax, belowMin, message: null };
}

/** Stage number (1–8) for a stage enum value, or null. */
export function stageNumberFromEnum(value: string | null | undefined): number | null {
  if (!value) return null;
  return STAGE_BY_VALUE[value]?.number ?? null;
}

/**
 * Map an AI-determined stage number (1–8) to the DB enum value, or null.
 * Accepts numbers and numeric strings (LLMs occasionally emit "5").
 */
export function stageNumberToEnum(n: number | string | null | undefined): ProjectStage | null {
  if (n == null) return null;
  const num = typeof n === 'string' ? Number.parseInt(n, 10) : n;
  if (!Number.isFinite(num)) return null;
  return STAGE_BY_NUMBER[num]?.value ?? null;
}

/** Get the human label for a stage enum value (falls back to the raw value). */
export function stageLabel(value?: string | null): string {
  if (!value) return 'Not determined';
  return STAGE_BY_VALUE[value]?.label ?? value.replace(/_/g, ' ');
}

/** Recommended services/partner types for a stage enum value. */
export function getStageRecommendations(value: string | null | undefined): {
  services: string[];
  partnerTypes: string[];
} {
  const info = value ? STAGE_BY_VALUE[value] : undefined;
  return {
    services: info?.recommendedServices ?? [],
    partnerTypes: info?.recommendedPartnerTypes ?? [],
  };
}

/**
 * Normalise a partner-type label (from a gap recommendation) into a coarse
 * partner category so we can gate it against the current project stage.
 */
function partnerCategory(label: string): string {
  const l = (label || '').toUpperCase();
  if (l.includes('EPC') || l.includes('CONTRACTOR')) return 'EPC';
  if (l.includes('POWER TRADER') || l.includes('OFFTAKER') || l.includes('OFFTAKE') || l.includes('PPA')) return 'POWER_TRADER';
  if (l.includes('O&M') || l.includes('OPERATOR') || l.includes('O_AND_M')) return 'OAM';
  if (l.includes('GRANT') || l.includes('DEVELOPMENT PARTNER')) return 'GRANT';
  if (
    l.includes('BANK') ||
    l.includes('DFI') ||
    l.includes('FUND') ||
    l.includes('INVESTOR') ||
    l.includes('EQUITY') ||
    l.includes('FINANC')
  )
    return 'FINANCIAL';
  if (l.includes('CONSULT') || l.includes('ADVISOR') || l.includes('SPECIALIST'))
    return 'CONSULTANT';
  return 'CONSULTANT';
}

/** Stage → allowed partner categories (source of truth for matching gates). */
const STAGE_ALLOWED_CATEGORIES: Record<string, string[]> = {
  CONCEPT: ['CONSULTANT', 'GRANT'],
  PRE_FEASIBILITY: ['CONSULTANT', 'GRANT'],
  FULL_FEASIBILITY: ['FINANCIAL', 'EPC', 'GRANT', 'CONSULTANT'],
  REGULATORY_APPROVAL: ['CONSULTANT', 'GRANT'],
  PPA_READY: ['FINANCIAL', 'GRANT', 'POWER_TRADER'],
  FINANCIAL_CLOSE: ['EPC', 'OAM', 'FINANCIAL', 'GRANT'],
  CONSTRUCTION: ['OAM', 'EPC', 'GRANT'],
  OPERATION: ['OAM', 'GRANT'],
};

/**
 * Whether a partner (identified by its type label from a gap recommendation)
 * is allowed to be matched at the given project stage.
 */
export function isPartnerTypeAllowedAtStage(
  stage: string | null | undefined,
  partnerTypeLabel: string
): boolean {
  if (!stage) return true;
  const allowed = STAGE_ALLOWED_CATEGORIES[stage];
  if (!allowed) return true;
  return allowed.includes(partnerCategory(partnerTypeLabel));
}

/** Whether any of the gap's recommended partner types fit the current stage. */
export function isGapAllowedAtStage(stage: string | null | undefined, gap: any): boolean {
  if (!gap?.recommendation?.partnerType) return true;
  return isPartnerTypeAllowedAtStage(stage, gap.recommendation.partnerType);
}

/** All stage enum values in lifecycle order. */
export const PROJECT_STAGE_VALUES: readonly ProjectStage[] = PROJECT_STAGE_FLOW.map((s) => s.value);

