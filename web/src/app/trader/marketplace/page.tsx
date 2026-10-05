'use client';

import { useEffect, useMemo, useState } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { EmptyState } from '@/components/ui/empty-state';
import { KpiBarSkeleton } from '@/components/ui/skeleton';
import { useTraderData } from '@/hooks/useTraderData';

const STAGE_FILTERS = ['ALL', 'FEASIBILITY', 'REGULATORY_APPROVAL', 'FINANCIAL_CLOSE', 'CONSTRUCTION', 'OPERATION'];

type ScoreBand = 'all' | 'high' | 'medium' | 'low' | 'unscored';

const BAND_META: Record<Exclude<ScoreBand, 'all'>, { label: string; test: (s: number | undefined) => boolean }> = {
  high: { label: 'Strong fit (≥75%)', test: (s) => s !== undefined && s >= 75 },
  medium: { label: 'Medium (50–74%)', test: (s) => s !== undefined && s >= 50 && s < 75 },
  low: { label: 'Long shot (<50%)', test: (s) => s !== undefined && s < 50 },
  unscored: { label: 'Not yet scored', test: (s) => s === undefined },
};

export default function TraderMarketplacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const data = useTraderData({ marketplace: true, matches: true, engagements: true });
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [techFilter, setTechFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const initialBand = (searchParams.get('band') as ScoreBand | null) ?? 'all';
  const [band, setBand] = useState<ScoreBand>(
    initialBand && (BAND_META as Record<string, { test: (s: number | undefined) => boolean }>)[initialBand] ? initialBand : 'all'
  );

  const scoreOf = (projectId: string) => data.matchScoreMap[projectId];

  const bandCounts = useMemo(() => {
    const counts: Record<string, number> = { all: data.marketplaceProjects.length };
    for (const key of Object.keys(BAND_META) as Array<keyof typeof BAND_META>) {
      counts[key] = data.marketplaceProjects.filter(p => BAND_META[key].test(scoreOf(p.id))).length;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.marketplaceProjects, data.matchScoreMap]);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'POWER_TRADER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  const technologies = useMemo(
    () => ['ALL', ...Array.from(new Set(data.marketplaceProjects.map(p => p.technology_type).filter(Boolean)))],
    [data.marketplaceProjects]
  );

  const filtered = useMemo(() => {
    let list = [...data.marketplaceProjects];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.location_country?.toLowerCase().includes(q) ||
        p.technology_type?.toLowerCase().includes(q)
      );
    }
    if (stageFilter !== 'ALL') list = list.filter(p => p.project_stage === stageFilter);
    if (techFilter !== 'ALL') list = list.filter(p => p.technology_type === techFilter);
    if (band !== 'all') list = list.filter(p => BAND_META[band].test(scoreOf(p.id)));
    return list.sort((a, b) => (scoreOf(b.id) ?? 0) - (scoreOf(a.id) ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.marketplaceProjects, data.matchScoreMap, search, stageFilter, techFilter, band]);

  async function handleRefresh() {
    setRefreshing(true);
    await data.forceRefresh();
    setRefreshing(false);
    toast.success('Marketplace refreshed');
  }

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  const hasFilters = search.trim() !== '' || stageFilter !== 'ALL' || techFilter !== 'ALL' || band !== 'all';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Project Marketplace" />
      <PageHero
        eyebrow="Trading Marketplace"
        title="Projects open for offtake"
        description="Live projects scored against your trading profile — filter by stage and technology to build your offtake book."
        actions={
          <Button
            variant="outline"
            className="h-9 px-4 bg-white/10 border-white/15 text-white hover:bg-white/20"
            icon={refreshing ? <Icons.spinner className="size-4 animate-spin" />

       : <Icons.refreshCw className="size-4" />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}

      {/* Counters strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Projects in view', value: data.marketplaceProjects.length },
          { label: 'Scored matches', value: data.matches.length },
          { label: 'Showing', value: filtered.length },
        ].map(c => (
          <div key={c.label} className="rounded-none border border-line bg-white px-4 py-3 shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <p className="text-lg font-black text-slate-900">{c.value}</p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Score-band filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', ...(Object.keys(BAND_META) as Array<keyof typeof BAND_META>)] as const).map(b => {
          const active = band === b;
          const count = b === 'all' ? bandCounts.all : bandCounts[b];
          return (
            <button
              key={b}
              onClick={() => setBand(b as ScoreBand)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-none border px-3 text-[11px] font-bold transition-colors',
                active
                  ? 'border-[#0b3b24] bg-[#0b3b24] text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              )}
            >
              {b === 'all' ? 'All projects' : BAND_META[b as keyof typeof BAND_META].label}
              <span className={cn('px-1.5 text-[9px] font-black', active ? 'bg-white/15' : 'bg-slate-100')}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, location, or technology..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-[#0b3b24]"
            />
          </div>
          <select
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="h-10 px-3 border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 focus:outline-none"
          >
            {technologies.map(t => (
              <option key={t} value={t}>{t === 'ALL' ? 'All Technologies' : t.replace(/_/g, ' ')}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setStageFilter('ALL'); setTechFilter('ALL'); }}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STAGE_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              className={cn(
                'px-3 h-8 text-[10px] font-bold uppercase tracking-widest border transition-colors',
                stageFilter === s ? 'bg-[#0b3b24] text-white border-[#0b3b24]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              )}
            >
              {s === 'ALL' ? 'All Stages' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {data.loadingMarketplace ? (
        <KpiBarSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title={data.marketplaceProjects.length === 0 ? 'No Projects Available' : 'No Projects Match Filters'}
          description={
            data.marketplaceProjects.length === 0
              ? 'No projects with offtake agreements available right now — refresh to check again.'
              : 'Try adjusting your filters.'
          }
          actionLabel="Refresh"
          onAction={handleRefresh}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map(project => {
            const score = data.matchScoreMap[project.id];
            const engaged = data.engagedProjectMap[project.id];
            const readiness = project.scores?.capital_readiness_score ?? (project as any).scores?.[0]?.capital_readiness_score ?? 0;
            return (
              <div key={project.id} className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-[#0b3b24] px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold text-emerald-200/50 uppercase tracking-widest mb-0.5">
                      {project.technology_type?.replace(/_/g, ' ')} · {project.project_stage?.replace(/_/g, ' ')}
                    </p>
                    <Link href={`/projects/${project.id}`}>
                      <h4 className="text-sm font-bold text-white hover:text-emerald-200 transition-colors truncate">{project.name}</h4>
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <Icons.mapPin className="size-3 text-emerald-300/60 shrink-0" />
                      <span className="text-[10px] font-bold text-emerald-200/70 truncate">{project.location_country}</span>
                    </div>
                  </div>
                  {score !== undefined && (
                    <div className={cn(
                      'flex flex-col items-center justify-center w-14 h-14 border-2 shrink-0 bg-white/95',
                      score >= 75 ? 'text-emerald-600 border-emerald-300' : score >= 50 ? 'text-amber-600 border-amber-300' : 'text-slate-500 border-slate-300'
                    )}>
                      <span className="text-base font-extrabold leading-none">{score}%</span>
                      <span className="text-[8px] font-bold tracking-widest uppercase mt-0.5">Match</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                  <div className="px-3 py-2.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Capacity</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{project.project_size_mw} MW</p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Capital Req.</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {project.capital_required ? `$${(project.capital_required / 1_000_000).toFixed(1)}M` : '—'}
                    </p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Readiness</p>
                    <p className={cn('text-sm font-bold mt-0.5', readiness >= 60 ? 'text-emerald-600' : readiness >= 40 ? 'text-amber-600' : 'text-slate-500')}>
                      {readiness}%
                    </p>
                  </div>
                </div>

                {/* Engaged banner */}
                {engaged && (
                  <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
                    <Icons.checkCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                    <span className="text-[11px] font-bold text-emerald-700">
                      Engaged — {engaged.status.replace(/_/g, ' ').toLowerCase()}
                    </span>
                    <Link href={`/engagements/${engaged.id}`} className="ml-auto text-[10px] font-bold text-emerald-700 underline">View</Link>
                  </div>
                )}

                {/* Actions */}
                <div className="px-4 py-3 mt-auto flex items-center gap-2">
                  <Link href={`/projects/${project.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full h-8 text-[11px]" icon={<Icons.eye className="size-3" />}>
                      View project
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
