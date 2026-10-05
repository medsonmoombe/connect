'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { EmptyState } from '@/components/ui/empty-state';
import { useConsultantData } from '@/hooks/useConsultantData';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';
import { Project } from '@/types';

const cardClass = 'rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]';

const STAGES = [
  { id: 'ALL', label: 'All stages' },
  { id: 'CONCEPT', label: 'Concept' },
  { id: 'PRE_FEASIBILITY', label: 'Pre-feasibility' },
  { id: 'FULL_FEASIBILITY', label: 'Full feasibility' },
];

type ScoreBand = 'all' | 'high' | 'medium' | 'low' | 'unscored';

const BAND_META: Record<Exclude<ScoreBand, 'all'>, { label: string; test: (s: number | undefined) => boolean }> = {
  high: { label: 'Strong fit (≥75%)', test: (s) => s !== undefined && s >= 75 },
  medium: { label: 'Medium (50–74%)', test: (s) => s !== undefined && s >= 50 && s < 75 },
  low: { label: 'Long shot (<50%)', test: (s) => s !== undefined && s < 50 },
  unscored: { label: 'Not yet scored', test: (s) => s === undefined },
};

export default function ConsultantMarketplacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const data = useConsultantData({ marketplace: true, matches: true });
  const [stageFilter, setStageFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const initialBand = (searchParams.get('band') as ScoreBand | null) ?? 'all';
  const [band, setBand] = useState<ScoreBand>(
    initialBand && (BAND_META as Record<string, { test: (s: number | undefined) => boolean }>)[initialBand] ? initialBand : 'all'
  );

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'CONSULTANT' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  const technologies = useMemo(
    () => Array.from(new Set(data.marketplaceProjects.map(p => p.technology_type).filter(Boolean))) as string[],
    [data.marketplaceProjects]
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data.marketplaceProjects.filter(p => {
      if (stageFilter !== 'ALL' && p.project_stage !== stageFilter) return false;
      if (band !== 'all' && !BAND_META[band].test(scoreOf(p.id))) return false;
      if (!q) return true;
      const hay = `${p.name || ''} ${p.technology_type || ''} ${p.location_country || ''}`.toLowerCase();
      return hay.includes(q);
    });
    // Best-fit-first ordering (merged from the former Matches page)
    list.sort((a, b) => {
      const sa = scoreOf(a.id), sb = scoreOf(b.id);
      if (sa !== undefined && sb !== undefined) return sb - sa;
      if (sa !== undefined) return -1;
      if (sb !== undefined) return 1;
      return String(a.name).localeCompare(String(b.name));
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.marketplaceProjects, data.matchScoreMap, stageFilter, band, search]);

  const hasFilters = search.trim() !== '' || stageFilter !== 'ALL' || band !== 'all';

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Project Marketplace" />
      <PageHero
        eyebrow="Advisory Marketplace"
        title="Projects that need your expertise"
        description="Early-stage projects ranked by advisory fit — feasibility, environmental, design, and structuring support. Filter by fit band to see your strongest matches first."
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
          { label: 'With your fit score', value: data.matches.length },
          { label: 'Showing', value: filtered.length },
        ].map(c => (
          <div key={c.label} className={cn(cardClass, 'px-4 py-3')}>
            <p className="text-lg font-black text-slate-900">{c.value}</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bank */}
      <div className={cn(cardClass, 'flex flex-wrap items-center gap-3 p-3')}>
        {/* Score bands (merged from the former Matches page) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', ...(Object.keys(BAND_META) as Array<keyof typeof BAND_META>)] as const).map(b => {
            const active = band === b;
            const count = b === 'all' ? bandCounts.all : bandCounts[b];
            return (
              <button
                key={b}
                onClick={() => setBand(b as ScoreBand)}
                className={cn(
                  'h-8 inline-flex items-center gap-1.5 border px-3 text-[11px] font-bold transition-colors',
                  active
                    ? 'border-[#0b3b24] bg-[#0b3b24] text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                )}
              >
                {b === 'all' ? 'All' : BAND_META[b as keyof typeof BAND_META].label}
                <span className={cn('px-1 text-[9px] font-black', active ? 'bg-white/15' : 'bg-slate-100')}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {STAGES.map(s => (
            <button
              key={s.id}
              onClick={() => setStageFilter(s.id)}
              className={cn(
                'h-8 border px-3 text-[11px] font-bold transition-colors',
                stageFilter === s.id
                  ? 'border-[#0b3b24] bg-[#0b3b24] text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto min-w-52 flex-1 md:max-w-xs">
          <Icons.search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search project, technology, country…"
            className="h-9 w-full rounded-none border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-medium text-slate-900 transition-colors placeholder:text-slate-400 focus:border-[#052e1a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e1a]/8"
          />
        </div>
      </div>

      {/* Cards grid */}
      {data.loadingMarketplace ? (
        <div className={cn(cardClass, 'p-8 text-center')}><Icons.spinner className="size-5 animate-spin mx-auto text-[#0b3b24]" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title={hasFilters ? 'No projects for these filters' : 'No Projects Available'}
          description={hasFilters ? 'Try clearing the search or widening the stage filter.' : 'No early-stage projects are seeking advisory services right now.'}
          actionLabel={hasFilters ? 'Clear filters' : 'Refresh'}
          onAction={() => {
            if (hasFilters) { setSearch(''); setStageFilter('ALL'); }
            else void data.forceRefresh();
          }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(project => {
            const score = data.matchScoreMap[project.id];
            const engaged = !!data.engagedProjectMap[project.id];
            return (
              <Link key={project.id} href={`/projects/${project.id}`} className="group">
                <div className={cn(cardClass, 'flex h-full flex-col p-5 transition-all hover:border-slate-300 hover:shadow-md')}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex size-11 items-center justify-center rounded-none border border-green-100 bg-green-50 text-green-600">
                      <Icons.sun className="size-5" />
                    </div>
                    {score !== undefined && (
                      <div className={cn(
                        'flex size-10 items-center justify-center border font-black text-sm',
                        score >= 75 ? 'border-green-100 bg-green-50 text-green-700' : score >= 50 ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-slate-100 bg-slate-50 text-slate-500'
                      )}>
                        {score}%
                      </div>
                    )}
                  </div>
                  <h4 className="mb-1 truncate text-sm font-bold text-slate-900 group-hover:text-[#0b3b24] transition-colors">{project.name}</h4>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {(project as Project & { company?: { name?: string } }).company?.name || 'Developer'}
                  </p>
                  <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1"><Icons.mapPin className="size-3" />{project.location_country}</span>
                    <span className="flex items-center gap-1"><Icons.layers className="size-3" />{project.project_size_mw} MW</span>
                    <span className="flex items-center gap-1"><Icons.zap className="size-3" />{project.technology_type}</span>
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {String(project.project_stage || '').replace(/_/g, ' ')}
                    </span>
                    {engaged ? (
                      <span className="border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">Engaged</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#166b3b] opacity-0 transition-opacity group-hover:opacity-100">
                        View <Icons.chevronRight className="size-3" />
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
