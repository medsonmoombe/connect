'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/ui/icons';

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface MatchData {
  id: string;
  project_id: string;
  capital_partner_id: string;
  compatibility_score: number;
  score_breakdown?: Record<string, any>;
}

interface CapitalMatchingSectionProps {
  matches: MatchData[];
  className?: string;
}

/* ─── Dimension config — maps breakdown keys to UI config ────────────────── */

const DIMENSION_CONFIG: Record<string, { label: string; icon: React.ReactNode; weight: string; color: string }> = {
  capital_range_overlap: {
    label: 'Capital Range',
    icon: <Icons.dollarSign className="size-3.5" />,
    weight: '30%',
    color: 'bg-blue-500',
  },
  structure_compatibility: {
    label: 'Structure Fit',
    icon: <Icons.zap className="size-3.5" />,
    weight: '20%',
    color: 'bg-indigo-500',
  },
  risk_tolerance_alignment: {
    label: 'Risk Alignment',
    icon: <Icons.alertTriangle className="size-3.5" />,
    weight: '15%',
    color: 'bg-amber-500',
  },
  governance_preference_alignment: {
    label: 'Governance Fit',
    icon: <Icons.shield className="size-3.5" />,
    weight: '15%',
    color: 'bg-violet-500',
  },
  sector_match: {
    label: 'Sector Match',
    icon: <Icons.zap className="size-3.5" />,
    weight: '10%',
    color: 'bg-emerald-500',
  },
  geographic_match: {
    label: 'Geography',
    icon: <Icons.mapPin className="size-3.5" />,
    weight: '10%',
    color: 'bg-cyan-500',
  },
};

/* ─── Sub-components ──────────────────────────────────────────────────────── */

/** Single dimension bar showing average score across all matches. */
function DimensionBar({
  label,
  icon,
  weight,
  avgScore,
  color,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  weight: string;
  avgScore: number;
  color: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const pct = Math.min(100, Math.max(0, avgScore));
  return (
    <div
      className={cn(
        'flex items-center gap-3 group transition-all',
        onClick && 'cursor-pointer hover:bg-slate-50/50 rounded-none -mx-1 px-1 py-0.5',
        active && 'bg-primary/[0.04] rounded-none -mx-1 px-1 py-0.5 ring-1 ring-primary/20',
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="size-8 rounded-none bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0 group-hover:scale-105 transition-transform">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-semibold text-slate-700 truncate">{label}</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0">{weight}</span>
          </div>
          <span className="text-xs font-bold text-slate-900 shrink-0 ml-2">{Math.round(avgScore)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', color)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** Score distribution histogram bar. */
function DistributionBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className={cn('size-2.5 rounded-full shrink-0', color)} />
      <span className="text-[11px] font-medium text-slate-600 flex-1">{label}</span>
      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-800 w-8 text-right">{count}</span>
    </div>
  );
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export function CapitalMatchingSection({
  matches,
  className,
  onFilterChange,
  activeFilter,
}: CapitalMatchingSectionProps & {
  /** Callback when user clicks a dimension to filter by. dimensionKey or null to clear. */
  onFilterChange?: (dimensionKey: string | null) => void;
  /** Currently active filter dimension, if any. */
  activeFilter?: string | null;
}) {
  // Compute average scores per dimension
  const dimensionAverages = useMemo(() => {
    if (!matches.length) return null;
    const dims = Object.keys(DIMENSION_CONFIG);
    const avgs: Record<string, number> = {};
    for (const dim of dims) {
      let sum = 0;
      let count = 0;
      for (const m of matches) {
        const val = m.score_breakdown?.[dim];
        if (typeof val === 'number') {
          sum += val;
          count++;
        }
      }
      avgs[dim] = count > 0 ? sum / count : 0;
    }
    return avgs;
  }, [matches]);

  const avgOverall = useMemo(() => {
    if (!matches.length) return 0;
    return Math.round(matches.reduce((s, m) => s + m.compatibility_score, 0) / matches.length);
  }, [matches]);

  const distribution = useMemo(() => ({
    high: matches.filter(m => m.compatibility_score >= 75).length,
    medium: matches.filter(m => m.compatibility_score >= 50 && m.compatibility_score < 75).length,
    low: matches.filter(m => m.compatibility_score < 50).length,
  }), [matches]);

  if (!matches.length) return null;

  return (
    <div className={cn('space-y-6', className)}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-none bg-primary/10 flex items-center justify-center text-primary">
            <Icons.pieChart className="size-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Matching Breakdown</h3>
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {matches.length} matches
        </span>
      </div>

      {/* ── Overall score ring ──────────────────────────────────────── */}
      <div className="flex items-center gap-6 p-5 rounded-none bg-white border border-slate-100 shadow-soft">
        <div className="relative flex items-center justify-center shrink-0">
          <svg className="size-16 -rotate-90" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="24" fill="none" stroke="#e2e8f0" strokeWidth="5" />
            <circle
              cx="30" cy="30" r="24" fill="none"
              stroke={avgOverall >= 75 ? '#10b981' : avgOverall >= 50 ? '#f59e0b' : '#94a3b8'}
              strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${(avgOverall / 100) * 150.8} 150.8`}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <span className="absolute text-sm font-extrabold text-slate-900">{avgOverall}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-900">Average Match Score</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {avgOverall >= 75 ? 'Strong alignment across criteria'
              : avgOverall >= 50 ? 'Moderate alignment — review gaps'
              : 'Low alignment — update investment criteria'}
          </p>
        </div>
      </div>

      {/* ── Dimension breakdown bars ────────────────────────────────── */}
      <div className="p-5 rounded-none bg-white border border-slate-100 shadow-soft space-y-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Criteria Breakdown
        </p>
        <div className="space-y-3">
          {Object.entries(DIMENSION_CONFIG).map(([key, cfg]) => {
            const avg = dimensionAverages?.[key] ?? 0;
            const isActive = activeFilter === key;
            return (
              <DimensionBar
                key={key}
                label={cfg.label}
                icon={cfg.icon}
                weight={cfg.weight}
                avgScore={avg}
                color={cfg.color}
                active={isActive}
                onClick={onFilterChange ? () => onFilterChange(isActive ? null : key) : undefined}
              />
            );
          })}
        </div>
        {activeFilter && onFilterChange && (
          <button
            onClick={() => onFilterChange(null)}
            className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest mt-2 inline-block"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* ── Score distribution ──────────────────────────────────────── */}
      <div className="p-5 rounded-none bg-white border border-slate-100 shadow-soft space-y-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Score Distribution
        </p>
        <div className="space-y-2">
          <DistributionBar label="High (≥75%)" count={distribution.high} total={matches.length} color="bg-green-500" />
          <DistributionBar label="Medium (50–74%)" count={distribution.medium} total={matches.length} color="bg-amber-400" />
          <DistributionBar label="Low (&lt;50%)" count={distribution.low} total={matches.length} color="bg-slate-300" />
        </div>
      </div>
    </div>
  );
}
