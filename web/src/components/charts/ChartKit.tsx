'use client';

/**
 * ChartKit.tsx — shared Recharts building blocks for every dashboard chart.
 *
 * Use these instead of raw recharts primitives so typography, tooltip
 * anatomy, and spacing stay identical across pages. Colors/tokens live in
 * @/lib/chart-theme; this file wraps the components.
 */

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

// ── Layout constants ───────────────────────────────────────────────────────

/** Standard chart plot height inside a card body. */
export const CHART_HEIGHT = 208;

/** Standard recharts margin for dashboard charts. */
export const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 } as const;

// ── Tooltip ────────────────────────────────────────────────────────────────

/** Row definition for ChartTooltip. */
export interface TooltipRow {
  label: string;
  value: string;
  /** Swatch color; omit for a label-only row. */
  color?: string;
  /** Optional trailing note (e.g. % of total). */
  note?: string;
}

/** Payload entry shape recharts injects into custom tooltip content. */
export interface ChartTooltipPayloadItem {
  name?: string;
  dataKey?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

/**
 * The one tooltip used by all charts: white card, slate border, soft shadow,
 * 11px bold labels. Two usage modes:
 *  - As recharts `<Tooltip content={<ChartTooltip />} />` — renders `payload`.
 *  - Directly with `rows` (e.g. inside custom compositions).
 */
export function ChartTooltip({
  active,
  payload,
  label,
  rows,
  formatter,
  title,
}: {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string | number;
  /** Explicit rows override payload rendering. */
  rows?: TooltipRow[];
  /** Per-row value formatter: (value, name) → string. */
  formatter?: (value: number | string, name?: string) => string;
  /** Explicit title override; defaults to the axis label. */
  title?: string;
}) {
  if (!active) return null;

  const resolvedRows: TooltipRow[] =
    rows ??
    (payload ?? [])
      .filter((p) => p.value !== undefined && p.value !== null)
      .map((p) => ({
        label: String(p.name ?? p.dataKey ?? ''),
        value: formatter ? formatter(p.value!, p.name) : String(p.value),
        color: p.color,
      }));

  if (resolvedRows.length === 0) return null;

  return (
    <div className="rounded-none border border-slate-200 bg-white px-3 py-2 shadow-[0_8px_30px_rgba(15,23,42,0.12)]">
      {(title ?? (label !== undefined && label !== '')) && (
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 truncate max-w-52">
          {title ?? label}
        </p>
      )}
      <div className="space-y-0.5">
        {resolvedRows.map((row, i) => (
          <div key={`${row.label}-${i}`} className="flex items-center gap-2 whitespace-nowrap">
            {row.color && <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />}
            <span className="text-[11px] font-semibold text-slate-500">{row.label}</span>
            <span className="flex-1" />
            <span className="text-[11px] font-bold text-slate-900">{row.value}</span>
            {row.note && <span className="text-[10px] font-semibold text-slate-400">{row.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Recharts <Tooltip> pre-wired to ChartTooltip. */
export function KitTooltip(props: {
  formatter?: (value: number | string, name?: string) => string;
  cursor?: boolean | { fill?: string; stroke?: string };
}) {
  return (
    <Tooltip
      cursor={props.cursor ?? { fill: 'rgba(11,59,36,0.04)' }}
      content={<ChartTooltip formatter={props.formatter} />}
    />
  );
}

// ── Donut with center KPI ──────────────────────────────────────────────────

/** One slice of a DonutStat. */
export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/**
 * Clean donut with a center KPI and an aligned legend list (value + optional
 * share) to the right. Replaces the Chart.js Doughnut + manual legend used on
 * the developer/authority dashboards.
 */
export function DonutStat({
  slices,
  centerLabel,
  centerValue,
  size = 160,
  className,
}: {
  slices: DonutSlice[];
  /** Small caption under the center value (e.g. "projects"). */
  centerLabel: string;
  /** Center KPI (e.g. total count or value). */
  centerValue: string | number;
  /** Outer box size in px (donut fills ~92% of it). */
  size?: number;
  className?: string;
}) {
  const total = slices.reduce((s, d) => s + d.value, 0);

  return (
    <div className={cn('flex items-center gap-6', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="68%"
              outerRadius="92%"
              paddingAngle={slices.length > 1 ? 2 : 0}
              strokeWidth={0}
              isAnimationActive
            >
              {slices.map((s) => (
                <Cell key={s.label} fill={s.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center KPI */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-black text-slate-900 leading-none">{centerValue}</span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{centerLabel}</span>
        </div>
      </div>

      {/* Legend */}
      {slices.length > 0 && (
        <div className="flex-1 min-w-0 space-y-2">
          {slices.map((s) => (
            <div key={s.label} className="flex items-center gap-2.5 min-w-0">
              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-xs font-medium text-slate-700 flex-1 truncate">{s.label}</span>
              <span className="text-xs font-bold text-slate-900 tabular-nums">{s.value}</span>
              {total > 0 && (
                <span className="text-[10px] font-semibold text-slate-400 w-8 text-right tabular-nums">
                  {Math.round((s.value / total) * 100)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
