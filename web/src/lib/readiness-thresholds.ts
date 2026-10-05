/**
 * readiness-thresholds.ts — the ONE definition of the readiness bands every
 * surface (developer dashboards, review queues, authority console, marketplace)
 * uses to colour and classify a readiness score.
 *
 * Why this exists: thresholds were previously duplicated as literals
 * (40/60/70, occasionally 45) across ~15 files and had drifted — some surfaces
 * called 60 "green", others 70; the submit gate used 40 while review
 * intelligence used 50. A score of 65 was simultaneously "good" and "needs
 * rework" depending on which screen rendered it.
 *
 * Aligned with lib/review-intelligence.ts (the reviewer decision bands):
 *   < 50        red    — rework
 *   50–74       amber  — review risk flags before deciding
 *   >= 75       green  — ready for validation, subject to human review
 * The gap band (40) below is the developer-facing "action needed" bar, kept
 * distinct so developer nudges fire earlier than reviewer expectations.
 */

export const READINESS_MIN = 0;
export const READINESS_MAX = 100;

/** Developer action bar: below this, the platform actively pushes consultation. */
export const READINESS_ACTION_THRESHOLD = 40;

/** Reviewer decision bands (mirror review-intelligence.ts). */
export const READINESS_REWORK_THRESHOLD = 50;
export const READINESS_VALIDATION_THRESHOLD = 75;

export type ReadinessLevel = 'rework' | 'attention' | 'ready';

export function readinessLevel(score: number): ReadinessLevel {
  if (!Number.isFinite(score)) return 'rework';
  if (score >= READINESS_VALIDATION_THRESHOLD) return 'ready';
  if (score >= READINESS_REWORK_THRESHOLD) return 'attention';
  return 'rework';
}

export interface ReadinessBandStyle {
  /** Tailwind text colour for the score. */
  text: string;
  /** Tailwind background fill for progress bars. */
  bar: string;
  /** Tailwind classes for a pill/badge. */
  pill: string;
  /** Short classification. */
  label: 'Early' | 'Developing' | 'Strong';
}

/**
 * Style a readiness score consistently. Single source for the tri-colour
 * scheme; do not add new threshold literals in components.
 */
export function readinessBandStyle(score: number): ReadinessBandStyle {
  const level = readinessLevel(score);
  switch (level) {
    case 'ready':
      return {
        text: 'text-emerald-600',
        bar: 'bg-emerald-500',
        pill: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        label: 'Strong',
      };
    case 'attention':
      return {
        text: 'text-amber-600',
        bar: 'bg-amber-500',
        pill: 'bg-amber-50 border-amber-200 text-amber-700',
        label: 'Developing',
      };
    default:
      return {
        text: 'text-red-500',
        bar: 'bg-red-400',
        pill: 'bg-red-50 border-red-200 text-red-600',
        label: 'Early',
      };
  }
}
