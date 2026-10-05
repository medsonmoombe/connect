/**
 * scoring-golden.test.ts — Golden fixtures for the evidence scoring engine.
 *
 * These lock the behaviour of SCORING_V2 against realistic document sets so a
 * change to a pillar rule, a stage gate, or the merge/evidence logic that shifts
 * real-world outcomes fails loudly. Run before every production AI batch.
 */
import { describe, it, expect } from 'vitest';
import { scoreProject, SCORING_V2, deriveTotal, type EvidenceEntry, type ResolvedEvidence } from '../scoring/engine';

const FULL = { threshold: 0.7, mode: 'full' as const };

const doc = (key: any, confidence = 0.9): EvidenceEntry => ({
  key, satisfied: true, confidence, source: 'document',
});
const claim = (key: any): EvidenceEntry => ({
  key, satisfied: true, confidence: 0.5, source: 'self_reported',
});

/** A bankable project: land, full feasibility, approved EIA, licence, grid agreement, model, signed PPA, term sheet. */
const GOLDEN_BANKABLE: ResolvedEvidence = {
  land_secured: doc('land_secured'),
  full_feasibility: doc('full_feasibility'),
  eia_completed: doc('eia_completed'),
  eia_approved: doc('eia_approved'),
  generation_licence: doc('generation_licence'),
  grid_connection_agreement: doc('grid_connection_agreement'),
  financial_model: doc('financial_model'),
  ppa_signed: doc('ppa_signed'),
  financing_term_sheet: doc('financing_term_sheet'),
};

/** A promising but draft-stage project: land + feasibility + EIA filed, PPA only under negotiation. */
const GOLDEN_DRAFT_PPA: ResolvedEvidence = {
  land_secured: doc('land_secured'),
  full_feasibility: doc('full_feasibility'),
  eia_completed: doc('eia_completed'),
  ppa_under_negotiation: doc('ppa_under_negotiation'),
};

/** Everything a developer can tick, nothing document-verified. */
const GOLDEN_CLAIMS_ONLY: ResolvedEvidence = {
  land_secured: claim('land_secured'),
  full_feasibility: claim('full_feasibility'),
  eia_approved: claim('eia_approved'),
  generation_licence: claim('generation_licence'),
  grid_connection_agreement: claim('grid_connection_agreement'),
  ppa_signed: claim('ppa_signed'),
  financial_close: claim('financial_close'),
};

describe('golden scoring — bankable project', () => {
  const r = scoreProject(GOLDEN_BANKABLE, SCORING_V2, FULL);

  it('scores every pillar from documents and stays internally consistent', () => {
    expect(r.score).toBe(deriveTotal(r.pillars));
    expect(r.consistent).toBe(true);
    expect(r.consistency.aboveMax).toBe(false);
    expect(r.consistency.inBand).toBe(true);
  });

  it('cannot claim construction readiness without construction evidence', () => {
    const construction = r.pillars.find((p) => p.key === 'construction');
    expect(construction?.earned).toBe(0);
  });

  it('is well ahead of the draft-stage fixture', () => {
    const draft = scoreProject(GOLDEN_DRAFT_PPA, SCORING_V2, FULL);
    expect(r.score).toBeGreaterThan(draft.score);
    expect(r.stage).toBeGreaterThanOrEqual(draft.stage);
  });
});

describe('golden scoring — draft PPA', () => {
  it('credits the filed EIA but not a signed PPA', () => {
    const r = scoreProject(GOLDEN_DRAFT_PPA, SCORING_V2, FULL);
    const financial = r.pillars.find((p) => p.key === 'financial');
    // ppa_under_negotiation is worth 3; ppa_signed (8) is not present.
    expect(financial?.earned).toBe(3);
    expect(r.score).toBe(deriveTotal(r.pillars));
    expect(r.consistency.inBand).toBe(true);
  });
});

describe('golden scoring — claims only (no documents)', () => {
  it('scores zero and sits at Concept when nothing is document-verified', () => {
    const r = scoreProject(GOLDEN_CLAIMS_ONLY, SCORING_V2, FULL);
    expect(r.score).toBe(0);
    expect(r.stage).toBe(1);
    expect(r.stageValue).toBe('CONCEPT');
    expect(r.consistency.aboveMax).toBe(false);
  });

  it('never lets a self-reported claim advance the stage in verified mode', () => {
    const r = scoreProject(GOLDEN_CLAIMS_ONLY, SCORING_V2, FULL);
    expect(r.stage).toBe(1);
  });
});

describe('golden scoring — monotonicity', () => {
  it('a documented project always beats a claim-only project', () => {
    const documented = scoreProject(GOLDEN_BANKABLE, SCORING_V2, FULL);
    const claimed = scoreProject(GOLDEN_CLAIMS_ONLY, SCORING_V2, FULL);
    expect(documented.score).toBeGreaterThan(claimed.score);
  });
});
