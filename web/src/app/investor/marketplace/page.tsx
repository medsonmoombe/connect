'use client';

import { useEffect, useMemo, useState } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { MarketplaceTab } from '@/components/investor/MarketplaceTab';
import { useFinancierData } from '@/hooks/useFinancierData';
import { cn } from '@/lib/utils';

type ScoreBand = 'all' | 'high' | 'medium' | 'low' | 'unscored';

const BAND_META: Record<Exclude<ScoreBand, 'all'>, { label: string; test: (s: number | undefined) => boolean }> = {
  high: { label: 'Strong fit (≥75%)', test: (s) => s !== undefined && s >= 75 },
  medium: { label: 'Medium (50–74%)', test: (s) => s !== undefined && s >= 50 && s < 75 },
  low: { label: 'Long shot (<50%)', test: (s) => s !== undefined && s < 50 },
  unscored: { label: 'Not yet scored', test: (s) => s === undefined },
};

export default function InvestorMarketplacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const data = useFinancierData({ projects: true, engagements: true, matches: true, bookmarks: true });
  const initialBand = (searchParams.get('band') as ScoreBand | null) ?? 'all';
  const [band, setBand] = useState<ScoreBand>(
    initialBand && (BAND_META as Record<string, { test: (s: number | undefined) => boolean }>)[initialBand] ? initialBand : 'all'
  );

  const bandCounts = useMemo(() => {
    const counts: Record<string, number> = { all: data.projects.length };
    for (const key of Object.keys(BAND_META) as Array<keyof typeof BAND_META>) {
      counts[key] = data.projects.filter(p => BAND_META[key].test(data.matchScoreMap[p.id])).length;
    }
    return counts;
  }, [data.projects, data.matchScoreMap]);

  const bandedProjects = useMemo(
    () => (band === 'all' ? data.projects : data.projects.filter(p => BAND_META[band].test(data.matchScoreMap[p.id]))),
    [band, data.projects, data.matchScoreMap]
  );

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'CAPITAL_PARTNER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Project Marketplace" />
      <PageHero
        eyebrow="Project Marketplace"
        title="Browse vetted energy opportunities"
        description="Projects actively seeking capital. Match scores show how closely each opportunity fits your mandate and screening criteria."
      />

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}

      

      <div className="flex items-center gap-4 rounded-none border border-line bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex items-center gap-2">
          <Icons.folder className="size-3.5 text-[#166b3b]" />
          <span className="text-xs font-bold text-slate-700">{data.projects.length} opportunities listed</span>
        </div>
        <span className="h-4 w-px bg-slate-200" />
        <div className="flex items-center gap-2">
          <Icons.bookmark className="size-3.5 text-[#166b3b]" />
          <span className="text-xs font-bold text-slate-700">{data.bookmarks.length} saved</span>
        </div>
      </div>

      {/* Score-band filters (absorbs the former dedicated Matches page) */}
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

      <MarketplaceTab
        projects={bandedProjects}
        matchScores={data.matchScoreMap}
        matches={data.matches}
        engagements={data.engagements}
        loading={data.loadingProjects}
        onRefresh={() => void data.forceRefresh()}
        capitalPartnerId={data.capitalPartnerId}
        bookmarkedIds={data.bookmarkedIds}
        onBookmarkToggle={data.handleBookmarkToggle}
      />
    </div>
  );
}
