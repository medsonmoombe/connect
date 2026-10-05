import { describe, it, expect, afterEach } from 'vitest';
import {
  canonicalJson,
  analysisFormSignal,
  computeAnalysisSignalHash,
  evaluateAnalysisGuard,
  analysisMinIntervalMs,
  cachedPayload,
} from '../analysis-guard';

const MIN = 15 * 60_000;

function project(overrides: Record<string, unknown> = {}) {
  return {
    technology_type: 'SOLAR_PV',
    location_country: 'Zambia',
    location_region: 'Lusaka',
    project_size_mw: 50,
    capital_required: 20_000_000,
    capital_structure_type: 'EQUITY',
    funding_required: 8_000_000,
    description: 'Solar farm',
    has_secured_land: true,
    land_title_status: 'TITLED',
    has_reached_financial_close: false,
    regulatory_approvals: ['ERB', 'ZEMA'],
    governance_terms: 'Board seat',
    risk_disclosures: 'Permitting risk',
    ...overrides,
  };
}

const techReq = { grid_status: 'PENDING', ppa_status: 'IN_PROGRESS', required_services: ['EPC', 'FINANCIAL_ADVISORY'] };

const DOC_A = 'a'.repeat(64);
const DOC_B = 'b'.repeat(64);

describe('canonicalJson', () => {
  it('is stable regardless of key order', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });
  it('drops undefined but keeps null', () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

describe('analysisFormSignal', () => {
  it('captures score-relevant fields and sorts approvals', () => {
    const signal = analysisFormSignal(project(), techReq);
    expect(signal.regulatory_approvals).toEqual(['ERB', 'ZEMA']);
    expect(signal.tech_requirements).toEqual({ grid_status: 'PENDING', ppa_status: 'IN_PROGRESS', required_services: ['EPC', 'FINANCIAL_ADVISORY'] });
  });

  it('ignores non-scoring edits such as name and project id', () => {
    const a = analysisFormSignal(project({ name: 'A', id: 'x' }), techReq);
    const b = analysisFormSignal(project({ name: 'B', id: 'y' }), techReq);
    expect(computeAnalysisSignalHash([DOC_A], a)).toBe(computeAnalysisSignalHash([DOC_A], b));
  });
});

describe('computeAnalysisSignalHash', () => {
  it('is order-insensitive for documents', () => {
    const s = analysisFormSignal(project(), techReq);
    expect(computeAnalysisSignalHash([DOC_A, DOC_B], s)).toBe(computeAnalysisSignalHash([DOC_B, DOC_A], s));
  });

  it('changes when a document is added or removed', () => {
    const s = analysisFormSignal(project(), techReq);
    expect(computeAnalysisSignalHash([DOC_A], s)).not.toBe(computeAnalysisSignalHash([DOC_A, DOC_B], s));
  });

  it('changes when a score-relevant form field changes', () => {
    const base = computeAnalysisSignalHash([DOC_A], analysisFormSignal(project(), techReq));
    const changed = computeAnalysisSignalHash([DOC_A], analysisFormSignal(project({ has_reached_financial_close: true }), techReq));
    expect(changed).not.toBe(base);
  });

  it('an exact revert reproduces the original hash (defeats toggle abuse)', () => {
    const original = computeAnalysisSignalHash([DOC_A], analysisFormSignal(project(), techReq));
    // developer edits a field…
    computeAnalysisSignalHash([DOC_A], analysisFormSignal(project({ ppa: 'changed' }), techReq));
    // …then reverts it
    const reverted = computeAnalysisSignalHash([DOC_A], analysisFormSignal(project(), techReq));
    expect(reverted).toBe(original);
  });
});

describe('evaluateAnalysisGuard', () => {
  const signal = analysisFormSignal(project(), techReq);
  const hash = computeAnalysisSignalHash([DOC_A], signal);

  it('proceeds on a first-ever analysis (no stored hash)', () => {
    const r = evaluateAnalysisGuard({ docHashes: [DOC_A], formSignal: signal, storedHash: null, lastAnalysisAt: null, minIntervalMs: MIN });
    expect(r.decision).toBe('proceed');
    expect(r.contentChanged).toBe(false);
  });

  it('serves the cache at zero cost when content is identical', () => {
    const r = evaluateAnalysisGuard({ docHashes: [DOC_A], formSignal: signal, storedHash: hash, lastAnalysisAt: new Date().toISOString(), minIntervalMs: MIN });
    expect(r.decision).toBe('cached');
    expect(r.contentChanged).toBe(false);
    expect(r.retryAfterMs).toBeNull();
  });

  it('proceeds when content changed and the cooldown has elapsed', () => {
    const longAgo = new Date(Date.now() - 2 * MIN).toISOString();
    const changedSignal = analysisFormSignal(project({ description: 'changed' }), techReq);
    const r = evaluateAnalysisGuard({ docHashes: [DOC_A, DOC_B], formSignal: changedSignal, storedHash: hash, lastAnalysisAt: longAgo, minIntervalMs: MIN });
    expect(r.decision).toBe('proceed');
    expect(r.contentChanged).toBe(true);
  });

  it('throttles an edit-loop that changes content within the cooldown (anti-abuse)', () => {
    const justNow = new Date(Date.now() - 60_000).toISOString();
    const changedSignal = analysisFormSignal(project({ description: 'changed' }), techReq);
    const r = evaluateAnalysisGuard({ docHashes: [DOC_A], formSignal: changedSignal, storedHash: hash, lastAnalysisAt: justNow, minIntervalMs: MIN });
    expect(r.decision).toBe('throttled');
    expect(r.contentChanged).toBe(true);
    expect(r.retryAfterMs).toBeGreaterThan(0);
    expect(r.retryAfterMs).toBeLessThanOrEqual(MIN);
  });

  it('an exact revert stays cached (no AI cost) even inside the cooldown', () => {
    const justNow = new Date(Date.now() - 60_000).toISOString();
    const r = evaluateAnalysisGuard({ docHashes: [DOC_A], formSignal: signal, storedHash: hash, lastAnalysisAt: justNow, minIntervalMs: MIN });
    expect(r.decision).toBe('cached');
  });
});

describe('analysisMinIntervalMs', () => {
  const KEY = 'AI_ANALYSIS_MIN_INTERVAL_MS';
  const saved = process.env[KEY];
  afterEach(() => { if (saved === undefined) delete process.env[KEY]; else process.env[KEY] = saved; });

  it('defaults to 15 minutes', () => {
    delete process.env[KEY];
    expect(analysisMinIntervalMs()).toBe(15 * 60_000);
  });

  it('honours the env override', () => {
    process.env[KEY] = '60000';
    expect(analysisMinIntervalMs()).toBe(60_000);
  });
});

describe('cachedPayload', () => {
  it('marks the response as cached', () => {
    const p = cachedPayload({ capital_readiness_score: 42 });
    expect(p.cached).toBe(true);
    expect(p.success).toBe(true);
    expect(p.data.capital_readiness_score).toBe(42);
  });
});
