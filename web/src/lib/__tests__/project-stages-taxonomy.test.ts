import { describe, it, expect } from 'vitest';
import {
  PROJECT_STAGE_FLOW,
  PROJECT_STAGE_VALUES,
  STAGE_BY_NUMBER,
  STAGE_BY_VALUE,
  stageNumberToEnum,
  stageLabel,
  getStageRecommendations,
} from '../project-stages';

describe('8-stage taxonomy', () => {
  it('has exactly 8 stages in lifecycle order', () => {
    expect(PROJECT_STAGE_VALUES).toEqual([
      'CONCEPT',
      'PRE_FEASIBILITY',
      'FULL_FEASIBILITY',
      'REGULATORY_APPROVAL',
      'PPA_READY',
      'FINANCIAL_CLOSE',
      'CONSTRUCTION',
      'OPERATION',
    ]);
  });

  it('numbers are sequential 1–8 with unique values', () => {
    const numbers = PROJECT_STAGE_FLOW.map((s) => s.number);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const values = PROJECT_STAGE_FLOW.map((s) => s.value);
    expect(new Set(values).size).toBe(8);
  });

  it('maps stage numbers to enum values', () => {
    expect(stageNumberToEnum(1)).toBe('CONCEPT');
    expect(stageNumberToEnum(4)).toBe('REGULATORY_APPROVAL');
    expect(stageNumberToEnum(8)).toBe('OPERATION');
  });

  it('accepts numeric strings (LLM output) and rejects junk', () => {
    expect(stageNumberToEnum('5')).toBe('PPA_READY');
    expect(stageNumberToEnum('8')).toBe('OPERATION');
    expect(stageNumberToEnum('nine')).toBeNull();
  });

  it('rejects out-of-range or missing stage numbers', () => {
    expect(stageNumberToEnum(0)).toBeNull();
    expect(stageNumberToEnum(9)).toBeNull();
    expect(stageNumberToEnum(null)).toBeNull();
    expect(stageNumberToEnum(undefined)).toBeNull();
  });

  it('exposes human labels', () => {
    expect(stageLabel('FULL_FEASIBILITY')).toBe('Full Feasibility');
    expect(stageLabel('PPA_READY')).toBe('PPA Ready');
    expect(stageLabel(null)).toBe('Not determined');
  });
});

describe('stage → service recommendations', () => {
  it('recommends feasibility consulting for early stages (1, 2, 4)', () => {
    for (const stage of ['CONCEPT', 'PRE_FEASIBILITY', 'REGULATORY_APPROVAL']) {
      const recs = getStageRecommendations(stage);
      expect(recs.services.length).toBeGreaterThan(0);
      expect(recs.partnerTypes).toContain('Consultant');
    }
  });

  it('recommends financial advisory at PPA ready (5)', () => {
    const recs = getStageRecommendations('PPA_READY');
    expect(recs.services).toContain('FINANCIAL_ADVISORY');
  });

  it('recommends EPC + O&M at financial close (6)', () => {
    const recs = getStageRecommendations('FINANCIAL_CLOSE');
    expect(recs.services).toContain('EPC_CONSTRUCTION');
    expect(recs.services).toContain('O_AND_M');
  });

  it('recommends O&M at operation (8)', () => {
    const recs = getStageRecommendations('OPERATION');
    expect(recs.services).toEqual(['O_AND_M']);
    expect(recs.partnerTypes).toContain('O&M');
  });

  it('returns empty for unknown stages', () => {
    const recs = getStageRecommendations('NOT_A_STAGE');
    expect(recs.services).toEqual([]);
    expect(recs.partnerTypes).toEqual([]);
  });

  it('STAGE_BY_NUMBER and STAGE_BY_VALUE are consistent', () => {
    for (const stage of PROJECT_STAGE_FLOW) {
      expect(STAGE_BY_NUMBER[stage.number].value).toBe(stage.value);
      expect(STAGE_BY_VALUE[stage.value].number).toBe(stage.number);
    }
  });
});
