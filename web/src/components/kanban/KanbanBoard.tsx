'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { Engagement, EngagementStatus } from '@/types';
import { getStateLabel, getStateProgress, STATE_TRANSITIONS } from '@/lib/engagement';

interface KanbanBoardProps {
  engagements: Engagement[];
  onStatusChange?: (engagementId: string, newStatus: EngagementStatus) => Promise<void> | void;
}

const COLUMNS: EngagementStatus[] = [
  'INTRO_SENT', 'INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE',
  'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED',
];

const COLUMN_COLORS: Record<EngagementStatus, { bg: string; header: string; badge: string; border: string }> = {
  INTRO_SENT:        { bg: 'bg-blue-50/50',   header: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700',   border: 'border-blue-100' },
  INTRO_ACCEPTED:    { bg: 'bg-indigo-50/50', header: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700', border: 'border-indigo-100' },
  NDA_SIGNED:        { bg: 'bg-violet-50/50', header: 'bg-violet-500', badge: 'bg-violet-100 text-violet-700', border: 'border-violet-100' },
  DUE_DILIGENCE:     { bg: 'bg-amber-50/50',  header: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700',  border: 'border-amber-100' },
  TERM_SHEET:        { bg: 'bg-orange-50/50', header: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700', border: 'border-orange-100' },
  CONTRACT_SIGNED:   { bg: 'bg-emerald-50/50', header: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-100' },
  CAPITAL_COMMITTED: { bg: 'bg-green-50/50',  header: 'bg-green-500',  badge: 'bg-green-100 text-green-700',  border: 'border-green-100' },
  CLOSED:            { bg: 'bg-green-100/50', header: 'bg-green-600',  badge: 'bg-green-200 text-green-800',  border: 'border-green-200' },
  DROPPED:           { bg: 'bg-red-50/50',    header: 'bg-red-500',    badge: 'bg-red-100 text-red-600',      border: 'border-red-100' },
};

export function KanbanBoard({ engagements, onStatusChange }: KanbanBoardProps) {
  const [draggedEng, setDraggedEng] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, engId: string) => {
    e.dataTransfer.setData('text/plain', engId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedEng(engId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, colStatus: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colStatus);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCol(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetStatus: EngagementStatus) => {
    e.preventDefault();
    const engId = e.dataTransfer.getData('text/plain');
    const eng = engagements.find(en => en.id === engId);

    setDraggedEng(null);
    setDragOverCol(null);

    if (!eng || eng.status === targetStatus) return;

    const validNext = STATE_TRANSITIONS[eng.status as EngagementStatus] ?? [];
    if (!validNext.includes(targetStatus)) {
      toast.error(`Cannot move from ${getStateLabel(eng.status)} to ${getStateLabel(targetStatus)}`);
      return;
    }

    const engName = eng.project?.name ?? 'Engagement';
    const toastId = toast.loading(`Moving "${engName}" to ${getStateLabel(targetStatus)}…`);
    setMovingId(engId);

    try {
      await onStatusChange?.(engId, targetStatus);
      toast.success(`Moved "${engName}" to ${getStateLabel(targetStatus)}`, { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || `Failed to move "${engName}"`, { id: toastId });
    } finally {
      setMovingId(null);
    }
  }, [engagements, onStatusChange]);

  const handleDragEnd = useCallback(() => {
    setDraggedEng(null);
    setDragOverCol(null);
  }, []);

  // Group engagements by status
  const grouped = new Map<EngagementStatus, Engagement[]>();
  for (const col of COLUMNS) grouped.set(col, []);
  for (const eng of engagements) {
    const status = eng.status as EngagementStatus;
    if (grouped.has(status)) {
      grouped.get(status)!.push(eng);
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
      {COLUMNS.map(status => {
        const items = grouped.get(status) ?? [];
        const colors = COLUMN_COLORS[status];
        const isOver = dragOverCol === status;

        return (
          <div
            key={status}
            className={cn(
              'flex-shrink-0 w-64 flex flex-col rounded-sm border transition-colors',
              colors.bg,
              isOver ? 'border-primary/40 bg-primary/[0.03]' : colors.border,
            )}
            onDragOver={e => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, status)}
          >
            {/* Column header */}
            <div className={cn('px-3 py-2.5 rounded-t-sm flex items-center justify-between', colors.header)}>
              <span className="text-xs font-bold text-white tracking-wide">
                {getStateLabel(status)}
              </span>
              <span className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-black text-white">
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 min-h-[120px]">
              {items.map(eng => {
                const isDragging = draggedEng === eng.id;
                const isMoving = movingId === eng.id;
                return (
                  <div
                    key={eng.id}
                    draggable={!isMoving}
                    onDragStart={e => handleDragStart(e, eng.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'bg-white rounded-none border border-slate-100 p-3 transition-all',
                      isMoving ? 'opacity-60 cursor-wait' : 'cursor-grab active:cursor-grabbing',
                      !isMoving && 'hover:shadow-md hover:border-slate-200',
                      isDragging ? 'opacity-50 scale-95' : '',
                    )}
                  >
                    <Link href={`/engagements/${eng.id}`} className="block">
                      <h4 className="text-[13px] font-bold text-slate-900 truncate hover:text-primary transition-colors">
                        {eng.project?.name ?? 'Project'}
                      </h4>
                    </Link>

                    {eng.project?.capital_required && (
                      <p className="text-[11px] text-slate-400 font-medium mt-1">
                        ZMW {(eng.project.capital_required / 1_000_000).toFixed(1)}M
                      </p>
                    )}

                    {/* Progress bar */}
                    <div className="mt-2">
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full transition-all"
                          style={{ width: `${getStateProgress(status)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1.5">
                      {eng.updated_at && (
                        <p className="text-[9px] text-slate-300 font-bold uppercase tracking-wider">
                          {new Date(eng.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                      {isMoving && (
                        <Icons.spinner className="size-3.5 animate-spin text-primary" />
                      )}
                    </div>
                  </div>
                );
              })}

              {items.length === 0 && (
                <div className="text-center py-6 text-[11px] text-slate-300 font-medium">
                  No items
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
