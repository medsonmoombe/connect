import { describe, it, expect } from 'vitest';
import {
  TECHNOLOGY_TYPES,
  PROJECT_STAGES,
  CAPITAL_STRUCTURE_TYPES,
  LAND_TITLE_STATUSES,
  TERRAIN_COMPLEXITY,
  GRID_STATUS,
  BUDGET_PREFERENCE,
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  createProjectSchema,
} from '../project-validation';

describe('Controlled vocabularies', () => {
  it('TECHNOLOGY_TYPES contains all technology options', () => {
    expect(TECHNOLOGY_TYPES).toEqual([
      'PHOTOVOLTAIC', 'CONCENTRATED_SOLAR', 'ONSHORE_WIND',
      'RUN_OF_RIVER', 'LITHIUM_ION', 'VANADIUM_FLOW', 'OTHER',
    ]);
  });

  it('PROJECT_STAGES contains all 8 project stages', () => {
    expect(PROJECT_STAGES).toEqual([
      'CONCEPT', 'PRE_FEASIBILITY', 'FULL_FEASIBILITY', 'REGULATORY_APPROVAL',
      'PPA_READY', 'FINANCIAL_CLOSE', 'CONSTRUCTION', 'OPERATION',
    ]);
  });

  it('CAPITAL_STRUCTURE_TYPES contains debt, equity, leasing, sharing, and grant', () => {
    expect(CAPITAL_STRUCTURE_TYPES).toEqual(['DEBT', 'EQUITY', 'PROFIT_SHARING', 'LEASING', 'GRANT']);
  });

  it('TERRAIN_COMPLEXITY has expected values', () => {
    expect(TERRAIN_COMPLEXITY).toEqual(['SIMPLE', 'MODERATE', 'COMPLEX']);
  });

  it('GRID_STATUS has expected values', () => {
    expect(GRID_STATUS).toEqual(['CONNECTED', 'PENDING', 'OFF_GRID']);
  });
});

describe('step1Schema - Basic Info', () => {
  it('passes valid step 1 data', () => {
    const result = step1Schema.safeParse({
      name: 'Solar Farm Project',
      technology_type: 'PHOTOVOLTAIC',
      location_country: 'South Africa',
      location_region: 'Gauteng',
    });
    expect(result.success).toBe(true);
  });

  it('passes with optional region omitted', () => {
    const result = step1Schema.safeParse({
      name: 'Wind Farm',
      technology_type: 'ONSHORE_WIND',
      location_country: 'Kenya',
    });
    expect(result.success).toBe(true);
  });

  it('rejects name shorter than 3 characters', () => {
    const result = step1Schema.safeParse({
      name: 'AB',
      technology_type: 'PHOTOVOLTAIC',
      location_country: 'South Africa',
    });
    expect(result.success).toBe(false);
  });

  it('rejects name longer than 200 characters', () => {
    const result = step1Schema.safeParse({
      name: 'A'.repeat(201),
      technology_type: 'PHOTOVOLTAIC',
      location_country: 'South Africa',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid technology type', () => {
    const result = step1Schema.safeParse({
      name: 'Solar Farm',
      technology_type: 'NUCLEAR',
      location_country: 'South Africa',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty country', () => {
    const result = step1Schema.safeParse({
      name: 'Solar Farm',
      technology_type: 'PHOTOVOLTAIC',
      location_country: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('step2Schema - Financial Info', () => {
  it('passes valid step 2 data', () => {
    const result = step2Schema.safeParse({
      project_size_mw: 50,
      capital_required: 10000000,
      capital_structure_type: 'EQUITY',
    });
    expect(result.success).toBe(true);
  });

  it('rejects zero or negative project size', () => {
    expect(step2Schema.safeParse({
      project_size_mw: 0, capital_required: 10000000, capital_structure_type: 'EQUITY',
    }).success).toBe(false);
    expect(step2Schema.safeParse({
      project_size_mw: -5, capital_required: 10000000, capital_structure_type: 'EQUITY',
    }).success).toBe(false);
  });

  it('rejects zero or negative capital', () => {
    expect(step2Schema.safeParse({
      project_size_mw: 50, capital_required: 0, capital_structure_type: 'EQUITY',
    }).success).toBe(false);
  });

  it('accepts DEBT as a valid capital structure type', () => {
    const result = step2Schema.safeParse({
      project_size_mw: 50,
      capital_required: 10000000,
      capital_structure_type: 'DEBT',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid capital structure type', () => {
    const result = step2Schema.safeParse({
      project_size_mw: 50,
      capital_required: 10000000,
      capital_structure_type: 'MEZZANINE',
    });
    expect(result.success).toBe(false);
  });

  it('rejects string values for numeric fields', () => {
    const result = step2Schema.safeParse({
      project_size_mw: 'fifty',
      capital_required: 'ten million',
      capital_structure_type: 'EQUITY',
    });
    expect(result.success).toBe(false);
  });
});

describe('step3Schema - Project Stage & Timeline', () => {
  it('passes valid step 3 data', () => {
    const result = step3Schema.safeParse({
      project_stage: 'CONCEPT',
      target_financial_close_date: '2025-06-01',
      target_cod: '2026-01-01',
    });
    expect(result.success).toBe(true);
  });

  it('passes with optional dates omitted', () => {
    const result = step3Schema.safeParse({
      project_stage: 'FULL_FEASIBILITY',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid project stage', () => {
    const result = step3Schema.safeParse({
      project_stage: 'SOLD',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when financial close is after COD', () => {
    const result = step3Schema.safeParse({
      project_stage: 'CONCEPT',
      target_financial_close_date: '2027-06-01',
      target_cod: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('passes when financial close is before COD', () => {
    const result = step3Schema.safeParse({
      project_stage: 'CONCEPT',
      target_financial_close_date: '2025-06-01',
      target_cod: '2025-12-01',
    });
    expect(result.success).toBe(true);
  });
});

describe('step4Schema - Technical Requirements', () => {
  it('passes valid step 4 data', () => {
    const result = step4Schema.safeParse({
      terrain_complexity: 'SIMPLE',
      grid_status: 'CONNECTED',
      budget_preference: 'FIXED',
      required_services: ['EPC', 'O&M'],
    });
    expect(result.success).toBe(true);
  });

  it('passes with optional services omitted', () => {
    const result = step4Schema.safeParse({
      terrain_complexity: 'MODERATE',
      grid_status: 'PENDING',
      budget_preference: 'MILESTONE',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid terrain_complexity', () => {
    const result = step4Schema.safeParse({
      terrain_complexity: 'EASY',
      grid_status: 'CONNECTED',
      budget_preference: 'FIXED',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid grid_status', () => {
    const result = step4Schema.safeParse({
      terrain_complexity: 'SIMPLE',
      grid_status: 'GRID_TIED',
      budget_preference: 'FIXED',
    });
    expect(result.success).toBe(false);
  });
});

describe('step5Schema - Additional Details', () => {
  it('passes with all fields empty', () => {
    const result = step5Schema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('passes with all fields populated', () => {
    const result = step5Schema.safeParse({
      governance_terms: 'Board seat with active management',
      exit_terms: '3 year lockup then quarterly',
      risk_disclosures: 'Political risk from land rights',
      has_secured_land: true,
      land_title_status: 'Titled',
      has_reached_financial_close: false,
      regulatory_approvals: ['Environmental Impact Assessment', 'Grid Connection Permit'],
    });
    expect(result.success).toBe(true);
  });

  it('passes with partial data', () => {
    const result = step5Schema.safeParse({
      risk_disclosures: 'Some risks',
      has_secured_land: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all land title statuses', () => {
    for (const status of LAND_TITLE_STATUSES) {
      const result = step5Schema.safeParse({ land_title_status: status });
      expect(result.success).toBe(true);
    }
  });
});

describe('createProjectSchema - Full Creation', () => {
  const validProject = {
    name: 'Solar Farm Project',
    technology_type: 'PHOTOVOLTAIC',
    location_country: 'South Africa',
    location_region: 'Gauteng',
    project_size_mw: 50,
    capital_required: 10000000,
    capital_structure_type: 'EQUITY',
    project_stage: 'CONCEPT',
    target_financial_close_date: '2025-06-01',
    target_cod: '2026-01-01',
    governance_terms: 'Active management',
    exit_terms: 'Yearly exit after 3 years',
    risk_disclosures: 'Standard project risks',
    has_secured_land: true,
    land_title_status: 'Titled',
    has_reached_financial_close: false,
    regulatory_approvals: ['EIA Approved'],
  };

  it('passes with fully valid project data', () => {
    const result = createProjectSchema.safeParse(validProject);
    expect(result.success).toBe(true);
  });

  it('passes with minimal required fields', () => {
    const result = createProjectSchema.safeParse({
      name: 'Minimal Project',
      technology_type: 'ONSHORE_WIND',
      location_country: 'Kenya',
      project_size_mw: 30,
      capital_required: 5000000,
      capital_structure_type: 'PROFIT_SHARING',
      project_stage: 'PRE_FEASIBILITY',
    });
    expect(result.success).toBe(true);
  });

  it('rejects when name is missing', () => {
    const { name, ...rest } = validProject;
    const result = createProjectSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects when technology_type is missing', () => {
    const { technology_type, ...rest } = validProject;
    const result = createProjectSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects when project_size_mw is missing', () => {
    const { project_size_mw, ...rest } = validProject;
    const result = createProjectSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects when capital_structure_type is missing', () => {
    const { capital_structure_type, ...rest } = validProject;
    const result = createProjectSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects when project_stage is missing', () => {
    const { project_stage, ...rest } = validProject;
    const result = createProjectSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
