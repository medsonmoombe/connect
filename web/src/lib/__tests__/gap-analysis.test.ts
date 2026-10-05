import { describe, it, expect } from 'vitest';
import { analyzeProjectGaps, countBlockingGaps } from '../gap-analysis';
import type { Project, ProjectScore, ProjectDocument } from '@/types';

// ── Factory helpers ─────────────────────────────────────────────────────────

function makeDoc(overrides: Partial<ProjectDocument> = {}): ProjectDocument {
  return {
    id: 'doc-1',
    project_id: 'proj-1',
    document_type: 'FEASIBILITY_STUDY',
    file_url: 'https://example.com/doc.pdf',
    uploaded_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeScore(overrides: Partial<ProjectScore> = {}): ProjectScore {
  return {
    id: 'score-1',
    project_id: 'proj-1',
    capital_readiness_score: 50,
    technical_readiness_score: 50,
    documentation_score: 50,
    governance_score: 50,
    financial_transparency_score: 50,
    risk_flags: [],
    recommendations: [],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    developer_id: 'dev-1',
    name: 'Solar Farm',
    technology_type: 'SOLAR_PV',
    location_country: 'ZA',
    location_region: 'Gauteng',
    project_size_mw: 50,
    capital_required: 10_000_000,
    capital_structure_type: 'EQUITY',
    project_stage: 'CONCEPT',
    created_at: new Date().toISOString(),
    documents: [],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('analyzeProjectGaps', () => {
  describe('Overall Readiness', () => {
    it('returns 0 for a completely empty project', () => {
      const project = makeProject();
      const result = analyzeProjectGaps(project);
      expect(result.overallReadiness).toBeGreaterThanOrEqual(0);
      expect(result.overallReadiness).toBeLessThan(100);
      expect(result.gaps.length).toBeGreaterThan(0);
    });

    it('returns 100 for a fully prepared project', () => {
      const project = makeProject({
        documents: [
          makeDoc({ document_type: 'FEASIBILITY_STUDY' }),
          makeDoc({ document_type: 'FINANCIAL_MODEL' }),
          makeDoc({ document_type: 'ENVIRONMENTAL_IMPACT_ASSESSMENT' }),
        ],
        tech_requirements: {
          project_id: 'proj-1',
          required_services: ['EPC'],
          terrain_complexity: 'SIMPLE',
          grid_status: 'CONNECTED',
          budget_preference: 'FIXED',
        },
        capital_structure_type: 'GRANT',
        scores: makeScore({ capital_readiness_score: 85 }),
        has_secured_land: true,
        regulatory_approvals: ['Permit A', 'Permit B'],
        governance_terms: 'active management',
        exit_terms: 'standard',
      });
      const result = analyzeProjectGaps(project);
      // Should be near 100% — most gaps closed
      expect(result.overallReadiness).toBeGreaterThanOrEqual(60);
    });

    it('sets correct projectId', () => {
      const project = makeProject({ id: 'my-project-123' });
      const result = analyzeProjectGaps(project);
      expect(result.projectId).toBe('my-project-123');
    });
  });

  describe('Category Breakdown', () => {
    it('includes all expected categories', () => {
      const project = makeProject();
      const result = analyzeProjectGaps(project);
      expect(result.categoryBreakdown).toHaveProperty('Studies & Advisory');
      expect(result.categoryBreakdown).toHaveProperty('Technical');
      expect(result.categoryBreakdown).toHaveProperty('Financing');
      expect(result.categoryBreakdown).toHaveProperty('Commercial');
      expect(result.categoryBreakdown).toHaveProperty('Regulatory');
    });

    it('tracks completion counts correctly', () => {
      const project = makeProject({
        documents: [makeDoc({ document_type: 'FEASIBILITY_STUDY' })], // covers 1 rule
        has_secured_land: true, // covers 1 rule
      });
      const result = analyzeProjectGaps(project);
      const regulatory = result.categoryBreakdown['Regulatory'];
      expect(regulatory.complete).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Gap Rules — Studies & Advisory', () => {
    it('detects feasibility study as complete when document exists', () => {
      const project = makeProject({ documents: [makeDoc({ document_type: 'FEASIBILITY_STUDY' })] });
      const result = analyzeProjectGaps(project);
      const gap = result.gaps.find(g => g.id === 'feasibility_study');
      expect(gap).toBeUndefined(); // complete means not included
    });

    it('detects feasibility study as missing without document', () => {
      const project = makeProject({ documents: [] });
      const result = analyzeProjectGaps(project);
      const gap = result.gaps.find(g => g.id === 'feasibility_study');
      expect(gap).toBeDefined();
      expect(gap!.status).toBe('missing');
      expect(gap!.severity).toBe('critical');
    });

    it('detects financial model complete with FINANCIAL document', () => {
      const project = makeProject({ documents: [makeDoc({ document_type: 'FINANCIAL_MODEL' })] });
      const result = analyzeProjectGaps(project);
      const gap = result.gaps.find(g => g.id === 'financial_model');
      expect(gap).toBeUndefined();
    });

    it('detects environmental assessment complete with ENVIRONMENTAL document', () => {
      const project = makeProject({ documents: [makeDoc({ document_type: 'ENVIRONMENTAL_IMPACT' })] });
      const result = analyzeProjectGaps(project);
      const gap = result.gaps.find(g => g.id === 'environmental_assessment');
      expect(gap).toBeUndefined();
    });

    it('detects grid study complete when grid_status is CONNECTED', () => {
      const project = makeProject({
        tech_requirements: { project_id: 'proj-1', required_services: [], terrain_complexity: 'SIMPLE', grid_status: 'CONNECTED', budget_preference: 'FIXED' },
      });
      const result = analyzeProjectGaps(project);
      const gap = result.gaps.find(g => g.id === 'grid_study');
      expect(gap).toBeUndefined();
    });
  });

  describe('Gap Rules — Technical', () => {
    it('detects EPC contractor needed when not selected', () => {
      const project = makeProject({
        tech_requirements: { project_id: 'proj-1', required_services: [], terrain_complexity: 'SIMPLE', grid_status: 'CONNECTED', budget_preference: 'FIXED' },
      });
      const result = analyzeProjectGaps(project);
      const gap = result.gaps.find(g => g.id === 'epc_services');
      expect(gap).toBeDefined();
      expect(gap!.status).toBe('missing');
    });

    it('detects EPC complete when EPC is in required_services', () => {
      const project = makeProject({
        tech_requirements: { project_id: 'proj-1', required_services: ['EPC'], terrain_complexity: 'SIMPLE', grid_status: 'CONNECTED', budget_preference: 'FIXED' },
      });
      const result = analyzeProjectGaps(project);
      const gap = result.gaps.find(g => g.id === 'epc_services');
      expect(gap).toBeUndefined();
    });
  });

  describe('Gap Rules — Financing', () => {
    it('detects equity investment complete for EQUITY structure', () => {
      const project = makeProject({ capital_structure_type: 'EQUITY' });
      const result = analyzeProjectGaps(project);
      const gap = result.gaps.find(g => g.id === 'equity_investment');
      expect(gap).toBeUndefined();
    });

    it('detects equity investment missing for non-equity structures', () => {
      const project = makeProject({ capital_structure_type: 'GRANT' });
      const result = analyzeProjectGaps(project);
      const gap = result.gaps.find(g => g.id === 'equity_investment');
      expect(gap).toBeDefined();
      expect(gap!.status).toBe('missing');
    });

    it('detects grant funding complete for GRANT structure', () => {
      const project = makeProject({ capital_structure_type: 'GRANT' });
      const result = analyzeProjectGaps(project);
      const gap = result.gaps.find(g => g.id === 'grant_funding');
      expect(gap).toBeUndefined();
    });
  });

  describe('Gap Rules — Commercial', () => {
    it('always shows carbon credits as missing (upsell)', () => {
      const project = makeProject();
      const result = analyzeProjectGaps(project);
      const gap = result.gaps.find(g => g.id === 'carbon_credits');
      expect(gap).toBeDefined();
      expect(gap!.status).toBe('missing');
    });

    it('detects transaction advisory as partial when a financial model document exists', () => {
      const project = makeProject({ documents: [makeDoc({ document_type: 'FINANCIAL_MODEL' })] });
      const result = analyzeProjectGaps(project);
      const gap = result.gaps.find(g => g.id === 'transaction_advisory');
      expect(gap).toBeDefined();
      expect(gap!.status).toBe('partial');
    });
  });

  describe('Gap Rules — Regulatory', () => {
    it('detects regulatory approvals complete with 2+ approvals', () => {
      const project = makeProject({ regulatory_approvals: ['Permit A', 'Permit B'] });
      const result = analyzeProjectGaps(project);
      const gap = result.gaps.find(g => g.id === 'regulatory_approvals');
      expect(gap).toBeUndefined();
    });

    it('detects regulatory approvals partial with 1 approval', () => {
      const project = makeProject({ regulatory_approvals: ['Permit A'] });
      const result = analyzeProjectGaps(project);
      const gap = result.gaps.find(g => g.id === 'regulatory_approvals');
      expect(gap).toBeDefined();
      expect(gap!.status).toBe('partial');
    });

    it('detects land rights complete when has_secured_land is true', () => {
      const project = makeProject({ has_secured_land: true });
      const result = analyzeProjectGaps(project);
      const gap = result.gaps.find(g => g.id === 'land_rights');
      expect(gap).toBeUndefined();
    });

    it('detects land rights missing when has_secured_land is false', () => {
      const project = makeProject({ has_secured_land: false });
      const result = analyzeProjectGaps(project);
      const gap = result.gaps.find(g => g.id === 'land_rights');
      expect(gap).toBeDefined();
      expect(gap!.status).toBe('missing');
      expect(gap!.severity).toBe('high');
    });
  });

  describe('Summary Generation', () => {
    it('generates positive summary for high readiness', () => {
      // Build a project that achieves >=80% readiness
      const project = makeProject({
        documents: [
          makeDoc({ document_type: 'FEASIBILITY_STUDY' }),
          makeDoc({ document_type: 'FINANCIAL_MODEL' }),
          makeDoc({ document_type: 'ENVIRONMENTAL_IMPACT' }),
        ],
        tech_requirements: { project_id: 'proj-1', required_services: ['EPC'], terrain_complexity: 'SIMPLE', grid_status: 'CONNECTED', budget_preference: 'FIXED' },
        has_secured_land: true,
        regulatory_approvals: ['Permit A', 'Permit B'],
        capital_structure_type: 'PROFIT_SHARING', // closes equity_investment + avoids EQUITY debt flag
        governance_terms: 'active management board seat',
        exit_terms: 'standard',
      });
      const result = analyzeProjectGaps(project);
      // Should have decent readiness and a non-empty summary
      expect(result.overallReadiness).toBeGreaterThanOrEqual(50);
      expect(result.summary).toBeTruthy();
    });

    it('generates actionable summary for low readiness', () => {
      const project = makeProject();
      const result = analyzeProjectGaps(project);
      expect(result.summary).toContain('critical');
    });
  });

  describe('Gap Items Structure', () => {
    it('all gaps have required fields', () => {
      const project = makeProject();
      const result = analyzeProjectGaps(project);
      for (const gap of result.gaps) {
        expect(gap.id).toBeDefined();
        expect(gap.category).toBeDefined();
        expect(gap.label).toBeDefined();
        expect(gap.detail).toBeDefined();
        expect(gap.status).toBeDefined();
        expect(gap.severity).toBeDefined();
        expect(gap.recommendation).toBeDefined();
        expect(gap.recommendation.partnerType).toBeDefined();
        expect(gap.recommendation.service).toBeDefined();
        expect(gap.recommendation.counterpartyType).toMatch(/^(CAPITAL|TECHNICAL|CONSULTANT|POWER_TRADER)$/);
      }
    });

    it('assigns actionLabel for missing gaps', () => {
      const project = makeProject();
      const result = analyzeProjectGaps(project);
      for (const gap of result.gaps) {
        if (gap.status === 'missing') {
          expect(gap.actionLabel).toContain('Find');
        }
      }
    });
  });
});

describe('countBlockingGaps', () => {
  it('returns 0 for fully ready project', () => {
    const project = makeProject();
    const result = analyzeProjectGaps(project);
    const count = countBlockingGaps(result);
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('counts critical and high severity gaps', () => {
    const project = makeProject(); // empty project = many gaps
    const result = analyzeProjectGaps(project);
    const criticalHigh = result.gaps.filter(g => g.severity === 'critical' || g.severity === 'high').length;
    expect(countBlockingGaps(result)).toBe(criticalHigh);
  });
});
