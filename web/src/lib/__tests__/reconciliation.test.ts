import { describe, it, expect } from 'vitest';
import {
  reconcileDocuments,
  reconciliationRiskFlags,
  mustWithholdScore,
  withheldScoreResult,
  nameOverlap,
  type ProjectProfile,
} from '../ai/reconciliation';
import type { EvidenceOutput } from '../ai/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROFILE: ProjectProfile = {
  name: 'Kafue Gorge Solar 1',
  technology_type: 'SOLAR',
  project_size_mw: 50,
  location_country: 'Zambia',
  location_region: 'Lusaka',
  company_name: 'Acme Renewables Ltd',
};

/** Minimal EvidenceOutput with the reconciliation fields. */
function doc(over: {
  project_name?: string | null;
  capacity_mw?: number | null;
  location?: string | null;
  parties?: string[];
  belongs?: boolean;
  contradicts?: boolean;
  level?: 'HIGH' | 'MEDIUM' | 'LOW';
  reason?: string;
  evidence?: { key: string; satisfied: boolean; confidence: number }[];
}): EvidenceOutput {
  return {
    document_type: 'other',
    authenticity: { assessment: 'likely_authentic', notes: 'ok' },
    evidence: (over.evidence ?? []).map((e) => ({ ...e, excerpt: 'excerpt' })) as any,
    risk_flags: [],
    summary: 'A document.',
    project_identity: {
      project_name: over.project_name ?? null,
      capacity_mw: over.capacity_mw ?? null,
      location: over.location ?? null,
      parties: over.parties ?? [],
    },
    relevance: {
      level: over.level ?? 'HIGH',
      belongs_to_project: over.belongs ?? false,
      contradicts_project: over.contradicts,
      reason: over.reason ?? 'verdict',
    },
  } as unknown as EvidenceOutput;
}

const wrap = (results: { out: EvidenceOutput }[]) =>
  results.map((r, i) => ({ docId: `doc-${i + 1}`, out: r.out }));

// ── nameOverlap ───────────────────────────────────────────────────────────────

describe('nameOverlap', () => {
  it('scores same-project variants high', () => {
    expect(nameOverlap('Kafue Gorge Solar 1', 'Kafue Gorge Solar One')).toBeGreaterThanOrEqual(0.5);
  });

  it('scores unrelated projects at 0 despite shared industry words', () => {
    expect(nameOverlap('Kafue Gorge Hydro', 'Acme Solar Plant')).toBe(0);
  });

  it('does not match on boilerplate alone (energy/power/project)', () => {
    expect(nameOverlap('Solar Energy Project', 'Wind Power Project')).toBe(0);
  });
});

// ── reconcileDocuments ────────────────────────────────────────────────────────

describe('reconcileDocuments', () => {
  it('includes a document that names the project', () => {
    const r = reconcileDocuments(
      wrap([{ out: doc({ project_name: 'Kafue Gorge Solar 1', belongs: true }) }]),
      PROFILE,
    );
    expect(r.included).toHaveLength(1);
    expect(r.excluded).toHaveLength(0);
    expect(r.perDoc[0].status).toBe('match');
  });

  it('includes a document naming the developer as a party', () => {
    const r = reconcileDocuments(
      wrap([{ out: doc({ parties: ['ZESCO', 'Acme Renewables Ltd'], belongs: false }) }]),
      PROFILE,
    );
    expect(r.included).toHaveLength(1);
    expect(r.perDoc[0].status).toBe('match');
  });

  it('excludes a document that names a DIFFERENT project, with status contradicts', () => {
    const r = reconcileDocuments(
      wrap([{ out: doc({ project_name: 'Itezhi-Tezhi Hydro Expansion', belongs: false, contradicts: true, evidence: [{ key: 'ppa_signed', satisfied: true, confidence: 0.95 }] }) }]),
      PROFILE,
    );
    expect(r.excluded).toHaveLength(1);
    expect(r.excluded[0].status).toBe('contradicts');
    expect(r.allExcluded).toBe(true);
  });

  it('excludes a document with the wrong capacity and wrong name (negative identity)', () => {
    const r = reconcileDocuments(
      wrap([{ out: doc({ project_name: 'Lusaka South Solar', capacity_mw: 120, belongs: false }) }]),
      PROFILE,
    );
    expect(r.excluded).toHaveLength(1);
    expect(r.excluded[0].status).toBe('mismatch');
    expect(r.excluded[0].reason).toContain('120MW');
  });

  it('excludes generic content with no identity signals and low relevance', () => {
    const r = reconcileDocuments(
      wrap([{ out: doc({ level: 'LOW', belongs: false, evidence: [{ key: 'pre_feasibility', satisfied: true, confidence: 0.9 }] }) }]),
      PROFILE,
    );
    expect(r.excluded).toHaveLength(1);
    expect(r.excluded[0].status).toBe('unverifiable');
  });

  it('AI belongs=true with identity signals cannot be excluded by capacity alone', () => {
    // Same project name → positive identity wins despite a stale capacity figure.
    const r = reconcileDocuments(
      wrap([{ out: doc({ project_name: 'Kafue Gorge Solar 1', capacity_mw: 80, belongs: true }) }]),
      PROFILE,
    );
    expect(r.included).toHaveLength(1);
  });

  it('withholds the score when EVERY document is excluded', () => {
    const r = reconcileDocuments(
      wrap([
        { out: doc({ project_name: 'Itezhi-Tezhi Hydro', belongs: false, contradicts: true }) },
        { out: doc({ level: 'LOW', belongs: false }) },
      ]),
      PROFILE,
    );
    expect(r.allExcluded).toBe(true);
    expect(mustWithholdScore(r)).toBe(true);
  });

  it('does not withhold when at least one document matches', () => {
    const r = reconcileDocuments(
      wrap([
        { out: doc({ project_name: 'Kafue Gorge Solar 1', belongs: true }) },
        { out: doc({ project_name: 'Itezhi-Tezhi Hydro', belongs: false, contradicts: true }) },
      ]),
      PROFILE,
    );
    expect(r.included).toHaveLength(1);
    expect(mustWithholdScore(r)).toBe(false);
  });
});

// ── Risk flags ────────────────────────────────────────────────────────────────

describe('reconciliationRiskFlags', () => {
  it('emits HIGH flags for contradicts/mismatch and MEDIUM for unverifiable', () => {
    const r = reconcileDocuments(
      wrap([
        { out: doc({ project_name: 'Other Project', belongs: false, contradicts: true }) },
        { out: doc({ level: 'LOW', belongs: false }) },
      ]),
      PROFILE,
    );
    const flags = reconciliationRiskFlags(r);
    expect(flags).toHaveLength(2);
    expect(flags[0].severity).toBe('high');
    expect(flags[0].flag).toBe('document_contradicts_project');
    expect(flags[1].severity).toBe('medium');
    expect(flags[1].flag).toBe('document_not_linked');
  });
});

// ── Withheld score result ─────────────────────────────────────────────────────

describe('withheldScoreResult', () => {
  it('produces a zero score at Concept with all pillars at zero', () => {
    const r = reconcileDocuments(
      wrap([{ out: doc({ project_name: 'Other Project', belongs: false, contradicts: true }) }]),
      PROFILE,
    );
    const s = withheldScoreResult(r);
    expect(s.score).toBe(0);
    expect(s.derivedTotal).toBe(0);
    expect(s.consistent).toBe(true);
    expect(s.stage).toBe(1);
    expect(s.stageValue).toBe('CONCEPT');
    expect(s.pillars.every((p) => p.earned === 0 && p.missing === p.max)).toBe(true);
  });

  it('keeps the total-invariant: score === Σ pillar earns', () => {
    const r = reconcileDocuments(wrap([{ out: doc({ belongs: false }) }]), PROFILE);
    const s = withheldScoreResult(r);
    const sum = s.pillars.reduce((acc, p) => acc + p.earned, 0);
    expect(sum).toBe(s.score);
  });
});
