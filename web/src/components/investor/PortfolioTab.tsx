'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/empty-state';
import { Engagement, EngagementStatus } from '@/types';
import { getStateLabel, getStateProgress, STATE_TRANSITIONS } from '@/lib/engagement';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';

interface PortfolioTabProps {
  engagements: Engagement[];
  loading: boolean;
  onExplore: () => void;
  onStatusChange?: (engagementId: string, newStatus: EngagementStatus) => void;
}

const PIPELINE_STAGES = [
  'INTRO_SENT', 'INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE',
  'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED',
] as const;

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  INTRO_SENT:        { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100' },
  INTRO_ACCEPTED:    { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-100' },
  NDA_SIGNED:        { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-100' },
  DUE_DILIGENCE:     { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100' },
  TERM_SHEET:        { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-100' },
  CONTRACT_SIGNED:   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  CAPITAL_COMMITTED: { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-100' },
  CLOSED:            { bg: 'bg-green-100',  text: 'text-green-800',   border: 'border-green-200' },
  DROPPED:           { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-100' },
};

export function PortfolioTab({ engagements, loading, onExplore, onStatusChange }: PortfolioTabProps) {
  const [view, setView] = useState<'funnel' | 'kanban'>('funnel');

  if (loading) {
    return (
      <div className="py-6 text-center bg-white rounded-none border border-gray-100">
        <Icons.spinner className="size-5 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  if (!engagements.length) {
    return (
      <EmptyState
        icon="briefcase"
        title="No Active Engagements"
        description="You haven't expressed interest in any projects yet. Start by exploring the marketplace."
        actionLabel="Explore Marketplace"
        onAction={onExplore}
      />
    );
  }

  const active  = engagements.filter(e => e.status !== 'DROPPED' && e.status !== 'CLOSED');
  const closed  = engagements.filter(e => e.status === 'CLOSED');
  const dropped = engagements.filter(e => e.status === 'DROPPED');

  const funnelCounts = PIPELINE_STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = engagements.filter(e => e.status === s).length;
    return acc;
  }, {});

  const handleKanbanStatusChange = async (engagementId: string, newStatus: EngagementStatus) => {
    await apiClient.patch(`/engagements/${engagementId}`, { status: newStatus });
    onStatusChange?.(engagementId, newStatus);
  };

  return (
    <div className="space-y-8">

      {/* Pipeline Funnel */}
      <div className="bg-white rounded-none border border-gray-100 shadow-soft p-5">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deal Pipeline</p>
          <div className="flex gap-1 bg-slate-100 rounded-none p-0.5">
            {(['funnel', 'kanban'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1 rounded-none text-[11px] font-bold transition-colors',
                  view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {v === 'funnel' ? 'Funnel' : 'Kanban'}
              </button>
            ))}
          </div>
        </div>

        {view === 'funnel' ? (
          <>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
              {PIPELINE_STAGES.map(stage => {
                const count = funnelCounts[stage] ?? 0;
                const c = STATUS_COLORS[stage];
                return (
                  <div key={stage} className={cn('rounded-none p-3 text-center border', c.bg, c.border)}>
                    <p className={cn('text-base font-extrabold', c.text)}>{count}</p>
                    <p className={cn('text-[8px] font-bold uppercase tracking-wider mt-0.5 leading-tight', c.text)}>
                      {getStateLabel(stage as any)}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-50">
              {[
                { label: 'Total',   value: engagements.length, color: 'text-slate-900' },
                { label: 'Active',  value: active.length,      color: 'text-primary' },
                { label: 'Closed',  value: closed.length,      color: 'text-green-600' },
                { label: 'Dropped', value: dropped.length,     color: 'text-red-500' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <p className={cn('text-lg font-black', color)}>{value}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <KanbanBoard engagements={engagements} onStatusChange={handleKanbanStatusChange} />
        )}
      </div>

      {active.length > 0 && view === 'funnel' && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{active.length} active</p>
          {active.map(eng => <EngagementRow key={eng.id} eng={eng} />)}
        </div>
      )}

      {closed.length > 0 && view === 'funnel' && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-green-600 uppercase tracking-widest px-1">{closed.length} closed</p>
          {closed.map(eng => <EngagementRow key={eng.id} eng={eng} />)}
        </div>
      )}

      {dropped.length > 0 && view === 'funnel' && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-red-500 uppercase tracking-widest px-1">{dropped.length} dropped</p>
          {dropped.map(eng => <EngagementRow key={eng.id} eng={eng} />)}
        </div>
      )}
    </div>
  );
}

function EngagementRow({ eng }: { eng: Engagement }) {
  const progress = getStateProgress(eng.status as any);
  const c = STATUS_COLORS[eng.status] ?? STATUS_COLORS.INTRO_SENT;
  const isActive = eng.status !== 'DROPPED' && eng.status !== 'CLOSED';

  return (
    <Link href={`/engagements/${eng.id}`}>
      <div className="p-5 rounded-none bg-white border border-gray-100 shadow-soft hover:shadow-md transition-all cursor-pointer group">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 my-2">
          {/* Icon */}
          <div className="size-11 rounded-none bg-slate-50 flex items-center justify-center text-primary shrink-0 border border-slate-100 group-hover:bg-primary/5 transition-colors">
            <Icons.zap className="size-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors truncate">
                {eng.project?.name ?? 'Project'}
              </h4>
              <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0', c.bg, c.text, c.border)}>
                {getStateLabel(eng.status as any)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400 font-medium">
              {eng.project?.location_country && (
                <span className="truncate max-w-[140px]">{eng.project.location_country}</span>
              )}
              {eng.project?.capital_required && (
                <>
                  <span className="text-slate-200 shrink-0">·</span>
                  <span className="whitespace-nowrap">ZMW {(eng.project.capital_required / 1_000_000).toFixed(1)}M</span>
                </>
              )}
              <span className="text-slate-200 shrink-0">·</span>
              <span className="whitespace-nowrap">Updated {new Date(eng.updated_at || eng.created_at).toLocaleDateString()}</span>
            </div>

            {isActive && (
              <div className="mt-2.5 w-full max-w-xs">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {progress}% through deal flow
                </p>
              </div>
            )}
          </div>

          {/* Action */}
          <Button
            variant="outline"
            className="w-full sm:w-auto rounded-none border-gray-200 shrink-0 group-hover:border-primary/30 transition-colors text-xs font-bold h-9 px-4"
          >
            Open Room
          </Button>
        </div>
      </div>
    </Link>
  );
}
