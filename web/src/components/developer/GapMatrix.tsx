'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { getRoleLabel } from '@/lib/role-labels';
import { useRouter } from 'next/navigation';
import type {
  GapAnalysisResult,
  GapItem,
  PartnerRecommendation,
} from '@/types';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/* ─── Props ────────────────────────────────────────────────────────────────── */

export interface GapMatrixProps {
  result: GapAnalysisResult;
  projectId: string;
  loading?: boolean;
  className?: string;
  /** Called when a "Find Partner" action is triggered. */
  onFindPartner?: (recommendation: PartnerRecommendation) => void;
}

/* ─── Severity config ──────────────────────────────────────────────────────── */

const SEVERITY_STYLES: Record<string, { badge: string; icon: string; border: string; bg: string }> = {
  critical: {
    badge: 'bg-red-50 text-red-700 border-red-200',
    icon: 'text-red-500',
    border: 'border-red-100',
    bg: 'bg-red-50/30',
  },
  high: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: 'text-amber-500',
    border: 'border-amber-100',
    bg: 'bg-amber-50/30',
  },
  medium: {
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: 'text-blue-500',
    border: 'border-blue-100',
    bg: 'bg-blue-50/30',
  },
  low: {
    badge: 'bg-slate-50 text-slate-600 border-slate-200',
    icon: 'text-slate-400',
    border: 'border-slate-100',
    bg: 'bg-slate-50/30',
  },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  missing: <Icons.alert className="size-4" />,
  partial: <Icons.clock className="size-4" />,
  complete: <Icons.checkCircle2 className="size-4 text-emerald-500" />,
};

/* ─── Circular Progress ────────────────────────────────────────────────────── */

function ProgressRing({ percentage, size = 80 }: { percentage: number; size?: number }) {
  const stroke = size * 0.08;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 80 ? '#10b981' : percentage >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke="#e2e8f0" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out" />
    </svg>
  );
}

/* ─── Status Dot ───────────────────────────────────────────────────────────── */

function StatusDot({ status }: { status: GapItem['status'] }) {
  return (
    <span className={cn(
      'size-2 rounded-full shrink-0',
      status === 'complete' && 'bg-emerald-500',
      status === 'partial' && 'bg-amber-400',
      status === 'missing' && 'bg-red-400',
    )} />
  );
}

/* ─── Gap Card ─────────────────────────────────────────────────────────────── */

function GapCard({
  gap,
  onFindPartner,
}: {
  gap: GapItem;
  onFindPartner?: (rec: PartnerRecommendation) => void;
}) {
  const style = SEVERITY_STYLES[gap.severity] ?? SEVERITY_STYLES.low;
  const isDone = gap.status === 'complete';

  return (
    <div className={cn(
      'p-4 rounded-none border transition-all',
      isDone ? 'bg-white border-slate-100 opacity-70' : 'bg-white border-slate-100 hover:shadow-md hover:border-slate-200',
    )}>
      <div className="flex items-start gap-3.5">
        {/* Status icon */}
        <div className={cn(
          'size-9 rounded-none flex items-center justify-center shrink-0',
          isDone ? 'bg-emerald-50' : `${style.bg} border ${style.border}`,
        )}>
          {STATUS_ICONS[gap.status] ?? <Icons.info className="size-4 text-slate-400" />}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className={cn(
                'text-sm font-bold truncate',
                isDone ? 'text-slate-400 line-through' : 'text-slate-900',
              )}>
                {gap.label}
              </h4>
            </div>
            <span className={cn(
              'px-2 py-0.5 rounded-full text-[9px] font-bold border whitespace-nowrap shrink-0',
              style.badge,
            )}>
              {gap.severity}
            </span>
          </div>

          {/* Description */}
          <p className={cn(
            'text-xs leading-relaxed',
            isDone ? 'text-slate-400' : 'text-slate-500',
          )}>
            {gap.detail}
          </p>

          {/* Partner recommendation + action */}
          {!isDone && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                <Icons.users className="size-3.5 text-primary" />
                <span>Recommended:</span>
                <span className="text-primary">{gap.recommendation.partnerType}</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400 font-medium">
                  {getRoleLabel(
                    gap.recommendation.counterpartyType === 'CAPITAL'
                      ? 'CAPITAL_PARTNER'
                      : 'TECHNICAL_PARTNER'
                  )}
                </span>
              </div>
              {onFindPartner && gap.actionLabel && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 rounded-none text-[10px] font-bold border-primary/20 text-primary hover:bg-primary/5"
                  onClick={() => onFindPartner(gap.recommendation)}
                >
                  {gap.actionLabel}
                </Button>
              )}
            </div>
          )}

          {/* Complete state */}
          {isDone && (
            <p className="text-[11px] font-medium text-emerald-600 flex items-center gap-1.5">
              <Icons.check className="size-3" />
              Complete
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Category Section ─────────────────────────────────────────────────────── */

function CategorySection({
  name,
  gaps,
  onFindPartner,
}: {
  name: string;
  gaps: GapItem[];
  onFindPartner?: (rec: PartnerRecommendation) => void;
}) {
  const done = gaps.filter(g => g.status === 'complete').length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {name}
        </h3>
        <span className="text-[10px] font-bold text-slate-400">
          {done}/{gaps.length}
        </span>
      </div>
      <div className="space-y-2">
        {gaps.map(gap => (
          <GapCard key={gap.id} gap={gap} onFindPartner={onFindPartner} />
        ))}
      </div>
    </div>
  );
}

/* ─── Skeleton ─────────────────────────────────────────────────────────────── */

function GapMatrixSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Progress ring */}
      <div className="flex justify-center mb-8">
        <div className="size-20 bg-slate-100" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="h-3 w-24 bg-slate-100" />
          <div className="h-24 bg-slate-50" />
        </div>
      ))}
    </div>
  );
}

/* ─── Empty / No gaps ──────────────────────────────────────────────────────── */

function AllGapsFilled({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <EmptyState
      icon="checkCircle2"
      title="All Gaps Addressed"
      description="Your project has all required elements. No gaps detected — ready for partner matching."
      actionLabel="Refresh Analysis"
      onAction={onRefresh}
    />
  );
}

/* ─── Main Component ───────────────────────────────────────────────────────── */

export function GapMatrix({
  result,
  projectId,
  loading = false,
  className,
  onFindPartner,
}: GapMatrixProps) {
  const router = useRouter();

  // Group gaps by category, preserving the original order
  const grouped = useMemo(() => {
    const map = new Map<string, GapItem[]>();
    for (const gap of result.gaps) {
      const group = map.get(gap.category) ?? [];
      group.push(gap);
      map.set(gap.category, group);
    }
    return Array.from(map.entries());
  }, [result.gaps]);

  // Default find-partner handler: route to the find-partners tab
  const handleFindPartner = (rec: PartnerRecommendation) => {
    if (onFindPartner) {
      onFindPartner(rec);
      return;
    }
    router.push(`/developer/find-partners?project=${encodeURIComponent(result.projectId)}`);
  };

  if (loading) return <GapMatrixSkeleton />;

  if (result.gaps.length === 0) {
    return <AllGapsFilled />;
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header — requirement coverage, NOT the readiness score */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 p-6 rounded-none bg-white border border-slate-100 shadow-soft">
        <div className="relative flex items-center justify-center shrink-0">
          <ProgressRing percentage={result.overallReadiness} size={80} />
          <span className="absolute text-lg font-extrabold text-slate-900">
            {result.overallReadiness}%
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Documentation Completeness
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            How many of the required items are in place. This is not your readiness score — readiness is scored from document evidence after review.
          </p>
          <p className="text-sm text-slate-500 leading-relaxed mt-2">
            {result.summary}
          </p>
        </div>
      </div>

      {/* Category breakdown chips */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(result.categoryBreakdown).map(([category, counts]) => (
          <div key={category} className="flex items-center gap-2 px-3 py-1.5 rounded-none bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{category}</span>
            <span className="text-[10px] font-bold text-slate-400">
              {counts.complete}/{counts.total}
            </span>
            <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  counts.complete === counts.total ? 'bg-emerald-500' : 'bg-amber-400',
                )}
                style={{ width: `${(counts.complete / counts.total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Gap cards by category */}
      <div className="space-y-6">
        {grouped.map(([category, categoryGaps]) => (
          <CategorySection
            key={category}
            name={category}
            gaps={categoryGaps}
            onFindPartner={handleFindPartner}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-1 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
          <StatusDot status="missing" /> Missing
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
          <StatusDot status="partial" /> Partial
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
          <StatusDot status="complete" /> Complete
        </div>
        <span className="text-slate-200">·</span>
        <span className="text-[10px] font-medium text-slate-400">
          Compatible partners recommended for each gap
        </span>
      </div>
    </div>
  );
}
