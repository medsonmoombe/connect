'use client';

import React from 'react';
import { EngagementStatus } from '@/types';
import { getStateLabel, getStateProgress, ENGAGEMENT_STATES } from '@/lib/engagement';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

export interface EngagementStateEntry {
  id: string;
  from_status: EngagementStatus;
  to_status: EngagementStatus;
  actor_id: string | null;
  reason: string | null;
  created_at: string;
  actor?: { full_name: string | null; email: string | null } | null;
}

interface EngagementMilestonesProps {
  currentStatus: EngagementStatus;
  /** Structured transition history (from GET /api/engagements/{id}/audit). */
  history?: EngagementStateEntry[];
  className?: string;
}

export const EngagementMilestones: React.FC<EngagementMilestonesProps> = ({
  currentStatus,
  history,
  className,
}) => {
  const progress = getStateProgress(currentStatus);

  const isDropped = currentStatus === 'DROPPED';
  const visibleStates = ENGAGEMENT_STATES.filter(
    (state): state is Exclude<EngagementStatus, 'DROPPED' | 'CONTRACT_SIGNED' | 'CAPITAL_COMMITTED'> =>
      state !== 'DROPPED' && state !== 'CONTRACT_SIGNED' && state !== 'CAPITAL_COMMITTED'
  );

  const currentIndex = isDropped ? -1 : visibleStates.indexOf(currentStatus as any);

  // Map each reached milestone → the transition that ENTERED it (to_status).
  // The last transition into a given status wins (most recent actor/time).
  const entryByStatus = new Map<EngagementStatus, EngagementStateEntry>();
  for (const h of history ?? []) {
    entryByStatus.set(h.to_status, h);
  }

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString([], {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return ''; }
  };

  return (
    <div className={cn("w-full py-4", className)}>
      <div className="relative">
        {/* Progress Bar Background */}
        <div className="absolute top-4 left-0 w-full h-1 bg-slate-100 rounded-full overflow-hidden" />

        {/* Active Progress Bar */}
        {!isDropped && (
          <div
            className="absolute top-4 left-0 h-1 bg-primary rounded-full transition-all duration-500"
            style={{ width: `${Math.max(0, (currentIndex / (visibleStates.length - 1)) * 100)}%` }}
          />
        )}

        <div className="relative flex justify-between">
          {visibleStates.map((state, index) => {
            const isCompleted = !isDropped && (index < currentIndex || currentStatus === 'CLOSED');
            const isCurrent = !isDropped && index === currentIndex;
            const label = getStateLabel(state);
            const entry = entryByStatus.get(state);
            const actorName = entry?.actor?.full_name ?? (entry?.actor_id ? 'A team member' : null);
            const time = entry ? fmtTime(entry.created_at) : null;

            return (
              <div key={state} className="flex flex-col items-center group">
                <div
                  className={cn(
                    "z-10 flex items-center justify-center size-8 rounded-full border-2 bg-white transition-all",
                    isCompleted ? "border-primary bg-primary text-white" :
                    isCurrent ? "border-primary text-primary ring-4 ring-primary/10 scale-110" :
                    "border-slate-200 text-slate-300"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isCurrent ? (
                    <Clock className="w-4 h-4 animate-pulse" />
                  ) : (
                    <Circle className="w-4 h-4 fill-current opacity-20" />
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 text-[9px] font-bold uppercase tracking-widest text-center max-w-[72px] leading-tight",
                    isCurrent ? "text-primary" :
                    isCompleted ? "text-slate-700" :
                    "text-slate-400"
                  )}
                >
                  {label}
                </span>
                {actorName && time && (
                  <span className="mt-1 text-[8px] font-medium text-slate-400 text-center max-w-[84px] leading-tight">
                    {actorName}
                    <br />
                    {time}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isDropped && (
        <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-none flex items-center text-red-600">
          <Circle className="w-4 h-4 mr-2 fill-red-500" />
          <span className="text-xs font-bold">Engagement Dropped</span>
        </div>
      )}

      {!isDropped && currentStatus !== 'CLOSED' && (
        <div className="mt-6 flex justify-between items-center bg-primary/5 p-4 rounded-none border border-primary/10">
          <div>
            <p className="text-xs font-bold text-slate-900">Current Phase: {getStateLabel(currentStatus)}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Progress: {progress}% to completion</p>
          </div>
          <div className="h-1.5 w-28 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
