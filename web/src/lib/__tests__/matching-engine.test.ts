import { describe, expect, it } from 'vitest';
import {
  calculateProfessionalCapitalMatchScore,
  calculateProfessionalConsultantMatchScore,
  calculateProfessionalTechnicalMatchScore,
} from '../matching-engine';
import type { CapitalPartner, ConsultantProfile, Project, TechnicalPartner } from '@/types';

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
      { id: 'doc-3', project_id: 'project-1', document_type: 'ENVIRONMENTAL', file_url: 'esia.pdf', uploaded_at: '2026-01-01T00:00:00.000Z' },
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
      capital_readiness_score: 82,
      technical_readiness_score: 78,
      documentation_score: 88,
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
    largest_project_mw: 120,
    average_delivery_time_months: 18,
    bonding_capacity: 8_000_000,
    delivery_models: ['EPC', 'EPCM'],
    project_type_experience: ['UTILITY_SCALE'],
    min_ticket_size_zmw: 5_000_000,
    max_ticket_size_zmw: 40_000_000,
    years_of_experience: 10,
    company: {
      id: 'technical-company',
      name: 'Professional EPC',
      type: 'TECHNICAL',
      country: 'Zambia',
      years_operating: 10,
      team_size: 80,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

function consultant(overrides: Partial<ConsultantProfile> = {}): ConsultantProfile {
  return {
    id: 'consultant-1',
    company_id: 'consultant-company',
    service_categories: ['FINANCIAL_ADVISORY', 'LEGAL_ADVISORY'],
    sector_experience: ['SOLAR'],
    specializations: ['FINANCIAL_ADVISORY', 'TRANSACTION_ADVISORY'],
    years_of_experience: 9,
    total_projects_completed: 18,
    largest_project_mw: 90,
    regions_operated: ['Zambia'],
    certifications: ['IFC ESG', 'Financial modelling'],
    key_team_members: [],
    references_data: [{ name: 'Reference' }],
    availability: 'AVAILABLE',
    hourly_rate_range: '100-200',
    project_rate_range: '10000-30000',
    company_experience_doc_url: 'experience.pdf',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    company: {
      id: 'consultant-company',
      name: 'Professional Advisory',
      type: 'CONSULTANT',
      country: 'Zambia',
      years_operating: 9,
      team_size: 15,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('professional matching engine', () => {
  it('scores a strong capital partner using readiness, documents, ESG, and investor criteria', () => {
    const result = calculateProfessionalCapitalMatchScore(project(), capitalPartner(), { hasAcceptedEPC: true });

    expect(result.compatibility_score).toBeGreaterThanOrEqual(80);
    expect(result.score_breakdown).toHaveProperty('readiness');
    expect(result.score_breakdown).toHaveProperty('documentation');
    expect(result.score_breakdown).toHaveProperty('impact');
    expect(result.score_breakdown).toHaveProperty('confidence');
    expect(result.score_breakdown).toHaveProperty('engine_version', 'professional-v1');
  });

  it('penalizes capital partners that are outside the professional eligibility gates', () => {
    const result = calculateProfessionalCapitalMatchScore(
      project({ location_country: 'Zambia' }),
      capitalPartner({ company: { ...capitalPartner().company!, country: 'Kenya' } }),
    );

    expect(result.compatibility_score).toBe(0);
    expect(result.score_breakdown).toHaveProperty('eligibility');
  });

  it('uses delivery model, capacity, track record, and documents for technical partners', () => {
    const result = calculateProfessionalTechnicalMatchScore(project(), technicalPartner());

    expect(result.compatibility_score).toBeGreaterThanOrEqual(75);
    expect(result.score_breakdown).toHaveProperty('delivery_model');
    expect(result.score_breakdown).toHaveProperty('capacity');
    expect(result.score_breakdown).toHaveProperty('track_record');
    expect(result.score_breakdown).toHaveProperty('certifications');
  });

  it('uses gap service fit, specialization, availability, and profile evidence for consultants', () => {
    const result = calculateProfessionalConsultantMatchScore(project(), consultant(), {
      gapServices: ['FINANCIAL_ADVISORY'],
    });

    expect(result.compatibility_score).toBeGreaterThanOrEqual(80);
    expect(result.score_breakdown).toHaveProperty('service_fit');
    expect(result.score_breakdown).toHaveProperty('specialization');
    expect(result.score_breakdown).toHaveProperty('availability');
    expect(result.score_breakdown).toHaveProperty('documentation');
  });
});
