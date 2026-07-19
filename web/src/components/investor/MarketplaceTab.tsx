'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Icons, Check, Send, Bookmark, Eye } from '@/components/ui/icons';
import { KpiBarSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { engagementService } from '@/lib/engagement';
import { Project, Engagement } from '@/types';

interface MatchMap {
  [projectId: string]: number; // project_id -> compatibility_score
}

interface MarketplaceTabProps {
  projects: Project[];
  matchScores: MatchMap;
  engagements: Engagement[];
  loading: boolean;
  onRefresh: () => void;
  capitalPartnerId: string | null;
  bookmarkedIds?: Set<string>;
  onBookmarkToggle?: (projectId: string, bookmarked: boolean) => void;
}

export function MarketplaceTab({ projects, matchScores, engagements, loading, onRefresh, capitalPartnerId, bookmarkedIds = new Set(), onBookmarkToggle }: MarketplaceTabProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
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

  const sectors = useMemo(() => {
    const set = new Set(projects.map(p => p.technology_type).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [projects]);

  const stages = useMemo(() => {
    const set = new Set(projects.map(p => p.project_stage).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [projects]);

  // Only show projects that have a match score for this investor, sorted by score
  const matchedProjects = useMemo(
    () => projects.filter(p => matchScores[p.id] !== undefined),
    [projects, matchScores]
  );

  const filtered = useMemo(() => {
    let result = matchedProjects;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.location_country?.toLowerCase().includes(q) ||
        p.technology_type?.toLowerCase().includes(q)
      );
    }
    if (sectorFilter !== 'ALL') result = result.filter(p => p.technology_type === sectorFilter);
    if (stageFilter !== 'ALL') result = result.filter(p => p.project_stage === stageFilter);
    return [...result].sort((a, b) => (matchScores[b.id] ?? 0) - (matchScores[a.id] ?? 0));
  }, [matchedProjects, search, sectorFilter, stageFilter, matchScores]);

  const handleExpressInterest = async (project: Project) => {
    if (!capitalPartnerId) return;
    if (engagedProjectIds.has(project.id)) return;
    setSendingId(project.id);
    try {
      const eng = await engagementService.requestIntroduction(project.id, capitalPartnerId, 'CAPITAL');
      setSentIds(prev => new Set(prev).add(project.id));
      if (eng?.id) router.push(`/dashboard/engagements/${eng.id}`);
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

  if (loading) return <KpiBarSkeleton />;

  return (
    <div className="space-y-6">
      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, location, or technology..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {sectors.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Sectors' : s}</option>)}
        </select>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {stages.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Stages' : s.replace('_', ' ')}</option>)}
        </select>
        {(search || sectorFilter !== 'ALL' || stageFilter !== 'ALL') && (
          <button onClick={() => { setSearch(''); setSectorFilter('ALL'); setStageFilter('ALL'); }} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest whitespace-nowrap px-2">
            Clear
          </button>
        )}
      </div>

      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">{filtered.length} matched projects</p>

      {filtered.length > 0 ? (
  <div className="grid md:grid-cols-2 gap-4">
  {filtered.map(project => {
    const score = matchScores[project.id];
    const isSent = sentIds.has(project.id);
    const isSending = sendingId === project.id;
    const isAlreadyEngaged = engagedProjectIds.has(project.id);
    const existingEngagement = engagedEngagementMap[project.id];
    const builderName = (project as any).builder_partner_name;

    return (
      <div
        key={project.id}
        className="p-5 rounded-3xl bg-surface border border-gray-100 shadow-soft hover:shadow-xl transition-all group min-w-0"
      >
        {/* Header */}
        <div className="flex justify-between items-start gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 min-w-0">
              <Link
                href={`/projects/${project.id}`}
                className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors truncate"
              >
                {project.name}
              </Link>
            </div>
            {builderName && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase rounded border border-blue-100 max-w-full truncate mb-1">
                <Icons.hardHat className="size-2.5 shrink-0" />
                <span className="truncate">Builder: {builderName}</span>
              </span>
            )}
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <Icons.mapPin className="size-3 shrink-0" />
              <span className="truncate">{project.location_country}</span>
            </div>
          </div>

          {score !== undefined && (
            <div
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-black border shrink-0",
                score >= 75
                  ? "bg-green-50 text-green-700 border-green-100"
                  : score >= 50
                  ? "bg-amber-50 text-amber-700 border-amber-100"
                  : "bg-slate-50 text-slate-500 border-slate-100"
              )}
            >
              {score}%
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-5 py-4 border-y border-gray-50">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
              Capital Req.
            </p>
            <p className="text-sm font-bold text-slate-900 truncate">
              ${(project.capital_required / 1_000_000).toFixed(1)}M
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
              Readiness
            </p>
            <p className="text-sm font-bold text-primary truncate">
              {(project as any).scores?.capital_readiness_score || 0}%
            </p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className="px-2 py-1 rounded-lg bg-background text-[9px] font-bold text-slate-500 uppercase tracking-wider truncate max-w-full">
            {project.technology_type}
          </span>
          <span className="px-2 py-1 rounded-lg bg-background text-[9px] font-bold text-slate-500 uppercase tracking-wider truncate max-w-full">
            {project.project_stage?.replace('_', ' ')}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="size-8 rounded-lg p-0 border-slate-200 shrink-0"
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

          <Link href={`/projects/${project.id}`} className="flex-1 min-w-0">
            <Button variant="outline" className="w-full h-8 rounded-lg text-[11px] font-bold">
              Details
            </Button>
          </Link>

          <Button
            onClick={() => !isAlreadyEngaged && handleExpressInterest(project)}
            disabled={isAlreadyEngaged || isSent || isSending}
            className={cn(
              "flex-1 min-w-0 h-8 px-2 rounded-lg text-[11px] font-bold transition-all",
              isAlreadyEngaged
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-50 cursor-default"
                : isSent
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100 cursor-default"
                : "bg-slate-900 text-white hover:bg-slate-800"
            )}
            title={isAlreadyEngaged ? `Engagement exists (${existingEngagement?.status})` : undefined}
          >
            {isSending ? (
              <Icons.spinner className="size-3.5 animate-spin" />
            ) : isAlreadyEngaged ? (
              <span className="flex items-center justify-center gap-1"><Check className="size-3.5" /> Expressed</span>
            ) : isSent ? (
              <span className="flex items-center justify-center gap-1"><Check className="size-3.5" /> Sent</span>
            ) : (
              <span className="flex items-center justify-center gap-1"><Send className="size-3.5" /> Interest</span>
            )}
          </Button>
        </div>
      </div>
    );
  })}
</div>
      ) : (
        <EmptyState
          icon="search"
          title="No Matched Projects"
          description={search || sectorFilter !== 'ALL' || stageFilter !== 'ALL' ? "No matched projects fit your current filters." : "No projects have been matched to your profile yet. Run the matching engine from your dashboard."}
          actionLabel={search || sectorFilter !== 'ALL' || stageFilter !== 'ALL' ? "Clear Filters" : "Refresh"}
          onAction={() => { setSearch(''); setSectorFilter('ALL'); setStageFilter('ALL'); onRefresh(); }}
        />
      )}
    </div>
  );
}
