import { describe, it, expect } from 'vitest';
import {
  scoreProject,
  SCORING_V2,
  STAGE_GATES,
  LEGACY_BREAKDOWN_MAXIMA,
  deriveStageCeilings,
  deriveTotal,
  verifyScoreInvariant,
  normalizeBreakdown,
  dimensionMaximaFromBreakdown,
  type EvidenceEntry,
  type ResolvedEvidence,
} from '../scoring/engine';
import {
  PROJECT_STAGE_FLOW,
  STAGE_SCORE_BANDS,
  STAGE_BY_NUMBER,
  stageNumberFromEnum,
  evaluateStageConsistency,
} from '../project-stages';
import type { ProjectStage } from '@/types';

const doc = (key: any, confidence = 0.9): EvidenceEntry => ({
  key, satisfied: true, confidence, source: 'document',
});
const claim = (key: any): EvidenceEntry => ({
  key, satisfied: true, confidence: 0.5, source: 'self_reported',
});
const FULL = { threshold: 0.7, mode: 'full' as const };

/**
 * Floor implied by the gates: the points every stage position proves, counting a
 * tier group once (a higher tier replaces the lower one it subsumes).
 */
function floorFromGates(): Record<number, number> {
  const meta = new Map<string, { points: number; group?: string }>();
  for (const p of SCORING_V2) for (const r of p.rules) meta.set(r.key, { points: r.points, group: r.group });

  const floors: Record<number, number> = {};
  const groupBest = new Map<string, number>();
  const standalone = new Set<string>();
  let total = 0;

  for (const gate of STAGE_GATES) {
    for (const key of gate.required) {
      const m = meta.get(key);
      if (!m) continue;
      if (m.group) {
        const previous = groupBest.get(m.group) ?? 0;
        const best = Math.max(previous, m.points);
        total += best - previous;
        groupBest.set(m.group, best);
      } else if (!standalone.has(key)) {
        standalone.add(key);
        total += m.points;
      }
    }
    floors[gate.stage] = total;
  }
  return floors;
}

describe('stage taxonomy — one vocabulary', () => {
  it('numbers every stage 1–8 in lifecycle order', () => {
    expect(PROJECT_STAGE_FLOW.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(PROJECT_STAGE_FLOW.map((s) => s.value)).toEqual([
      'CONCEPT', 'PRE_FEASIBILITY', 'FULL_FEASIBILITY', 'REGULATORY_APPROVAL',
      'PPA_READY', 'FINANCIAL_CLOSE', 'CONSTRUCTION', 'OPERATION',
    ]);
  });

  it('gate labels come from the taxonomy, so they cannot drift', () => {
    for (const gate of STAGE_GATES) {
      expect(gate.label).toBe(STAGE_BY_NUMBER[gate.stage].label);
    }
  });

  it('stageNumberFromEnum is the inverse of the stage table', () => {
    for (const stage of PROJECT_STAGE_FLOW) {
      expect(stageNumberFromEnum(stage.value)).toBe(stage.number);
    }
    expect(stageNumberFromEnum(null)).toBeNull();
  });
});

describe('stage ↔ readiness bands', () => {
  it('band ceilings match the ceilings derived from the pillar rules and gates', () => {
    // Drift guard: change a rule point or a gate and this fails until the bands
    // in project-stages.ts are updated deliberately.
    const derived = deriveStageCeilings();
    for (const stage of PROJECT_STAGE_FLOW) {
      expect(STAGE_SCORE_BANDS[stage.value].max).toBe(derived[stage.number]);
    }
  });

  it('band ceilings rise monotonically across the lifecycle', () => {
    const maxes = PROJECT_STAGE_FLOW.map((s) => STAGE_SCORE_BANDS[s.value].max);
    for (let i = 1; i < maxes.length; i++) {
      expect(maxes[i]).toBeGreaterThanOrEqual(maxes[i - 1]);
    }
  });

  it('band floors match the evidence each stage position proves', () => {
    const floors = floorFromGates();
    for (const stage of PROJECT_STAGE_FLOW) {
      expect(STAGE_SCORE_BANDS[stage.value].min).toBe(floors[stage.number]);
    }
  });

  it('flags a score above the stage ceiling, and explains why', () => {
    const result = evaluateStageConsistency(57, 'CONCEPT' as ProjectStage, 'verified');
    expect(result.aboveMax).toBe(true);
    expect(result.inBand).toBe(false);
    expect(result.band?.max).toBe(44);
    expect(result.message).toMatch(/exceeds the maximum this stage can support \(44\)/);
  });

  it('accepts a score inside the band', () => {
    const result = evaluateStageConsistency(32, 'CONCEPT' as ProjectStage, 'verified');
    expect(result.inBand).toBe(true);
    expect(result.message).toBeNull();
  });

  it('does not flag a discounted preview score for sitting below the floor', () => {
    // Preview mode halve-scores self-reported claims, so a stage-2 preview can
    // legitimately score 5 while the stage floor is 10.
    const result = evaluateStageConsistency(5, 'PRE_FEASIBILITY' as ProjectStage, 'preview');
    expect(result.inBand).toBe(true);
  });

  it('flags a verified score below the floor', () => {
    const result = evaluateStageConsistency(5, 'PRE_FEASIBILITY' as ProjectStage, 'verified');
    expect(result.belowMin).toBe(true);
    expect(result.message).toMatch(/below the floor/);
  });
});

describe('score ↔ pillar invariant', () => {
  it('the total is always the sum of the pillars', () => {
    const evidence: ResolvedEvidence = {
      land_secured: doc('land_secured'),
      full_feasibility: doc('full_feasibility'),
      eia_approved: doc('eia_approved'),
      generation_licence: doc('generation_licence'),
      grid_application_submitted: doc('grid_application_submitted'),
      financial_model: doc('financial_model'),
    };
    const r = scoreProject(evidence, SCORING_V2, FULL);
    expect(r.score).toBe(deriveTotal(r.pillars));
    expect(r.consistent).toBe(true);
    expect(verifyScoreInvariant(r.pillars, r.score)).toBeNull();
  });

  it('never lets a pillar exceed its declared maximum', () => {
    const r = scoreProject({}, SCORING_V2, FULL);
    for (const pillar of r.pillars) {
      expect(pillar.earned).toBeLessThanOrEqual(pillar.max);
      expect(pillar.overflowed).toBe(false);
    }
    expect(r.pillars.reduce((s, p) => s + p.max, 0)).toBe(100);
  });

  it('reports a breakdown whose asserted total contradicts its parts', () => {
    // The reported defect: 57 stored against 14 + 8 + 10 = 32.
    const normalized = normalizeBreakdown({
      regulatory: { score: 14, max: 40 },
      financial: { score: 8, max: 35 },
      developer: { score: 10, max: 25 },
      total_score: 57,
    });

    expect(normalized.dimensions.map((d) => d.score)).toEqual([14, 8, 10]);
    expect(normalized.total).toBe(32);
    expect(normalized.assertedTotal).toBe(57);
    expect(normalized.reconciled).toBe(true);
    expect(normalized.notes.join(' ')).toMatch(/Asserted total 57 did not match the sub-scores \(14 \+ 8 \+ 10 = 32\)/);
  });

  it('accepts an asserted total that agrees with the parts', () => {
    const normalized = normalizeBreakdown({
      regulatory: { score: 20 },
      financial: { score: 12 },
      developer: { score: 5 },
      total_score: 37,
    });
    expect(normalized.total).toBe(37);
    expect(normalized.reconciled).toBe(false);
    expect(normalized.notes).toHaveLength(0);
  });

  it('clamps a sub-score that exceeds its maximum', () => {
    const normalized = normalizeBreakdown({ regulatory: { score: 60 } });
    expect(normalized.dimensions[0].score).toBe(LEGACY_BREAKDOWN_MAXIMA.regulatory);
    expect(normalized.dimensions[0].clamped).toBe(true);
    expect(normalized.notes.join(' ')).toMatch(/outside 0–40/);
  });

  it('normalises a negative or missing sub-score to a value inside range', () => {
    const normalized = normalizeBreakdown({ regulatory: { score: -4 }, financial: {} });
    expect(normalized.dimensions[0].score).toBe(0);
    expect(normalized.dimensions[1].score).toBe(0);
    expect(normalized.total).toBe(0);
  });

  it('reads the maxima a stored score was measured against', () => {
    // Evidence-scored row: regulatory and financial are measured out of 20, and
    // there is no developer-strength pillar at all.
    const evidenced = dimensionMaximaFromBreakdown({
      pillars: [
        { key: 'land', max: 10 },
        { key: 'regulatory', max: 20 },
        { key: 'financial', max: 20 },
      ],
    });
    expect(evidenced).toEqual({ regulatory: 20, financial: 20, developer: 0 });

    // Legacy row: the 40/35/25 model.
    expect(dimensionMaximaFromBreakdown({ regulatory: { max: 40 } })).toEqual({
      regulatory: 40,
      financial: 35,
      developer: 25,
    });
  });
});

describe('reported scenario — Concept project', () => {
  it('cannot claim high readiness on form claims alone', () => {
    // Everything a developer can tick on the form, nothing document-verified.
    const claims: ResolvedEvidence = {
      land_secured: claim('land_secured'),
      full_feasibility: claim('full_feasibility'),
      eia_completed: claim('eia_completed'),
      generation_licence: claim('generation_licence'),
      grid_application_submitted: claim('grid_application_submitted'),
      financial_model: claim('financial_model'),
      ppa_under_negotiation: claim('ppa_under_negotiation'),
    };

    // In full (submitted) mode self-reported claims are discarded: score 0,
    // stage Concept, and the two numbers agree.
    const verified = scoreProject(claims, SCORING_V2, FULL);
    expect(verified.score).toBe(0);
    expect(verified.stage).toBe(1);
    expect(verified.stageValue).toBe('CONCEPT');
    expect(verified.consistency.inBand).toBe(true);
    expect(verified.consistency.aboveMax).toBe(false);
    expect(verified.score).toBe(deriveTotal(verified.pillars));
  });

  it('keeps preview scores reproducible and inside the Concept band', () => {
    const preview = scoreProject(
      { land_secured: claim('land_secured'), financial_model: claim('financial_model') },
      SCORING_V2,
      { threshold: 0.7, mode: 'preview' },
    );
    expect(preview.score).toBe(deriveTotal(preview.pillars));
    expect(preview.consistency.aboveMax).toBe(false);
  });
});
