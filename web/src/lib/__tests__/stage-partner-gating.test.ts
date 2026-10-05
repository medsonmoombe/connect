import { describe, it, expect } from 'vitest';
import { isPartnerTypeAllowedAtStage, isGapAllowedAtStage } from '../project-stages';
import { countCandidatesForGap, matchCandidatesForGap } from '../partner-candidates';

/** The agreed stage → contactable profiles table. */
const STAGE_TABLE: Record<string, string[]> = {
  CONCEPT: ['Consultant', 'Grant Provider'],
  PRE_FEASIBILITY: ['Consultant', 'Grant Provider'],
  FULL_FEASIBILITY: ['Consultant', 'Financial', 'EPC', 'Grant Provider'],
  REGULATORY_APPROVAL: ['Consultant', 'Grant Provider'],
  PPA_READY: ['Financial', 'Grant Provider', 'Power Trader'],
  FINANCIAL_CLOSE: ['EPC', 'O&M', 'Financial', 'Grant Provider'],
  CONSTRUCTION: ['O&M', 'EPC', 'Grant Provider'],
  OPERATION: ['O&M', 'Grant Provider'],
};

describe('stage → contactable partner profiles', () => {
  for (const [stage, allowed] of Object.entries(STAGE_TABLE)) {
    it(`allows exactly the agreed profile types at ${stage}`, () => {
      const all = ['Consultant', 'Financial', 'EPC', 'O&M', 'Grant Provider', 'Power Trader'];
      for (const type of all) {
        expect(isPartnerTypeAllowedAtStage(stage, type)).toBe(allowed.includes(type));
      }
    });
  }

  it('maps an Offtaker recommendation to the Power Trader category', () => {
    // Both labels are the offtake/PPA category — they must agree everywhere.
    for (const stage of Object.keys(STAGE_TABLE)) {
      expect(isPartnerTypeAllowedAtStage(stage, 'Offtaker')).toBe(isPartnerTypeAllowedAtStage(stage, 'Power Trader'));
    }
  });

  it('is unrestricted when the stage is unknown / not yet determined', () => {
    expect(isPartnerTypeAllowedAtStage(null, 'EPC')).toBe(true);
    expect(isPartnerTypeAllowedAtStage(undefined, 'Power Trader')).toBe(true);
  });

  it('suppresses gaps whose recommended profile type does not fit the stage', () => {
    const offtakerGap = { recommendation: { partnerType: 'Power Trader' } };
    const consultantGap = { recommendation: { partnerType: 'Technical Consultant' } };

    // Offtake conversations belong at PPA Ready, not at Concept.
    expect(isGapAllowedAtStage('CONCEPT', offtakerGap)).toBe(false);
    expect(isGapAllowedAtStage('PPA_READY', offtakerGap)).toBe(true);
    expect(isGapAllowedAtStage('CONCEPT', consultantGap)).toBe(true);
  });
});

const consultantPool = [
  { consultant_id: 'c1', compatibility_score: 90, consultant: { id: 'c1', company_id: 'co1', company: { name: 'Alpha Consulting', country: 'Zambia' }, service_categories: ['FEASIBILITY_STUDY'] } },
  { consultant_id: 'c2', compatibility_score: 80, consultant: { id: 'c2', company_id: 'co2', company: { name: 'Beta Advisors', country: 'Zambia' }, service_categories: ['ENVIRONMENTAL_ASSESSMENT'] } },
  { consultant_id: 'c3', compatibility_score: 70, consultant: { id: 'c3', company_id: 'co3', company: { name: 'Gamma Energy', country: 'Zambia' }, service_categories: ['GRID_CONNECTION'] } },
  { consultant_id: 'c4', compatibility_score: 60, consultant: { id: 'c4', company_id: 'co4', company: { name: 'Delta Technical', country: 'Zambia' }, service_categories: ['LEGAL_ADVISORY'] } },
];

const feasibilityGap = {
  recommendation: { partnerType: 'Technical Consultant', counterpartyType: 'CONSULTANT' },
};

describe('countCandidatesForGap', () => {
  it('counts the whole stage-allowed pool, not just the displayed slice', () => {
    expect(countCandidatesForGap(feasibilityGap, [], [], 'CONCEPT', consultantPool)).toBe(4);
  });

  it('respects the stage gate while counting', () => {
    // An EPC gap at Concept has no contactable profiles at all.
    const epcGap = { recommendation: { partnerType: 'EPC Contractor', counterpartyType: 'TECHNICAL' } };
    expect(countCandidatesForGap(epcGap, [], consultantPool, 'CONCEPT')).toBe(0);
  });

  it('matchCandidatesForGap still returns the top slice for display', () => {
    const top3 = matchCandidatesForGap(feasibilityGap, [], [], 'CONCEPT', 3, consultantPool);
    expect(top3).toHaveLength(3);
    expect(top3[0].companyName).toBe('Alpha Consulting');
  });
});
