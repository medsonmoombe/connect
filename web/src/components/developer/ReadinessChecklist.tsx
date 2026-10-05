'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  required: boolean;
  status: 'complete' | 'partial' | 'missing';
  hint?: string;
}

export interface ReadinessChecklistProps {
  project: Project;
  /** Optional className for the outer container. */
  className?: string;
  /** Compact mode shows only the progress bar + summary. */
  compact?: boolean;
  /** Fires when user clicks a missing item's action button. */
  onItemAction?: (item: ChecklistItem) => void;
}

/* ─── Checklist builder (pure function — easy to test) ─────────────────────── */

export function buildChecklist(project: Project): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // Organisation information
  items.push({
    id: 'org_name',
    category: 'Organization',
    label: 'Company name and registration',
    required: true,
    status: project.developer?.name ? 'complete' : 'missing',
  });

  // Project identity
  items.push({
    id: 'project_name',
    category: 'Project',
    label: 'Project name',
    required: true,
    status: project.name?.length >= 3 ? 'complete' : 'missing',
  });
  items.push({
    id: 'technology',
    category: 'Project',
    label: 'Technology type (Solar, Wind, etc.)',
    required: true,
    status: project.technology_type ? 'complete' : 'missing',
  });
  items.push({
    id: 'location',
    category: 'Project',
    label: 'Location (country + region)',
    required: true,
    status: project.location_country ? (project.location_region ? 'complete' : 'partial') : 'missing',
    hint: !project.location_region ? 'Add a specific region for better matching' : undefined,
  });
  items.push({
    id: 'capacity',
    category: 'Project',
    label: 'Project capacity (MW)',
    required: true,
    status: project.project_size_mw > 0 ? 'complete' : 'missing',
  });

  // Development stage
  items.push({
    id: 'stage',
    category: 'Development Stage',
    label: 'Current project stage',
    required: true,
    status: project.project_stage ? 'complete' : 'missing',
  });

  // Financial information
  items.push({
    id: 'capital_required',
    category: 'Financial Information',
    label: 'Total capital required',
    required: true,
    status: project.capital_required > 0 ? 'complete' : 'missing',
  });
  items.push({
    id: 'capital_structure',
    category: 'Financial Information',
    label: 'Capital structure type (Equity, Grant, etc.)',
    required: true,
    status: project.capital_structure_type ? 'complete' : 'missing',
  });

  // Documentation
  const docCount = project.documents?.length ?? 0;
  items.push({
    id: 'documents',
    category: 'Documentation',
    label: 'Upload required documents',
    required: true,
    status: docCount > 0 ? 'complete' : 'missing',
    hint: docCount > 0 ? undefined : 'At least 1 document required (pitch deck, feasibility study, etc.)',
  });

  // Timeline
  items.push({
    id: 'timeline',
    category: 'Timeline',
    label: 'Target financial close date',
    required: false,
    status: project.target_financial_close_date ? 'complete' : 'missing',
    hint: 'Helps partners assess deal urgency',
  });
  items.push({
    id: 'cod',
    category: 'Timeline',
    label: 'Target commercial operation date',
    required: false,
    status: project.target_cod ? 'complete' : 'missing',
    hint: 'Helps investors plan their exit timeline',
  });

  // Required support
  items.push({
    id: 'tech_requirements',
    category: 'Required Support',
    label: 'Technical requirements (terrain, grid, budget)',
    required: false,
    status: project.tech_requirements?.terrain_complexity ? 'complete' : 'missing',
    hint: 'Set technical preferences to get better EPC matches',
  });

  // Land / regulatory
  items.push({
    id: 'land',
    category: 'Regulatory',
    label: 'Land status and approvals',
    required: false,
    status: project.has_secured_land ? 'complete' : 'missing',
    hint: 'Secured land significantly reduces project risk',
  });

  return items;
}

/* ─── Progress summary ─────────────────────────────────────────────────────── */

export function getChecklistProgress(items: ChecklistItem[]): {
  complete: number;
  total: number;
  percentage: number;
} {
  const required = items.filter(i => i.required);
  const complete = required.filter(i => i.status === 'complete').length;
  const total = required.length;
  return {
    complete,
    total,
    percentage: total > 0 ? Math.round((complete / total) * 100) : 0,
  };
}

/* ─── Status icon helper ───────────────────────────────────────────────────── */

function StatusIcon({ status }: { status: ChecklistItem['status'] }) {
  return (
    <span
      className={cn(
        'size-5 rounded-full flex items-center justify-center shrink-0 border transition-colors',
        status === 'complete' && 'bg-emerald-50 border-emerald-200 text-emerald-600',
        status === 'partial'  && 'bg-amber-50 border-amber-200 text-amber-600',
        status === 'missing'  && 'bg-slate-50 border-slate-200 text-slate-400',
      )}
    >
      {status === 'complete' ? (
        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : status === 'partial' ? (
        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
        </svg>
      ) : (
        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
        </svg>
      )}
    </span>
  );
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export function ReadinessChecklist({
  project,
  className,
  compact = false,
  onItemAction,
}: ReadinessChecklistProps) {
  const items = useMemo(() => buildChecklist(project), [project]);
  const progress = useMemo(() => getChecklistProgress(items), [items]);

  // Group by category for a clean display
  const grouped = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const item of items) {
      const group = map.get(item.category) ?? [];
      group.push(item);
      map.set(item.category, group);
    }
    return Array.from(map.entries());
  }, [items]);

  const progressColor =
    progress.percentage >= 80 ? 'bg-emerald-500' :
    progress.percentage >= 50 ? 'bg-amber-500' :
    'bg-red-400';

  // ── Compact: just a summary ring (for sidebar/dashboard widget) ────────
  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="relative size-10 shrink-0">
          <svg className="size-10 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="2"
              className="text-slate-100" />
            <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeDasharray={`${progress.percentage} ${100 - progress.percentage}`}
              strokeLinecap="round"
              className={progressColor} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-600">
            {progress.percentage}%
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900 truncate">Readiness Score</p>
          <p className="text-[10px] text-slate-400 font-medium">
            {progress.complete}/{progress.total} required items
          </p>
        </div>
      </div>
    );
  }

  // ── Full: category groups with items ───────────────────────────────────
  return (
    <div className={cn('space-y-6', className)}>
      {/* Progress bar header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
            Required Fields
          </p>
          <span className="text-xs font-bold text-slate-400">
            {progress.complete}/{progress.total}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', progressColor)}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 font-medium">
          {progress.percentage >= 80
            ? 'Great shape! Your project is well-prepared for review.'
            : progress.percentage >= 50
              ? 'Making progress — complete the missing items to improve your readiness score.'
              : 'Add the required information to get your project ready for submission.'}
        </p>
      </div>

      {/* Category groups */}
      <div className="space-y-4">
        {grouped.map(([category, categoryItems]) => (
          <div key={category}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
              {category}
            </p>
            <div className="space-y-1">
              {categoryItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-none transition-colors',
                    item.status === 'missing'
                      ? 'hover:bg-slate-50 cursor-pointer'
                      : 'opacity-80',
                  )}
                  onClick={() => {
                    if (item.status === 'missing' && onItemAction) onItemAction(item);
                  }}
                >
                  <StatusIcon status={item.status} />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-xs font-medium',
                      item.status === 'complete' ? 'text-slate-500 line-through' : 'text-slate-800',
                    )}>
                      {item.label}
                    </p>
                    {item.hint && item.status !== 'complete' && (
                      <p className="text-[10px] text-slate-400 mt-0.5">{item.hint}</p>
                    )}
                  </div>
                  {!item.required && (
                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-wider shrink-0">
                      Optional
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Summary footer */}
      <div className="pt-3 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 font-medium text-center">
          {progress.percentage === 100
            ? '✅ All required items complete. Ready for submission!'
            : `${progress.total - progress.complete} required item${progress.total - progress.complete !== 1 ? 's' : ''} remaining`}
        </p>
      </div>
    </div>
  );
}
