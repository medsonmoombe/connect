import { describe, it, expect } from 'vitest';
import {
  scoreProject, explainPillars, pillarContributions, SCORING_V2,
} from '../scoring/engine';
import type { EvidenceEntry, ResolvedEvidence } from '../scoring/engine';
import { sanitizeInsightLines } from '../ai/rating-insight';
import { buildRatingInsightPrompt } from '../ai/prompt';
import { ratingInsightSchema } from '../ai/types';
import type { EvidenceKey } from '../ai/types';

const doc = (key: EvidenceKey, confidence: number, excerpt?: string): EvidenceEntry => ({
  key, satisfied: true, confidence, source: 'document', excerpt,
});
const claim = (key: EvidenceKey): EvidenceEntry => ({
  key, satisfied: true, confidence: 0.5, source: 'self_reported',
});
const FULL = { threshold: 0.7, mode: 'full' as const };
const PREVIEW = { threshold: 0.7, mode: 'preview' as const };

describe('point ledger — why a pillar holds its rating', () => {
  it('Σ contribution points equals the pillar earned, for any evidence mix', () => {
    // Deliberately mixes every status so the invariant is exercised broadly
    // rather than on one happy path.
    const evidence: ResolvedEvidence = {
      land_secured: doc('land_secured', 0.95, 'Title deed 4521 registered to Acme Energy Ltd'),
      pre_feasibility: doc('pre_feasibility', 0.9),
      full_feasibility: doc('full_feasibility', 0.88, 'Bankable FS, IRR 14.2%'),
      eia_completed: doc('eia_completed', 0.85),
      eia_approved: doc('eia_approved', 0.91, 'ZEMA approval decision letter ref ZEMA/2024/88'),
      generation_licence: doc('generation_licence', 0.6), // below threshold
      grid_application_submitted: claim('grid_application_submitted'),
      financial_model: doc('financial_model', 0.8),
      ppa_under_negotiation: doc('ppa_under_negotiation', 0.9),
      ppa_signed: doc('ppa_signed', 0.9),
      construction_started: {
        key: 'construction_started', satisfied: false, confidence: 0.8,
        source: 'document', contested: true,
      },
    };

    const ledger = explainPillars(SCORING_V2, evidence, FULL);
    const scored = scoreProject(evidence, SCORING_V2, FULL);

    // The ledger is not a parallel calculation — it must agree with the score
    // it explains, pillar for pillar.
    for (const pillar of ledger) {
      const sum = pillar.contributions.reduce((s, c) => s + c.points, 0);
      expect(sum).toBe(pillar.earned);
      const scoredPillar = scored.pillars.find((p) => p.key === pillar.key);
      expect(scoredPillar).toBeDefined();
      expect(pillar.earned).toBe(scoredPillar!.earned);
    }

    const total = ledger.reduce((s, p) => s + p.earned, 0);
    expect(total).toBe(scored.score);
  });

  it('records a status for every milestone, even ones with no evidence at all', () => {
    const ledger = explainPillars(SCORING_V2, {}, FULL);
    // Every rule in SCORING_V2 must be accounted for, or a rating would have
    // points nobody can account for.
    const ruleCount = SCORING_V2.reduce((s, p) => s + p.rules.length, 0);
    const contributionCount = ledger.reduce((s, p) => s + p.contributions.length, 0);
    expect(contributionCount).toBe(ruleCount);

    for (const pillar of ledger) {
      for (const c of pillar.contributions) {
        expect(c.points).toBe(0);
        expect(c.status).toBe('absent');
        expect(c.label).toBeTruthy();
      }
    }
  });

  it('tier groups: the superseded tier reports 0 points, not a second score', () => {
    const evidence: ResolvedEvidence = {
      eia_completed: doc('eia_completed', 0.85),
      eia_approved: doc('eia_approved', 0.9),
    };
    const regulatory = explainPillars(SCORING_V2, evidence, FULL).find((p) => p.key === 'regulatory')!;
    const completed = regulatory.contributions.find((c) => c.key === 'eia_completed')!;
    const approved = regulatory.contributions.find((c) => c.key === 'eia_approved')!;

    expect(approved.points).toBe(14);
    expect(completed.points).toBe(0);
    // Still `documented` — the EIA was completed, it just no longer scores on
    // its own once approval is proven. Reporting it as missing would be a lie.
    expect(completed.status).toBe('documented');
    expect(regulatory.earned).toBe(14);
  });

  it('distinguishes claim-only from weak evidence from contested from missing', () => {
    const evidence: ResolvedEvidence = {
      financial_model: claim('financial_model'),                                  // self-reported
      financing_term_sheet: doc('financing_term_sheet', 0.65),                     // below threshold
      financial_close: {
        key: 'financial_close', satisfied: false, confidence: 0.8,
        source: 'document', contested: true,
      },
    };
    const financial = explainPillars(SCORING_V2, evidence, FULL).find((p) => p.key === 'financial')!;
    const byKey = Object.fromEntries(financial.contributions.map((c) => [c.key, c]));

    // A gated milestone claimed on the form earns nothing in full mode — and
    // must not be reported as if a document had been assessed.
    expect(byKey.financial_model.status).toBe('self_reported');
    expect(byKey.financial_model.points).toBe(0);

    // Seen but below the confidence threshold: the document exists and was read.
    expect(byKey.financing_term_sheet.status).toBe('weak_evidence');
    expect(byKey.financing_term_sheet.points).toBe(0);

    // Documents disagreed — unresolved, not absent.
    expect(byKey.financial_close.status).toBe('contested');
    expect(byKey.financial_close.points).toBe(0);

    // Never mentioned by anything.
    expect(byKey.ppa_signed.status).toBe('absent');

    expect(financial.earned).toBe(0);
  });

  it('a preview claim scores at half and says so', () => {
    const evidence: ResolvedEvidence = { financial_model: claim('financial_model') };
    const full = pillarContributions(
      SCORING_V2.find((p) => p.key === 'financial')!, evidence, FULL,
    ).find((c) => c.key === 'financial_model')!;
    const preview = pillarContributions(
      SCORING_V2.find((p) => p.key === 'financial')!, evidence, PREVIEW,
    ).find((c) => c.key === 'financial_model')!;

    expect(full.points).toBe(0);
    expect(preview.points).toBe(2.5); // 5 * SELF_REPORT_DISCOUNT
    // Discounted is not the same as proven — the status stays honest in both.
    expect(full.status).toBe('self_reported');
    expect(preview.status).toBe('self_reported');
  });
});

describe('rating insight — the model cannot invent a rating', () => {
  const allowed = ['land', 'regulatory'];

  it('drops a key that was never asked about', () => {
    const lines = sanitizeInsightLines(
      [
        { key: 'land', why: 'Land title is registered to the project company.' },
        { key: 'developer_strength', why: 'The developer has built four plants.' },
      ],
      allowed,
    );
    expect(lines).toEqual([
      { key: 'land', why: 'Land title is registered to the project company.' },
    ]);
  });

  it('drops blank reasons and duplicate keys', () => {
    const lines = sanitizeInsightLines(
      [
        { key: 'land', why: '   ' },
        { key: 'land', why: 'First explanation wins.' },
        { key: 'land', why: 'Second is discarded.' },
        { key: 'regulatory', why: 'No licence issued yet.' },
      ],
      allowed,
    );
    expect(lines).toEqual([
      { key: 'land', why: 'First explanation wins.' },
      { key: 'regulatory', why: 'No licence issued yet.' },
    ]);
  });

  it('has no field a score could be smuggled into', () => {
    // The explanation carries prose only. Anything score-shaped is discarded by
    // the schema, so a model cannot restate or revise a rating — including
    // through the narrative brief, which is the field with the most room to
    // have found a way to restate numbers.
    const parsed = ratingInsightSchema.parse({
      brief: 'Acme Energy is a 120 MW solar project in Zambia.',
      strengths: ['Land title is registered.'],
      weaknesses: ['No PPA signed yet.'],
      overall: 'Regulatory approval carries the score.',
      pillars: [{ key: 'land', why: 'Land title is registered.' }],
      evidence: [],
      stage: '',
      next_steps: [],
      score: 99,
      total_score: 99,
      pillars_score: { land: 99 },
    });
    expect(parsed).not.toHaveProperty('score');
    expect(parsed).not.toHaveProperty('total_score');
    expect(parsed.overall).toBe('Regulatory approval carries the score.');
    expect(parsed.brief).toBe('Acme Energy is a 120 MW solar project in Zambia.');
    expect(parsed.strengths).toEqual(['Land title is registered.']);
    expect(parsed.weaknesses).toEqual(['No PPA signed yet.']);
  });

  it('carries a multi-paragraph brief and both-sided lists, dropping junk', () => {
    const parsed = ratingInsightSchema.parse({
      brief: '  First paragraph.\n\nSecond paragraph.\n\n\nThird.  ',
      strengths: ['Land proven.', '   ', 42, null, 'EIA approved.'],
      weaknesses: 'not an array',
      overall: 'x',
      pillars: [],
      evidence: [],
      stage: '',
      next_steps: [],
    });
    // Paragraph breaks are what the brief is read as, so they must survive intact.
    expect(parsed.brief).toContain('First paragraph.\n\nSecond paragraph.');
    expect(parsed.strengths).toEqual(['Land proven.', 'EIA approved.']);
    expect(parsed.weaknesses).toEqual([]);
  });

  it('feeds the brief the document detail it needs to read like a report', () => {
    // Without the per-document digests the brief can only restate the ledger,
    // which is what made the earlier output read like a score breakdown rather
    // than an account of what the paperwork says.
    const prompt = buildRatingInsightPrompt({
      project: { name: 'Acme Solar', technology: 'solar', capacityMW: 120, location: 'Zambia' },
      score: 42,
      maxScore: 100,
      stage: 2,
      stageLabel: 'Pre-feasibility',
      ledger: [{
        key: 'regulatory', label: 'Regulatory', earned: 14, max: 20,
        contributions: [{
          key: 'eia_approved', label: 'EIA approved', points: 14, maxPoints: 14,
          status: 'documented', source: 'eia_esia', confidence: 0.9,
          excerpt: 'ZEMA approval ref ZEMA/2024/88',
        }],
      }],
      blocking: [{ key: 'generation_licence', label: 'Generation licence' }],
      caveats: ['One document could not be read.'],
      documentDigests: [{
        label: 'eia esia', type: 'eia_esia',
        summary: 'Full ESIA with an approval decision letter.',
        findings: ['Approval reference ZEMA/2024/88 dated 4 March 2024'],
        integrity: 'authentic',
      }],
      projectFacts: ['Capacity: 120 MW'],
    });

    expect(prompt).toContain('Approval reference ZEMA/2024/88');
    expect(prompt).toContain('Full ESIA with an approval decision letter.');
    expect(prompt).toContain('ZEMA approval ref ZEMA/2024/88');
    expect(prompt).toContain('Generation licence');
  });

  it('copes with a model that returns only a brief', () => {
    // A brief on its own is a usable report — the panel leads with it, and the
    // missing pillar lines degrade to a bare point breakdown rather than
    // dropping the analysis.
    const parsed = ratingInsightSchema.parse({
      brief: 'The project holds land and an approved EIA.',
    });
    expect(parsed.brief).toContain('approved EIA');
    expect(parsed.strengths).toEqual([]);
    expect(parsed.weaknesses).toEqual([]);
    expect(parsed.overall).toBe('');
  });

  it('keeps the good lines when one entry is malformed', () => {
    const parsed = ratingInsightSchema.parse({
      overall: 'Land is proven; nothing else is.',
      pillars: [
        { key: 'land', why: 'Land title is registered.' },
        'not an object',
        null,
        { key: 'regulatory', why: 'No licence issued yet.' },
      ],
      evidence: 'not an array',
      stage: 42,
      next_steps: ['Get the licence.', 42, null],
    });
    expect(parsed.pillars.map((p) => p.key)).toEqual(['land', 'regulatory']);
    expect(parsed.evidence).toEqual([]);
    expect(parsed.stage).toBe('');
    expect(parsed.next_steps).toEqual(['Get the licence.']);
  });
});