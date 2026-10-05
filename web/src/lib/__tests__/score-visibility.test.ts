import { describe, expect, it } from 'vitest';
import { isScoreHiddenForDeveloper, scoreAvailability } from '../score-visibility';

describe('isScoreHiddenForDeveloper', () => {
  it('shows the score once the project is live', () => {
    expect(isScoreHiddenForDeveloper('live', false)).toBe(false);
  });

  it('keeps the score visible in terminal post-live states', () => {
    expect(isScoreHiddenForDeveloper('deactivated', false)).toBe(false);
    expect(isScoreHiddenForDeveloper('archived', false)).toBe(false);
  });

  it('shows a returned draft its score so the developer can act on the comment', () => {
    expect(isScoreHiddenForDeveloper('draft', true)).toBe(false);
  });

  it('hides a first-time draft, which has no reviewer feedback yet', () => {
    expect(isScoreHiddenForDeveloper('draft', false)).toBe(true);
  });

  it('hides every pre-review status', () => {
    for (const status of ['scoring', 'scoring_retry', 'under_review', 'pending_live', 'paused']) {
      expect(isScoreHiddenForDeveloper(status, false)).toBe(true);
    }
  });

  it('hides the score for an unknown or missing status', () => {
    expect(isScoreHiddenForDeveloper(null, false)).toBe(true);
    expect(isScoreHiddenForDeveloper(undefined, false)).toBe(true);
    expect(isScoreHiddenForDeveloper('some_new_status', false)).toBe(true);
  });

  it('defaults to hiding when the status is unknown even if a reason exists', () => {
    expect(isScoreHiddenForDeveloper('mystery', true)).toBe(true);
  });
});

describe('scoreAvailability', () => {
  it('reports available when the score may be shown', () => {
    expect(
      scoreAvailability({ status: 'live', hasRejectionReason: false, hasScore: true }),
    ).toBe('available');
  });

  it('distinguishes a withheld score from a score that was never produced', () => {
    expect(
      scoreAvailability({ status: 'under_review', hasRejectionReason: false, hasScore: true }),
    ).toBe('hidden');
    expect(
      scoreAvailability({ status: 'draft', hasRejectionReason: false, hasScore: false }),
    ).toBe('not_run');
  });

  it('reports running while an analysis job is in flight', () => {
    expect(
      scoreAvailability({ status: 'scoring', hasRejectionReason: false, hasScore: false }),
    ).toBe('running');
    expect(
      scoreAvailability({ status: 'scoring_retry', hasRejectionReason: false, hasScore: false }),
    ).toBe('running');
  });

  it('never reports hidden for a status that shows the score', () => {
    expect(
      scoreAvailability({ status: 'draft', hasRejectionReason: true, hasScore: true }),
    ).toBe('available');
  });
});