'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Icons, Send, Check, Bookmark } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { engagementService } from '@/lib/engagement';
import { ProjectBookmark, Engagement } from '@/types';

interface BookmarksTabProps {
  bookmarks: ProjectBookmark[];
  matchScores: Record<string, number>;
  engagements: Engagement[];
  loading: boolean;
  capitalPartnerId: string | null;
  onRemove: (projectId: string) => void;
  onExplore: () => void;
}

export function BookmarksTab({ bookmarks, matchScores, engagements, loading, capitalPartnerId, onRemove, onExplore }: BookmarksTabProps) {
  const router = useRouter();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [removingId, setRemovingId] = useState<string | null>(null);

  const engagedProjectIds = useMemo(
    () => new Set(engagements.map(e => e.project_id)),
    [engagements]
  );

  const engagedEngagementMap = useMemo(() => {
    const map: Record<string, Engagement> = {};
    for (const e of engagements) {
      if (!map[e.project_id]) map[e.project_id] = e;
    }
    return map;
  }, [engagements]);

  const handleExpressInterest = async (projectId: string) => {
    if (!capitalPartnerId) return;
    if (engagedProjectIds.has(projectId)) return;
    setSendingId(projectId);
    try {
      const eng = await engagementService.requestIntroduction(projectId, capitalPartnerId, 'CAPITAL');
      setSentIds(prev => new Set(prev).add(projectId));
      if (eng?.id) router.push(`/dashboard/engagements/${eng.id}`);
    } catch (err) {
      console.error('Express interest failed:', err);
    } finally {
      setSendingId(null);
    }
  };

  const handleRemoveBookmark = async (projectId: string) => {
    setRemovingId(projectId);
    try {
      await fetch(`/api/projects/${projectId}/bookmark`, { method: 'POST' });
      onRemove(projectId);
      toast.success('Bookmark removed');
    } catch (err) {
      console.error('Remove bookmark failed:', err);
      toast.error('Failed to remove bookmark');
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded-[32px] border border-gray-100">
        <Icons.spinner className="size-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  if (!bookmarks.length) {
    return (
      <EmptyState
        icon="search"
        title="No Saved Projects"
        description="Bookmark projects from the marketplace to track them here."
        actionLabel="Browse Marketplace"
        onAction={onExplore}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">{bookmarks.length} saved project{bookmarks.length !== 1 ? 's' : ''}</p>
      {bookmarks.map(bm => {
        const project = bm.project as any;
        if (!project) return null;
        const score = matchScores[project.id];
        const isSent = sentIds.has(project.id);
        const isSending = sendingId === project.id;
        const isRemoving = removingId === project.id;
        const isAlreadyEngaged = engagedProjectIds.has(project.id);
        const existingEngagement = engagedEngagementMap[project.id];

        return (
          <div key={bm.id} className="p-6 rounded-[32px] bg-white border border-gray-100 shadow-soft hover:shadow-md transition-all flex items-center gap-6 group">
            <div className="size-14 rounded-2xl bg-slate-50 flex items-center justify-center text-primary shrink-0 border border-slate-100">
              <Icons.zap className="size-7" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <Link href={`/projects/${project.id}`} className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors truncate">
                  {project.name}
                </Link>
                {score !== undefined && (
                  <span className={cn(
                    'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0',
                    score >= 75 ? 'bg-green-50 text-green-700 border-green-100' :
                    score >= 50 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                    'bg-slate-50 text-slate-500 border-slate-100'
                  )}>
                    {score}% Match
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1"><Icons.mapPin className="size-3" /> {project.location_country}</span>
                <span className="flex items-center gap-1"><Icons.dollarSign className="size-3" /> ZMW {(project.capital_required / 1_000_000).toFixed(1)}M</span>
                <span className="px-2 py-0.5 rounded bg-slate-50 text-[10px] font-bold uppercase">{project.technology_type}</span>
                <span className="px-2 py-0.5 rounded bg-slate-50 text-[10px] font-bold uppercase">{project.project_stage?.replace('_', ' ')}</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                Saved {new Date(bm.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 rounded-xl p-0 border-slate-200 hover:border-amber-300 hover:bg-amber-50"
                onClick={() => handleRemoveBookmark(project.id)}
                disabled={isRemoving}
                title="Remove bookmark"
              >
                {isRemoving
                  ? <Icons.spinner className="size-3.5 animate-spin" />
                  : <Bookmark className="size-3.5 fill-amber-400 text-amber-400" />
                }
              </Button>
              <Button
                onClick={() => handleExpressInterest(project.id)}
                disabled={isAlreadyEngaged || isSent || isSending}
                className={cn(
                  'h-9 px-5 rounded-xl text-xs font-bold transition-all',
                  isAlreadyEngaged
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-50 cursor-default'
                    : isSent
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-50 cursor-default'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                )}
                title={isAlreadyEngaged ? `Engagement exists (${existingEngagement?.status})` : undefined}
              >
                {isSending
                  ? <Icons.spinner className="size-3.5 animate-spin" />
                  : isAlreadyEngaged
                    ? <><Check className="size-3.5 mr-1" /> Expressed</>
                    : isSent
                      ? <><Check className="size-3.5 mr-1" /> Sent</>
                      : <><Send className="size-3.5 mr-1" /> Express Interest</>
                }
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
