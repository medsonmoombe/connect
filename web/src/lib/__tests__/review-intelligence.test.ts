import { describe, it, expect } from 'vitest';
import { getReviewRecommendation } from '../review-intelligence';
import type { ProjectScore } from '@/types';

function makeScore(overrides: Partial<ProjectScore> = {}): ProjectScore {
  return {
    id: 'score-1',
    project_id: 'proj-1',
    capital_readiness_score: 50,
    technical_readiness_score: 50,
    documentation_score: 50,
    governance_score: 50,
    financial_transparency_score: 50,
    regulatory_score: 50,
    risk_flags: [],
    recommendations: [],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('getReviewRecommendation', () => {
  describe('No score available', () => {
    it('returns run_analysis action when score is null', () => {
      const result = getReviewRecommendation(null);
      expect(result.action).toBe('run_analysis');
      expect(result.score).toBeNull();
      expect(result.tone).toBe('slate');
      expect(result.canValidate).toBe(false);
    });

    it('returns run_analysis action when score is undefined', () => {
      const result = getReviewRecommendation(undefined);
      expect(result.action).toBe('run_analysis');
      expect(result.score).toBeNull();
    });

    it('returns run_analysis when score object has no numeric scores', () => {
      const result = getReviewRecommendation(makeScore({
        capital_readiness_score: undefined as any,
        technical_readiness_score: undefined as any,
      }));
      expect(result.action).toBe('run_analysis');
    });
  });

  describe('High score (>= 75)', () => {
    it('returns validate action for high readiness scores', () => {
      const result = getReviewRecommendation(makeScore({ capital_readiness_score: 85 }));
      expect(result.action).toBe('validate');
      expect(result.score).toBe(85);
      expect(result.tone).toBe('emerald');
      expect(result.canValidate).toBe(true);
    });

    it('uses technical_readiness_score as fallback', () => {
      const result = getReviewRecommendation(makeScore({
        capital_readiness_score: undefined as any,
        technical_readiness_score: 90,
      }));
      expect(result.action).toBe('validate');
      expect(result.score).toBe(90);
    });

    it('caps at 100', () => {
      const result = getReviewRecommendation(makeScore({ capital_readiness_score: 150 }));
      expect(result.score).toBe(100);
    });

    it('floors at 0', () => {
      const result = getReviewRecommendation(makeScore({ capital_readiness_score: -50 }));
      expect(result.score).toBe(0);
    });

    it('rounds the score', () => {
      const result = getReviewRecommendation(makeScore({ capital_readiness_score: 85.7 }));
      expect(result.score).toBe(86);
    });
  });

  describe('Medium score (50-74)', () => {
    it('returns review action for medium readiness scores', () => {
      const result = getReviewRecommendation(makeScore({ capital_readiness_score: 65 }));
      expect(result.action).toBe('review');
      expect(result.score).toBe(65);
      expect(result.tone).toBe('amber');
      expect(result.canValidate).toBe(true);
    });

    it('returns review action for score exactly 50', () => {
      const result = getReviewRecommendation(makeScore({ capital_readiness_score: 50 }));
      expect(result.action).toBe('review');
      expect(result.score).toBe(50);
    });

    it('returns review action for score exactly 74', () => {
      const result = getReviewRecommendation(makeScore({ capital_readiness_score: 74 }));
      expect(result.action).toBe('review');
      expect(result.score).toBe(74);
    });
  });

  describe('Low score (< 50)', () => {
    it('returns reject action for low readiness scores', () => {
      const result = getReviewRecommendation(makeScore({ capital_readiness_score: 30 }));
      expect(result.action).toBe('reject');
      expect(result.score).toBe(30);
      expect(result.tone).toBe('red');
      expect(result.canValidate).toBe(false);
    });

    it('returns reject action for score exactly 0', () => {
      const result = getReviewRecommendation(makeScore({ capital_readiness_score: 0 }));
      expect(result.action).toBe('reject');
      expect(result.score).toBe(0);
    });

    it('returns reject action for score 49', () => {
      const result = getReviewRecommendation(makeScore({ capital_readiness_score: 49 }));
      expect(result.action).toBe('reject');
      expect(result.score).toBe(49);
    });
  });

  describe('Message content', () => {
    it('messages mention the score', () => {
      const result = getReviewRecommendation(makeScore({ capital_readiness_score: 72 }));
      expect(result.message).toContain('72');
      expect(result.title).toContain('review deeper');
    });

    it('no-score message asks to run analysis', () => {
      const result = getReviewRecommendation(null);
      expect(result.title).toContain('AI analysis required');
      expect(result.message).toContain('Run AI analysis');
    });

    it('high score message recommends validation', () => {
      const result = getReviewRecommendation(makeScore({ capital_readiness_score: 80 }));
      expect(result.title).toContain('validate');
      expect(result.message).toContain('ready for validation');
    });

    it('low score message recommends rejection', () => {
      const result = getReviewRecommendation(makeScore({ capital_readiness_score: 25 }));
      expect(result.title).toContain('reject');
      expect(result.message).toContain('below the review threshold');
    });
  });

  describe('Edge cases', () => {
    it('handles NaN gracefully', () => {
      const result = getReviewRecommendation(makeScore({
        capital_readiness_score: NaN,
      }));
      expect(result.score).toBeNull();
      expect(result.action).toBe('run_analysis');
    });

    it('handles Infinity gracefully', () => {
      const result = getReviewRecommendation(makeScore({
        capital_readiness_score: Infinity,
      }));
      // Infinity fails Number.isFinite check, so it returns null score
      expect(result.score).toBeNull();
      expect(result.action).toBe('run_analysis');
    });

    it('returns consistent result structure', () => {
      const result = getReviewRecommendation(makeScore({ capital_readiness_score: 60 }));
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('tone');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('canValidate');
    });
  });
});
