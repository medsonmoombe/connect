'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Icons, MapPin, DollarSign, Check, Send, ChevronDown, Bookmark } from '@/components/ui/icons';
import { StatCard } from '@/components/ui/stat-card';
import { KpiBarSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { engagementService } from '@/lib/engagement';
import { Project, Engagement } from '@/types';
import { MatchBreakdownPanel } from '@/components/ui/MatchBreakdownPanel';

interface MatchScore {
  id: string;
  project_id: string;
  capital_partner_id: string;
  compatibility_score: number;
  score_breakdown?: Record<string, any>;
  project?: Project;
}

interface MyMatchesTabProps {
  matches: MatchScore[];
  engagements: Engagement[];
  loading: boolean;
  onRefresh: () => void;
  bookmarkedIds?: Set<string>;
  onBookmarkToggle?: (projectId: string, bookmarked: boolean) => void;
}

export function MyMatchesTab({ matches, engagements, loading, onRefresh, bookmarkedIds = new Set(), onBookmarkToggle }: MyMatchesTabProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'score' | 'capital'>('score');
  const [bookmarkingId, setBookmarkingId] = useState<string | null>(null);

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


  const avgScore = useMemo(() => {
    if (!matches.length) return 0;
    return Math.round(matches.reduce((sum, m) => sum + m.compatibility_score, 0) / matches.length);
  }, [matches]);

  const highPotential = useMemo(() => matches.filter(m => m.compatibility_score >= 75).length, [matches]);

  const sorted = useMemo(() => {
    const copy = [...matches];
    if (sortBy === 'score') copy.sort((a, b) => b.compatibility_score - a.compatibility_score);
    else copy.sort((a, b) => ((b.project as any)?.capital_required ?? 0) - ((a.project as any)?.capital_required ?? 0));
    return copy;
  }, [matches, sortBy]);

  const handleExpressInterest = async (match: MatchScore) => {
    if (engagedProjectIds.has(match.project_id)) return;
    setSendingId(match.project_id);
    try {
      const eng = await engagementService.requestIntroduction(match.project_id, match.capital_partner_id || '', 'CAPITAL');
      setSentIds(prev => new Set(prev).add(match.project_id));
      if (eng?.id) router.push(`/engagements/${eng.id}`);
    } catch (err) {
      console.error('Express interest failed:', err);
    } finally {
      setSendingId(null);
    }
  };

  const handleBookmark = async (projectId: string) => {
    setBookmarkingId(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}/bookmark`, { method: 'POST' });
      const { bookmarked } = await res.json();
      onBookmarkToggle?.(projectId, bookmarked);
      toast.success(bookmarked ? 'Project saved' : 'Bookmark removed');
    } catch (err) {
      console.error('Bookmark failed:', err);
      toast.error('Failed to update bookmark');
    } finally {
      setBookmarkingId(null);
    }
  };

  if (loading) {
    return <KpiBarSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Matches" value={matches.length} icon={Icons.search} iconClassName="text-primary" />
        <StatCard label="Avg Score" value={`${avgScore}%`} icon={Icons.zap} iconClassName="text-amber-500" />
        <StatCard label="High Potential" value={highPotential} icon={Icons.check} iconClassName="text-green-500" valueClassName="text-green-600" />
      </div>

      {/* Sort Controls */}
      {matches.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{matches.length} matched projects</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sort:</span>
            <button
              onClick={() => setSortBy('score')}
              className={cn("px-3 py-1 rounded-none text-[10px] font-bold uppercase tracking-widest transition-all", sortBy === 'score' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
            >
              By Score
            </button>
            <button
              onClick={() => setSortBy('capital')}
              className={cn("px-3 py-1 rounded-none text-[10px] font-bold uppercase tracking-widest transition-all", sortBy === 'capital' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
            >
              By Capital
            </button>
          </div>
        </div>
      )}

      {/* Match Cards */}
      {sorted.length > 0 ? (
  <div className="space-y-3">
  {sorted.map((match) => {
    const project = match.project as any;
    if (!project) return null;
    const isExpanded = expandedId === match.project_id;
    const isSent = sentIds.has(match.project_id);
    const isSending = sendingId === match.project_id;
    const isAlreadyEngaged = engagedProjectIds.has(match.project_id);
    const existingEngagement = engagedEngagementMap[match.project_id];
    const breakdown = match.score_breakdown as Record<string, number> | undefined;

    return (
      <div
        key={match.id || match.project_id}
        className="rounded-none bg-white border border-gray-100 shadow-soft overflow-hidden hover:shadow-md transition-all"
      >
        {/* Main Row */}
        <div className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-none bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
            <Icons.zap className="size-5 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 min-w-0">
              <Link
                href={`/projects/${project.id}`}
                className="text-sm font-bold text-slate-900 hover:text-primary transition-colors truncate"
              >
                {project.name}
              </Link>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0",
                  match.compatibility_score >= 75
                    ? "bg-green-50 text-green-700 border-green-100"
                    : match.compatibility_score >= 50
                    ? "bg-amber-50 text-amber-700 border-amber-100"
                    : "bg-slate-50 text-slate-500 border-slate-100"
                )}
              >
                {match.compatibility_score}%
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 overflow-hidden">
              <span className="flex items-center gap-1 shrink-0">
                <MapPin className="size-3" />
                {project.location_country}
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <DollarSign className="size-3" />
                ${(project.capital_required / 1_000_000).toFixed(1)}M
              </span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-50 text-[9px] font-bold uppercase truncate">
                {project.technology_type}
              </span>
              <span className="hidden md:inline-block px-1.5 py-0.5 rounded bg-slate-50 text-[9px] font-bold uppercase truncate">
                {project.project_stage?.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-none text-xs size-8 p-0"
              onClick={() => setExpandedId(isExpanded ? null : match.project_id)}
            >
              <ChevronDown className={cn("size-3.5 transition-transform", isExpanded && "rotate-180")} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="size-8 rounded-none p-0 border-slate-200"
              onClick={() => handleBookmark(project.id)}
              disabled={bookmarkingId === project.id}
              title={bookmarkedIds.has(project.id) ? 'Remove bookmark' : 'Bookmark'}
            >
              {bookmarkingId === project.id ? (
                <Icons.spinner className="size-3.5 animate-spin" />
              ) : (
                <Bookmark
                  className={cn(
                    'size-3.5',
                    bookmarkedIds.has(project.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
                  )}
                />
              )}
            </Button>
            <Button
              onClick={() => !isAlreadyEngaged && handleExpressInterest(match)}
              disabled={isAlreadyEngaged || isSent || isSending}
              className={cn(
                "h-8 px-3 rounded-none text-[11px] font-bold transition-all",
                isAlreadyEngaged
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-50 cursor-default"
                  : isSent
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-50 cursor-default"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              )}
              title={isAlreadyEngaged ? `Engagement exists (${existingEngagement?.status})` : undefined}
            >
              {isSending ? (
                <Icons.spinner className="size-3.5 animate-spin" />
              ) : isAlreadyEngaged ? (
                <><Check className="size-3.5 mr-1" /> Expressed</>
              ) : isSent ? (
                <><Check className="size-3.5 mr-1" /> Sent</>
              ) : (
                <><Send className="size-3.5 mr-1" /> Interest</>
              )}
            </Button>
          </div>
        </div>

        {/* Expanded Breakdown */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-slate-100 pt-4">
            <MatchBreakdownPanel
              breakdown={breakdown}
              totalScore={match.compatibility_score}
              variant="full"
            />
            <Link href={`/projects/${project.id}`}>
              <Button variant="outline" className="w-full h-9 mt-4 rounded-none text-[11px] font-bold">
                View Project Details
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  })}
</div>
      ) : (
        <EmptyState
          icon="search"
          title="No Matches Found"
          description="No compatibility scores have been calculated for your profile yet. The matching engine runs automatically when new projects are validated."
          actionLabel="Refresh"
          onAction={onRefresh}
        />
      )}
    </div>
  );
}
