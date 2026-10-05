'use client';

import { useEffect, useMemo, useState } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { useTechnicalData } from '@/hooks/useTechnicalData';
import { Project } from '@/types';

const STAGE_FILTERS = [
  { value: 'all', label: 'All stages' },
  { value: 'FULL_FEASIBILITY', label: 'Feasibility' },
  { value: 'REGULATORY_APPROVAL', label: 'Regulatory' },
  { value: 'FINANCIAL_CLOSE', label: 'Financial close' },
  { value: 'CONSTRUCTION', label: 'Construction' },
];

type ScoreBand = 'all' | 'high' | 'medium' | 'low' | 'unscored';

const BAND_META: Record<Exclude<ScoreBand, 'all'>, { label: string; test: (s: number | undefined) => boolean }> = {
  high: { label: 'Strong fit (≥75%)', test: (s) => s !== undefined && s >= 75 },
  medium: { label: 'Medium (50–74%)', test: (s) => s !== undefined && s >= 50 && s < 75 },
  low: { label: 'Long shot (<50%)', test: (s) => s !== undefined && s < 50 },
  unscored: { label: 'Not yet scored', test: (s) => s === undefined },
};

export default function TechnicalMarketplacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const data = useTechnicalData({ marketplace: true, matches: true });
  const [stage, setStage] = useState('all');
  const [query, setQuery] = useState('');
  const [tech, setTech] = useState('all');
  const initialBand = (searchParams.get('band') as ScoreBand | null) ?? 'all';
  const [band, setBand] = useState<ScoreBand>(
    initialBand && (BAND_META as Record<string, { test: (s: number | undefined) => boolean }>)[initialBand] ? initialBand : 'all'
  );

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'TECHNICAL_PARTNER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  const technologies = useMemo(() => {
    const set = new Set<string>();
    for (const p of data.marketplaceProjects) if (p.technology_type) set.add(p.technology_type);
    return ['all', ...[...set].sort()];
  }, [data.marketplaceProjects]);

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
    let list = [...data.marketplaceProjects];
    if (stage !== 'all') list = list.filter(p => p.project_stage === stage);
    if (tech !== 'all') list = list.filter(p => p.technology_type === tech);
    if (band !== 'all') list = list.filter(p => BAND_META[band].test(scoreOf(p.id)));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(p =>
        [p.name, p.location_country, p.technology_type].some(f => String(f ?? '').toLowerCase().includes(q))
      );
    }
    // Best-fit-first: scored projects lead, strongest score at the top;
    // unscored projects follow by name so the marketplace always opens
    // on the opportunities most relevant to this partner.
    list.sort((a, b) => {
      const sa = scoreOf(a.id), sb = scoreOf(b.id);
      if (sa !== undefined && sb !== undefined) return sb - sa;
      if (sa !== undefined) return -1;
      if (sb !== undefined) return 1;
      return String(a.name).localeCompare(String(b.name));
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.marketplaceProjects, data.matchScoreMap, stage, tech, band, query]);

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Project Marketplace" />
      <PageHero
        eyebrow="Opportunities"
        title="Projects that need your expertise"
        description="Live projects ranked by how well they fit your capability profile — strongest fits first. Filter by stage, technology, or fit band."
      />

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}

      

      {/* Utility strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 rounded-none border border-line bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <Icons.layers className="size-3.5 text-[#166b3b]" />
          <span className="text-xs font-bold text-slate-700">{filtered.length} of {data.marketplaceProjects.length} opportunities</span>
        </div>
        <button
          onClick={() => void data.forceRefresh()}
          className="inline-flex h-9 items-center gap-2 rounded-none border border-slate-200 bg-white px-4 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
        >
          <Icons.refresh className="size-3.5" /> Refresh
        </button>
      </div>

      {/* Score-band filters (merged from the former Matches page) */}
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
              <span className={cn(
                'px-1.5 text-[9px] font-black',
                active ? 'bg-white/15' : 'bg-slate-100'
              )}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-none border border-slate-200 bg-white overflow-hidden overflow-x-auto">
          {STAGE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStage(f.value)}
              className={cn(
                'px-3.5 h-8 text-[11px] font-bold whitespace-nowrap border-r border-slate-200 last:border-r-0 transition-colors',
                stage === f.value ? 'bg-[#0b3b24] text-white' : 'text-slate-500 hover:bg-slate-50'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={tech}
          onChange={e => setTech(e.target.value)}
          className="h-8 rounded-none border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-600 focus:outline-none focus:border-[#1f9d55]"
        >
          {technologies.map(t => (
            <option key={t} value={t}>{t === 'all' ? 'All technologies' : t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="w-full h-9 pl-9 pr-3 rounded-none border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:border-[#1f9d55] focus:ring-2 focus:ring-[#1f9d55]/20"
          />
        </div>
      </div>

      {/* Project grid */}
      {data.loadingMarketplace ? (
        <DashboardSkeleton />
      ) : filtered.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((project: Project) => {
            const score = scoreOf(project.id);
            return (
              <Link key={project.id} href={`/projects/${project.id}`} className="group">
                <div className="h-full rounded-none bg-white border border-line shadow-[0_1px_2px_rgba(22,36,28,0.05)] hover:shadow-xl transition-all flex flex-col">
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="size-10 rounded-none bg-[#f4f6f5] flex items-center justify-center text-[#166b3b] border border-slate-100 shrink-0">
                        <Icons.zap className="size-5" />
                      </div>
                      {score !== undefined ? (
                        <div className={cn(
                          'px-2 py-1 rounded-none border text-[11px] font-black',
                          score >= 75 ? 'bg-green-50 border-green-100 text-green-700' : score >= 50 ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-500'
                        )}>
                          {score}% fit
                        </div>
                      ) : (
                        <span className="px-2 py-1 rounded-none bg-slate-50 border border-slate-100 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                          {project.project_stage?.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-base font-bold text-slate-900 group-hover:text-[#166b3b] transition-colors leading-snug">{project.name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
                      <span className="flex items-center gap-1"><Icons.mapPin className="size-3" />{project.location_country}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-50 text-[9px]">{project.technology_type}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-50 text-[9px]">{project.project_size_mw} MW</span>
                    </div>
                  </div>
                  <div className="mt-auto border-t border-slate-50 px-5 py-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {(project as any).company?.name || 'Developer'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#166b3b]">
                      View project <Icons.chevronRight className="size-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-none border border-line bg-white p-12 text-center shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <Icons.search className="size-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">
            {data.marketplaceProjects.length === 0 ? 'No projects available' : 'Nothing matches these filters'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {data.marketplaceProjects.length === 0
              ? 'No execution-stage projects are live right now — check back soon.'
              : 'Try a different stage or clear the search.'}
          </p>
        </div>
      )}
    </div>
  );
}
