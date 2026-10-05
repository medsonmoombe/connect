'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { BookmarksTab } from '@/components/investor/BookmarksTab';
import { useFinancierData } from '@/hooks/useFinancierData';

export default function InvestorBookmarksPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useFinancierData({ engagements: true, bookmarks: true });

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
      <PageTitle title="Saved Projects" />
      <PageHero
        eyebrow="Shortlist"
        title="Projects you are watching"
        description="Your personal shortlist for later review. Saved projects keep their match scores so you can compare at a glance."
      />

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}

      

      <div className="inline-flex items-center gap-2 rounded-none border border-line bg-white px-4 py-2 shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <Icons.bookmark className="size-3.5 text-[#166b3b]" />
        <span className="text-xs font-bold text-slate-700">{data.bookmarks.length} saved project{data.bookmarks.length === 1 ? '' : 's'}</span>
      </div>

      <BookmarksTab
        bookmarks={data.bookmarks}
        matchScores={data.matchScoreMap}
        engagements={data.engagements}
        loading={data.loadingBookmarks}
        capitalPartnerId={data.capitalPartnerId}
        onRemove={(projectId) => data.handleBookmarkToggle(projectId, false)}
        onExplore={() => router.push('/investor/marketplace')}
      />
    </div>
  );
}
