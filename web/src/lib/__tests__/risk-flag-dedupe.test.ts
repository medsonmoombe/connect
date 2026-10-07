import { describe, expect, it } from 'vitest';
import { dedupeRiskFlags } from '../ai/orchestrator';

describe('dedupeRiskFlags', () => {
  it('leaves distinct findings alone', () => {
    const flags = [
      { severity: 'high' as const, flag: 'conflicting_evidence', detail: 'Documents disagree on capacity.' },
      { severity: 'low' as const, flag: 'template_content', detail: 'Generic boilerplate detected.' },
    ];
    expect(dedupeRiskFlags(flags)).toEqual(flags);
  });

  it('collapses an identical finding reported by two documents', () => {
    const out = dedupeRiskFlags([
      { severity: 'medium', flag: 'Unexecuted PPA', detail: 'PPAs are still under negotiation.' },
      { severity: 'medium', flag: 'Unexecuted PPA', detail: 'PPAs are still under negotiation.' },
    ]);
    expect(out).toHaveLength(1);
  });

  it('matches labels regardless of case, spacing and punctuation', () => {
    const out = dedupeRiskFlags([
      { severity: 'low', flag: 'Financial Close Pending', detail: 'Financial close has not been reached.' },
      { severity: 'low', flag: 'financial-close  pending', detail: 'Financial close has not been reached.' },
      { severity: 'low', flag: 'financial_close_pending', detail: 'Financial close has not been reached.' },
    ]);
    expect(out).toHaveLength(1);
  });

  it('keeps the highest severity when the same finding is reported at different levels', () => {
    const [merged] = dedupeRiskFlags([
      { severity: 'low', flag: 'unexecuted_ppa', detail: 'Short detail.' },
      { severity: 'high', flag: 'Unexecuted PPA', detail: 'Short detail.' },
    ]);
    expect(merged.severity).toBe('high');
  });

  it('keeps the most specific detail when severities match', () => {
    const specific =
      'The power purchase agreements with the mining offtakers remain unexecuted and no signature page has been provided.';
    const [merged] = dedupeRiskFlags([
      { severity: 'medium', flag: 'unexecuted_ppa', detail: 'PPAs unsigned.' },
      { severity: 'medium', flag: 'Unexecuted PPA', detail: specific },
    ]);
    expect(merged.detail).toBe(specific);
  });

  it('retains the loser detail so merged evidence is not lost', () => {
    const [merged] = dedupeRiskFlags([
      { severity: 'low', flag: 'offtake', detail: 'ZESCO confirmed the grid connection study is still in progress.' },
      { severity: 'high', flag: 'Offtake', detail: 'Offtake is unsigned.' },
    ]);
    expect(merged.severity).toBe('high');
    expect(merged.detail).toContain('also reported');
    expect(merged.detail).toContain('in progress');
  });

  it('does not append a restatement of the same detail', () => {
    const [merged] = dedupeRiskFlags([
      { severity: 'low', flag: 'offtake', detail: 'Financial close has not been reached, targeting 31 March 2027.' },
      { severity: 'low', flag: 'Offtake', detail: 'Financial close has not been reached, targeting 31 March 2027.' },
    ]);
    expect(merged.detail).not.toContain('also reported');
  });

  it('treats a reworded version of one sentence as the same finding', () => {
    const [merged] = dedupeRiskFlags([
      { severity: 'medium', flag: 'tariff_under_negotiation', detail: 'Tariff is under negotiation with two mining companies.' },
      { severity: 'medium', flag: 'Tariff Under Negotiation', detail: 'The tariff remains under negotiation with the mining companies.' },
    ]);
    expect(merged.detail).not.toContain('also reported');
  });

  it('does not merge different findings that merely share prose', () => {
    const out = dedupeRiskFlags([
      { severity: 'medium', flag: 'Pending PPA execution', detail: 'Offtake agreements are still under negotiation with mining buyers.' },
      { severity: 'low', flag: 'Pending Offtake Agreements', detail: 'Tariff is based on negotiations with two mining offtakers.' },
    ]);
    expect(out).toHaveLength(2);
  });

  it('orders findings by severity, most severe first', () => {
    const out = dedupeRiskFlags([
      { severity: 'low', flag: 'a', detail: 'a' },
      { severity: 'high', flag: 'b', detail: 'b' },
      { severity: 'medium', flag: 'c', detail: 'c' },
    ]);
    expect(out.map((f) => f.severity)).toEqual(['high', 'medium', 'low']);
  });

  it('drops entries with an empty label rather than merging everything into one', () => {
    const out = dedupeRiskFlags([
      { severity: 'low', flag: '   ', detail: 'x' },
      { severity: 'low', flag: '!!!', detail: 'y' },
    ]);
    expect(out).toEqual([]);
  });
});