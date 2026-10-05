import type { ProjectScore } from '@/types';
import { READINESS_REWORK_THRESHOLD, READINESS_VALIDATION_THRESHOLD } from './readiness-thresholds';

export type ReviewRecommendationAction = 'run_analysis' | 'validate' | 'review' | 'reject';

export type ReviewRecommendation = {
  action: ReviewRecommendationAction;
  score: number | null;
  tone: 'slate' | 'emerald' | 'amber' | 'red';
  title: string;
  message: string;
  canValidate: boolean;
};

function normalizeScore(score?: ProjectScore | null): number | null {
  if (!score) return null;
  const value = score.capital_readiness_score ?? score.technical_readiness_score;
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : null;
}

export function getReviewRecommendation(score?: ProjectScore | null): ReviewRecommendation {
  const normalizedScore = normalizeScore(score);

  if (normalizedScore === null) {
    return {
      action: 'run_analysis',
      score: null,
      tone: 'slate',
      title: 'AI analysis required',
      message: 'Run AI analysis before approving or rejecting this project. The review decision should be based on the scored document assessment.',
      canValidate: false,
    };
  }

  if (normalizedScore >= READINESS_VALIDATION_THRESHOLD) {
    return {
      action: 'validate',
      score: normalizedScore,
      tone: 'emerald',
      title: 'Recommended action: validate',
      message: `AI readiness score is ${normalizedScore}/100. The project appears ready for validation, subject to final human review of documents and risk flags.`,
      canValidate: true,
    };
  }

  if (normalizedScore >= READINESS_REWORK_THRESHOLD) {
    return {
      action: 'review',
      score: normalizedScore,
      tone: 'amber',
      title: 'Recommended action: review deeper',
      message: `AI readiness score is ${normalizedScore}/100. Review the risk flags and recommendations before deciding whether to validate or reject.`,
      canValidate: true,
    };
  }

  return {
    action: 'reject',
    score: normalizedScore,
    tone: 'red',
    title: 'Recommended action: reject or return',
    message: `AI readiness score is ${normalizedScore}/100. The project is below the review threshold and likely needs rework before validation.`,
    canValidate: false,
  };
}
