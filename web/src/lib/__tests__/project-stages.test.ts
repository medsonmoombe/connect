import { describe, it, expect } from 'vitest';
import type { Project, ProjectScore, ProjectDocument } from '@/types';

/* ─── Extract the stage predicates for testing ─────────────────────────────
 * These mirror the logic in web/src/components/developer/ProjectStageFlow.tsx
 * but are extracted as pure functions so we can test them without React.
 * ─────────────────────────────────────────────────────────────────────────── */

// Stage state type
type StageState = 'done' | 'active' | 'upcoming';

// Stage predicates (extracted from ProjectStageFlow STAGES array)
const stageChecks = {
  registration: {
    isComplete: (_p: Project) => true,
    isActive: (_p: Project) => false,
  },
  projectCreation: {
    isComplete: (p: Project) => {
      const nameOk = (p.name?.length ?? 0) >= 3;
      const techOk = !!p.technology_type;
      const sizeOk = (p.project_size_mw ?? 0) > 0;
      const capitalOk = (p.capital_required ?? 0) > 0;
      return nameOk && techOk && sizeOk && capitalOk;
    },
    isActive: (p: Project) => !p.status || p.status === 'draft',
  },
  documentation: {
    isComplete: (p: Project) => (p.documents?.length ?? 0) > 0,
    isActive: (p: Project) => p.status === 'draft' && (p.documents?.length ?? 0) === 0,
  },
  gapResolution: {
    isComplete: (p: Project) => (p.scores?.capital_readiness_score ?? 0) > 0,
    isActive: (p: Project) => p.status === 'scoring' || p.status === 'scoring_retry' || p.status === 'pending_live',
  },
  financing: {
    isComplete: (p: Project) => p.status === 'live' || p.status === 'deactivated' || p.status === 'archived',
    isActive: (p: Project) => p.status === 'live',
  },
  construction: {
    isComplete: (p: Project) => p.status === 'deactivated' || p.status === 'archived',
    isActive: (p: Project) => p.status === 'live',
  },
};

function getStageState(stageKey: keyof typeof stageChecks, project: Project): StageState {
  const checks = stageChecks[stageKey];
  if (checks.isComplete(project)) return 'done';
  if (checks.isActive(project)) return 'active';
  return 'upcoming';
}

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
    capital_readiness_score: 0,
    technical_readiness_score: 0,
    documentation_score: 0,
    governance_score: 0,
    financial_transparency_score: 0,
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
    name: 'Test Project',
    technology_type: 'SOLAR_PV',
    location_country: 'ZA',
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

describe('Project Stage State Detection', () => {
  describe('Registration Stage', () => {
    it('is always complete (user exists)', () => {
      const project = makeProject({ status: undefined });
      expect(getStageState('registration', project)).toBe('done');
    });
  });

  describe('Project Creation Stage', () => {
    it('is complete when all required fields are filled', () => {
      const project = makeProject({
        name: 'Solar Farm',
        technology_type: 'SOLAR_PV',
        project_size_mw: 50,
        capital_required: 10_000_000,
      });
      expect(getStageState('projectCreation', project)).toBe('done');
    });

    it('is incomplete when name is too short', () => {
      const project = makeProject({ name: 'AB' }); // length < 3
      expect(stageChecks.projectCreation.isComplete(project)).toBe(false);
    });

    it('is incomplete when technology_type is missing', () => {
      const project = makeProject({ technology_type: '' as any });
      expect(stageChecks.projectCreation.isComplete(project)).toBe(false);
    });

    it('is incomplete when project_size_mw is 0', () => {
      const project = makeProject({ project_size_mw: 0 });
      expect(stageChecks.projectCreation.isComplete(project)).toBe(false);
    });

    it('is incomplete when capital_required is 0', () => {
      const project = makeProject({ capital_required: 0 });
      expect(stageChecks.projectCreation.isComplete(project)).toBe(false);
    });

    it('is active when status is draft', () => {
      const project = makeProject({ status: 'draft', name: 'AB' }); // name too short = not complete yet
      expect(getStageState('projectCreation', project)).toBe('active');
    });

    it('is active when status is undefined', () => {
      const project = makeProject({ status: undefined, name: 'AB' });
      expect(getStageState('projectCreation', project)).toBe('active');
    });

    it('is upcoming when creation is complete but later stages are active', () => {
      const project = makeProject({ status: 'scoring' });
      expect(stageChecks.projectCreation.isComplete(project)).toBe(true);
      expect(stageChecks.projectCreation.isActive(project)).toBe(false);
    });
  });

  describe('Documentation Stage', () => {
    it('is complete when documents exist', () => {
      const project = makeProject({ documents: [makeDoc()] });
      expect(getStageState('documentation', project)).toBe('done');
    });

    it('is active when status is draft and no documents', () => {
      const project = makeProject({ status: 'draft', documents: [] });
      expect(getStageState('documentation', project)).toBe('active');
    });

    it('is upcoming when status is not draft even if no documents', () => {
      const project = makeProject({ status: 'scoring', documents: [] });
      expect(stageChecks.documentation.isActive(project)).toBe(false);
    });
  });

  describe('Gap Resolution Stage', () => {
    it('is complete when capital_readiness_score > 0', () => {
      const project = makeProject({ scores: makeScore({ capital_readiness_score: 75 }) });
      expect(getStageState('gapResolution', project)).toBe('done');
    });

    it('is active when status is scoring', () => {
      const project = makeProject({ status: 'scoring' });
      expect(getStageState('gapResolution', project)).toBe('active');
    });

    it('is active when status is scoring_retry', () => {
      const project = makeProject({ status: 'scoring_retry' });
      expect(getStageState('gapResolution', project)).toBe('active');
    });

    it('is active when status is pending_live', () => {
      const project = makeProject({ status: 'pending_live' });
      expect(getStageState('gapResolution', project)).toBe('active');
    });

    it('is upcoming when not scoring and no score', () => {
      const project = makeProject({ status: 'draft' });
      expect(getStageState('gapResolution', project)).toBe('upcoming');
    });
  });

  describe('Financing Stage', () => {
    it('is complete when status is live', () => {
      const project = makeProject({ status: 'live' });
      expect(getStageState('financing', project)).toBe('done');
    });

    it('is complete when status is deactivated', () => {
      const project = makeProject({ status: 'deactivated' });
      expect(getStageState('financing', project)).toBe('done');
    });

    it('is complete when status is archived', () => {
      const project = makeProject({ status: 'archived' });
      expect(getStageState('financing', project)).toBe('done');
    });

    it('is upcoming when status is draft', () => {
      const project = makeProject({ status: 'draft' });
      expect(stageChecks.financing.isComplete(project)).toBe(false);
      expect(stageChecks.financing.isActive(project)).toBe(false);
    });
  });

  describe('Construction Stage', () => {
    it('is complete when status is deactivated', () => {
      const project = makeProject({ status: 'deactivated' });
      expect(getStageState('construction', project)).toBe('done');
    });

    it('is complete when status is archived', () => {
      const project = makeProject({ status: 'archived' });
      expect(getStageState('construction', project)).toBe('done');
    });

    it('is upcoming when status is draft', () => {
      const project = makeProject({ status: 'draft' });
      expect(getStageState('construction', project)).toBe('upcoming');
    });
  });

  describe('Stage Flow Integration', () => {
    it('correctly marks stages for a draft project with no data', () => {
      const project = makeProject({
        status: 'draft',
        name: '',
        technology_type: '' as any,
        project_size_mw: 0,
        capital_required: 0,
        documents: [],
      });
      expect(getStageState('registration', project)).toBe('done');
      expect(getStageState('projectCreation', project)).toBe('active');
      // Documentation is also active because status='draft' and no documents
      expect(getStageState('documentation', project)).toBe('active');
      expect(getStageState('gapResolution', project)).toBe('upcoming');
      expect(getStageState('financing', project)).toBe('upcoming');
      expect(getStageState('construction', project)).toBe('upcoming');
    });

    it('correctly marks stages for a live project with scores', () => {
      const project = makeProject({
        status: 'live',
        scores: makeScore({ capital_readiness_score: 85 }),
        documents: [makeDoc()], // documentation requires at least 1 doc
      });
      expect(getStageState('registration', project)).toBe('done');
      expect(getStageState('projectCreation', project)).toBe('done');
      expect(getStageState('documentation', project)).toBe('done');
      expect(getStageState('gapResolution', project)).toBe('done');
      expect(getStageState('financing', project)).toBe('done');
      // Construction also shows done because isComplete checks for 'live'
      expect(getStageState('construction', project)).toBe('active');
    });

    it('correctly marks stages for a completed project (deactivated)', () => {
      const project = makeProject({
        status: 'deactivated',
        scores: makeScore({ capital_readiness_score: 85 }),
        documents: [makeDoc()],
      });
      expect(getStageState('registration', project)).toBe('done');
      expect(getStageState('projectCreation', project)).toBe('done');
      expect(getStageState('documentation', project)).toBe('done');
      expect(getStageState('gapResolution', project)).toBe('done');
      expect(getStageState('financing', project)).toBe('done');
      expect(getStageState('construction', project)).toBe('done');
    });

    it('correctly marks stages for a scoring project', () => {
      const project = makeProject({
        status: 'scoring',
        scores: undefined,
        documents: [makeDoc()], // documentation requires at least 1 doc
      });
      expect(getStageState('registration', project)).toBe('done');
      expect(getStageState('projectCreation', project)).toBe('done');
      expect(getStageState('documentation', project)).toBe('done');
      // Gap resolution is active (status is scoring) but not complete (no score)
      expect(stageChecks.gapResolution.isComplete(project)).toBe(false);
      expect(stageChecks.gapResolution.isActive(project)).toBe(true);
      expect(getStageState('gapResolution', project)).toBe('active');
      expect(getStageState('financing', project)).toBe('upcoming');
      expect(getStageState('construction', project)).toBe('upcoming');
    });

    it('correctly marks stages for a deactivated project', () => {
      const project = makeProject({ status: 'deactivated' });
      expect(getStageState('financing', project)).toBe('done');
      expect(getStageState('construction', project)).toBe('done');
    });
  });
});
