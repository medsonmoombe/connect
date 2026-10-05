/**
 * chart-theme.ts — SINGLE SOURCE OF TRUTH for dashboard chart styling.
 *
 * Every chart in the app (Recharts) imports its palette, axis spec, grid
 * style, and tooltip from here (components/charts/ChartKit.tsx wraps the
 * components). Do not hardcode hex colors inside pages — add them here.
 *
 * Design rules (the "9/10" spec):
 *  - One hue family for quantity (greens). Color carries meaning only:
 *    stage ramp (CONCEPT→OPERATION), status ramp (INTRO→COMMITTED),
 *    provider identity, or a semantic accent (capital=blue, attention=amber).
 *  - No rainbow category bars: single-hue unless each color maps to a legend
 *    entry or tooltip identity.
 *  - Horizontal gridlines only, #f1f5f9, no axis borders, no tick lines.
 *  - 10px/600 axis ticks in slate-400, 11px bold tooltip text.
 */

// ── Core palette ───────────────────────────────────────────────────────────

/** Primary quantity hue (brand green, deep) — default for bars/areas. */
export const CHART_PRIMARY = '#0b3b24';

/** Categorical palette for true identity slices (tech mix, providers). */
export const CHART_CATEGORICAL = [
  '#0b3b24', // deep green (primary)
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ef4444', // red
  '#22c55e', // green
  '#64748b', // slate
] as const;

/** Semantic accents for cross-chart series (users/projects/engagements…). */
export const CHART_ACCENT = {
  primary: '#0b3b24',
  blue: '#3b82f6',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  cyan: '#06b6d4',
  slate: '#94a3b8',
  red: '#ef4444',
  green: '#22c55e',
} as const;

// ── Domain ramps ───────────────────────────────────────────────────────────

/** Project stage ramp — slate (concept) → emerald (operation). */
export const STAGE_COLORS: Record<string, string> = {
  CONCEPT: '#94a3b8',
  PRE_FEASIBILITY: '#60a5fa',
  FULL_FEASIBILITY: '#818cf8',
  REGULATORY_APPROVAL: '#a78bfa',
  PPA_READY: '#22d3ee',
  FINANCIAL_CLOSE: '#fbbf24',
  CONSTRUCTION: '#4ade80',
  OPERATION: '#059669',
};

/** Engagement pipeline ramp — amber (intro) → emerald (committed), neutral ends. */
export const ENGAGEMENT_STATUS_COLORS: Record<string, string> = {
  INTRO_SENT: '#fbbf24',
  INTRO_ACCEPTED: '#60a5fa',
  NDA_SIGNED: '#818cf8',
  DUE_DILIGENCE: '#a78bfa',
  TERM_SHEET: '#22d3ee',
  CONTRACT_SIGNED: '#4ade80',
  CAPITAL_COMMITTED: '#059669',
  CLOSED: '#94a3b8',
  DROPPED: '#ef4444',
};

// ── Axis / grid spec ───────────────────────────────────────────────────────

/** Standard tick style for both axes. */
export const AXIS_TICK = { fontSize: 10, fontWeight: 600, fill: '#94a3b8' } as const;

/** Horizontal-only gridline stroke. */
export const GRID_STROKE = '#f1f5f9';

/** Props for a clean horizontal-grid recharts <CartesianGrid>. */
export const GRID_PROPS = {
  stroke: GRID_STROKE,
  strokeDasharray: '3 3',
  vertical: false,
} as const;

/** Common axis props: no border line, no tick line. */
export const AXIS_PROPS = {
  axisLine: false,
  tickLine: false,
  tick: AXIS_TICK,
} as const;

/** Bar radius for vertical bars (top corners). */
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

/** Bar radius for horizontal bars (right corners). */
export const BAR_RADIUS_H: [number, number, number, number] = [0, 4, 4, 0];

// ── Formatters ─────────────────────────────────────────────────────────────

/** Compact currency for axis ticks: $1.2M / $850K / $2.0B. */
export function fmtCompactCurrency(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${Math.round(n / 1e6)}M`;
  if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}
