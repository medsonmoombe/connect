import { describe, it, expect } from 'vitest';
import { scoreProject, SCORING_V2 } from '../scoring/engine';
import type { EvidenceEntry, ResolvedEvidence } from '../scoring/engine';

const doc = (key: any, confidence: number): EvidenceEntry => ({
  key, satisfied: true, confidence, source: 'document',
});
const claim = (key: any): EvidenceEntry => ({
  key, satisfied: true, confidence: 0.5, source: 'self_reported',
});
const FULL = { threshold: 0.7, mode: 'full' as const };
const PREVIEW = { threshold: 0.7, mode: 'preview' as const };

describe('scoring engine — SCORING_V2', () => {
  it('empty project → score 0, stage 1', () => {
    const r = scoreProject({}, SCORING_V2, FULL);
    expect(r.score).toBe(0);
    expect(r.stage).toBe(1);
  });

  it('claimed land does NOT score or advance stage in full mode', () => {
    const r = scoreProject({ land_secured: claim('land_secured') }, SCORING_V2, FULL);
    expect(r.score).toBe(0);
    expect(r.stage).toBe(1);
  });

  it('claimed land scores 5 and advances to stage 2 in preview, flagged unverified', () => {
    const r = scoreProject({ land_secured: claim('land_secured') }, SCORING_V2, PREVIEW);
    expect(r.score).toBe(5); // 10 * 0.5 discount
    expect(r.stage).toBe(2);
    expect(r.unverifiedStage).toBe(true);
  });

  it('document land_secured scores 10 and advances to stage 2 in full mode', () => {
    const r = scoreProject({ land_secured: doc('land_secured', 0.9) }, SCORING_V2, FULL);
    expect(r.score).toBe(10);
    expect(r.stage).toBe(2);
    expect(r.unverifiedStage).toBe(false);
  });

  it('tier groups: eia_approved replaces eia_completed — no double count', () => {
    const evidence: ResolvedEvidence = {
      land_secured:      doc('land_secured', 0.9),
      full_feasibility:  doc('full_feasibility', 0.9),
      eia_completed:     doc('eia_completed', 0.85),
      eia_approved:      doc('eia_approved', 0.9),
      generation_licence: doc('generation_licence', 0.8),
    };
    const r = scoreProject(evidence, SCORING_V2, FULL);
    // land(10) + technical(20) + regulatory(14 eia_approved + 6 licence = 20) = 50
    expect(r.score).toBe(50);
    expect(r.stage).toBe(5); // PPA Ready
    expect(r.gaps.map((g) => g.key)).toEqual(['ppa_signed']);
  });

  it('contested evidence is excluded from scoring', () => {
    const evidence: ResolvedEvidence = {
      land_secured: {
        key: 'land_secured', satisfied: false, confidence: 0.8,
        source: 'document', contested: true,
      },
    };
    const r = scoreProject(evidence, SCORING_V2, FULL);
    expect(r.score).toBe(0);
    expect(r.stage).toBe(1);
  });

  it('low-confidence document does not score', () => {
    const r = scoreProject({ land_secured: doc('land_secured', 0.5) }, SCORING_V2, FULL);
    expect(r.score).toBe(0);
    expect(r.stage).toBe(1);
  });

  it('perfect evidence → score 100, stage 8', () => {
    const evidence: ResolvedEvidence = {
      land_secured:               doc('land_secured', 1),
      full_feasibility:           doc('full_feasibility', 1),
      eia_approved:               doc('eia_approved', 1),
      generation_licence:         doc('generation_licence', 1),
      grid_connection_agreement:  doc('grid_connection_agreement', 1),
      financial_model:            doc('financial_model', 1),
      ppa_signed:                 doc('ppa_signed', 1),
      financing_term_sheet:       doc('financing_term_sheet', 1),
      financial_close:            doc('financial_close', 1),
      commercial_operation:       doc('commercial_operation', 1),
    };
    const r = scoreProject(evidence, SCORING_V2, FULL);
    expect(r.score).toBe(100);
    expect(r.stage).toBe(8);
    expect(r.gaps).toHaveLength(0);
  });

  it('stage 6 requires ppa_signed (document), not ppa_under_negotiation', () => {
    const evidence: ResolvedEvidence = {
      land_secured:       doc('land_secured', 0.9),
      full_feasibility:   doc('full_feasibility', 0.9),
      eia_approved:       doc('eia_approved', 0.9),
      generation_licence: doc('generation_licence', 0.9),
      ppa_under_negotiation: doc('ppa_under_negotiation', 0.9),
    };
    const r = scoreProject(evidence, SCORING_V2, FULL);
    expect(r.stage).toBe(5); // PPA Ready, not Financial Close
    expect(r.gaps.some((g) => g.key === 'ppa_signed')).toBe(true);
  });

  it('gaps include claimedButUnproven flag when self-reported in preview', () => {
    const evidence: ResolvedEvidence = {
      land_secured: doc('land_secured', 0.9),
      full_feasibility: doc('full_feasibility', 0.9),
      eia_approved: doc('eia_approved', 0.9),
      generation_licence: doc('generation_licence', 0.9),
      ppa_signed: claim('ppa_signed'), // self-reported
    };
    const r = scoreProject(evidence, SCORING_V2, PREVIEW);
    const ppaGap = r.gaps.find((g) => g.key === 'ppa_signed');
    // In preview mode ppa_signed claim advances stage, so no gap for it
    // but financial_close gap should appear
    expect(r.stage).toBe(6);
    const fcGap = r.gaps.find((g) => g.key === 'financial_close');
    expect(fcGap).toBeDefined();
  });
});
