import { describe, it, expect } from 'vitest';
import { evidenceOutputSchema } from '../ai/types';

/**
 * The evidence schema is the boundary between a chatty model and the scoring
 * engine. Live calls show models returning "true" for `belongs_to_project` and
 * "50" for `capacity_mw`; before coercion, one such field threw the whole
 * document away as "invalid AI output" and its evidence never reached the score.
 * These tests pin the coercions so that can't come back.
 */
const baseDocument = {
  document_type: 'regulatory_permit',
  authenticity: { assessment: 'authentic', notes: 'signed and stamped' },
  evidence: [{ key: 'eia_approved', value: true, confidence: 0.9, excerpt: 'hereby APPROVES' }],
  relevance: {
    level: 'HIGH',
    belongs_to_project: true,
    contradicts_project: false,
    reason: 'names the project',
  },
  summary: 'A ZEMA decision letter approving the ESIA for the project.',
};

describe('evidenceOutputSchema — string-typed model output', () => {
  it('coerces "true"/"false" booleans and "50" numbers', () => {
    const parsed = evidenceOutputSchema.parse({
      ...baseDocument,
      relevance: { ...baseDocument.relevance, belongs_to_project: 'true', contradicts_project: 'false' },
      project_identity: {
        project_name: 'Kafue Solar PV Project',
        capacity_mw: '50',
        location: 'Chisamba District',
        parties: ['Kafue Solar Power Limited'],
      },
    });

    expect(parsed.relevance?.belongs_to_project).toBe(true);
    expect(parsed.relevance?.contradicts_project).toBe(false);
    expect(parsed.project_identity?.capacity_mw).toBe(50);
  });

  it('reads a number with a unit out of a string', () => {
    const parsed = evidenceOutputSchema.parse({
      ...baseDocument,
      project_identity: { capacity_mw: '50 MW' },
    });
    expect(parsed.project_identity?.capacity_mw).toBe(50);
  });

  it('treats an unreadable capacity as absent rather than failing the document', () => {
    const parsed = evidenceOutputSchema.parse({
      ...baseDocument,
      project_identity: { capacity_mw: 'not stated' },
    });
    expect(parsed.project_identity?.capacity_mw).toBeNull();
  });

  it('treats unreadable belonging as false (conservative: no scoring on a guess)', () => {
    const parsed = evidenceOutputSchema.parse({
      ...baseDocument,
      relevance: { ...baseDocument.relevance, belongs_to_project: 'unclear' },
    });
    expect(parsed.relevance?.belongs_to_project).toBe(false);
  });

  it('coerces a string confidence', () => {
    const parsed = evidenceOutputSchema.parse({
      ...baseDocument,
      evidence: [{ key: 'land_secured', value: true, confidence: '0.95' }],
    });
    expect(parsed.evidence[0].confidence).toBe(0.95);
  });
});

describe('evidenceOutputSchema — drift tolerance', () => {
  it('drops evidence items with unknown keys but keeps the known ones', () => {
    const parsed = evidenceOutputSchema.parse({
      ...baseDocument,
      evidence: [
        { key: 'land_secured', value: true, confidence: 0.9 },
        { key: 'invented_milestone', value: true, confidence: 0.9 },
        { key: 'ppa_signed', value: true, confidence: 0.8 },
      ],
    });

    expect(parsed.evidence.map((e) => e.key)).toEqual(['land_secured', 'ppa_signed']);
  });

  it('falls back to safe defaults for unrecognised enum values', () => {
    const parsed = evidenceOutputSchema.parse({
      ...baseDocument,
      document_type: 'Environmental Permit Letter',
      authenticity: { assessment: 'looks fine', notes: 'n/a' },
      relevance: { ...baseDocument.relevance, level: 'VERY HIGH' },
      risk_flags: [{ severity: 'severe', flag: 'x', detail: 'y' }],
    });

    expect(parsed.document_type).toBe('other');
    expect(parsed.authenticity.assessment).toBe('uncertain');
    expect(parsed.relevance?.level).toBe('LOW');
    expect(parsed.risk_flags[0].severity).toBe('medium');
  });

  it('parses a minimal reply (nothing beyond the fields the engine reads)', () => {
    const parsed = evidenceOutputSchema.safeParse({
      evidence: [{ key: 'full_feasibility', value: true, confidence: 0.85 }],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.summary).toBe('');
    expect(parsed.success && parsed.data.risk_flags).toEqual([]);
  });

  it('still rejects an evidence array that is not an array of items', () => {
    const parsed = evidenceOutputSchema.parse({ ...baseDocument, evidence: 'no evidence found' });
    expect(parsed.evidence).toEqual([]);
  });
});
