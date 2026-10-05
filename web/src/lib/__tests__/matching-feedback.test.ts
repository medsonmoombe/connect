import { describe, expect, it } from 'vitest';
import {
  calculateProfessionalCapitalMatchScore,
  calculateProfessionalTechnicalMatchScore,
} from '../matching-engine';
import type { CapitalPartner, Project, TechnicalPartner } from '@/types';

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    developer_id: 'developer-1',
    name: 'Bankable Solar Project',
    technology_type: 'SOLAR_PV',
    location_country: 'Zambia',
    location_region: 'Lusaka',
    project_size_mw: 50,
    capital_required: 20_000_000,
    funding_required: 8_000_000,
    capital_structure_type: 'EQUITY',
    governance_terms: 'Board seat available for active strategic investor',
    risk_disclosures: 'Permitting and grid risks disclosed',
    project_stage: 'FULL_FEASIBILITY',
    status: 'live',
    is_visible_to_investors: true,
    description: 'Renewable solar project with ESG impact and community jobs.',
    created_at: '2026-01-01T00:00:00.000Z',
    documents: [
      { id: 'doc-1', project_id: 'project-1', document_type: 'FEASIBILITY', file_url: 'feasibility.pdf', uploaded_at: '2026-01-01T00:00:00.000Z' },
      { id: 'doc-2', project_id: 'project-1', document_type: 'FINANCIAL_MODEL', file_url: 'model.xlsx', uploaded_at: '2026-01-01T00:00:00.000Z' },
    ],
    tech_requirements: {
      project_id: 'project-1',
      required_services: ['EPC', 'FINANCIAL_ADVISORY'],
      terrain_complexity: 'MODERATE',
      grid_status: 'CONNECTED',
      budget_preference: 'MILESTONE',
      ppa_status: 'IN_PROGRESS',
    },
    scores: {
      id: 'score-1',
      project_id: 'project-1',
      capital_readiness_score: 70,
      technical_readiness_score: 72,
      documentation_score: 80,
      governance_score: 75,
      financial_transparency_score: 84,
      regulatory_score: 76,
      risk_flags: [],
      recommendations: [],
      created_at: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

function capitalPartner(overrides: Partial<CapitalPartner> = {}): CapitalPartner {
  return {
    id: 'capital-1',
    company_id: 'capital-company',
    min_ticket_size: 5_000_000,
    max_ticket_size: 50_000_000,
    risk_tolerance: 'MEDIUM',
    governance_preference: 'BOARD_SEAT',
    geographic_focus: ['Zambia', 'Lusaka'],
    sector_focus: ['SOLAR'],
    preferred_project_stage: ['FULL_FEASIBILITY', 'PPA_READY'],
    expected_return_profile: 'Stable impact return',
    preferred_capital_structure: ['EQUITY'],
    company: {
      id: 'capital-company',
      name: 'Professional Capital',
      type: 'CAPITAL',
      country: 'Zambia',
      years_operating: 12,
      team_size: 30,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

function technicalPartner(overrides: Partial<TechnicalPartner> = {}): TechnicalPartner {
  return {
    id: 'technical-1',
    company_id: 'technical-company',
    service_categories: ['EPC', 'O&M'],
    sector_experience: ['SOLAR'],
    min_mw_capacity: 10,
    max_mw_capacity: 100,
    regions_operated: ['Zambia', 'Lusaka'],
    annual_delivery_capacity_mw: 200,
    total_mw_delivered: 650,
    largest_project_mw: 80,
    delivery_models: ['EPC', 'MILESTONE'],
    certifications: ['ISO 9001'],
    availability: 'AVAILABLE',
    years_of_experience: 10,
    company: {
      id: 'technical-company',
      name: 'Professional EPC',
      type: 'TECHNICAL',
      country: 'Zambia',
      years_operating: 10,
      team_size: 100,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  } as TechnicalPartner;
}

describe('engagement decline feedback loop', () => {
  it('lowers a capital match score by exactly the decline penalty', () => {
    const clean = calculateProfessionalCapitalMatchScore(project(), capitalPartner());
    const penalised = calculateProfessionalCapitalMatchScore(project(), capitalPartner(), { declinePenalty: 10 });
    expect(clean.compatibility_score - penalised.compatibility_score).toBe(10);
    expect((penalised.score_breakdown as any).decline_penalty).toBe(10);
  });

  it('lowers a technical match score by exactly the decline penalty', () => {
    const clean = calculateProfessionalTechnicalMatchScore(project(), technicalPartner());
    const penalised = calculateProfessionalTechnicalMatchScore(project(), technicalPartner(), { declinePenalty: 15 });
    expect(clean.compatibility_score - penalised.compatibility_score).toBe(15);
    expect((penalised.score_breakdown as any).decline_penalty).toBe(15);
  });

  it('never pushes a score below zero', () => {
    const penalised = calculateProfessionalTechnologySafe();
    expect(penalised).toBeGreaterThanOrEqual(0);
  });
});

function calculateProfessionalTechnologySafe(): number {
  return calculateProfessionalTechnicalMatchScore(project(), technicalPartner(), { declinePenalty: 10_000 }).compatibility_score;
}
