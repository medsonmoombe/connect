'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { DashboardOverview } from '@/components/investor/DashboardOverview';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useFinancierData } from '@/hooks/useFinancierData';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';

/**
 * Legacy ?tab= deep links now live at their own routes:
 * /investor/marketplace, /portfolio, /messages, /bookmarks, /reports, /profile
 * (matches merged into the marketplace with score-band filters)
 */
const LEGACY_TAB_ROUTES: Record<string, string> = {
  matches: '/investor/marketplace?band=high',
  marketplace: '/investor/marketplace',
  portfolio: '/investor/portfolio',
  messages: '/engagements?view=messages',
  bookmarks: '/investor/bookmarks',
  reports: '/investor/reports',
  profile: '/investor/profile',
};

export default function InvestorDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');

  // Redirect legacy ?tab= URLs to their dedicated pages
  useEffect(() => {
    if (tab && tab !== 'dashboard' && LEGACY_TAB_ROUTES[tab]) {
      router.replace(LEGACY_TAB_ROUTES[tab]);
    }
  }, [tab, router]);

  const data = useFinancierData({ engagements: true, matches: true, autoRunMatching: true });
  const { user, loading } = data;
  const { unreadByEngagement } = useUnreadMessages();

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
      <PageTitle title="Investor Hub" />
      <PageHero
        eyebrow="Financier Dashboard"
        title={`Welcome back, ${user?.full_name?.split(' ')[0] || 'Partner'}`}
        description="Your investment pipeline at a glance — ranked matches, active engagements, and the deals moving through your pipeline."
      />

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}

      
      <DashboardOverview
        matches={data.matches}
        engagementCount={data.engagements.length}
        loading={data.loadingProjects || data.loadingMatches}
        engagements={data.engagements}
        unreadByEngagement={unreadByEngagement}
        onGoToMatches={() => router.push('/investor/marketplace?band=high')}
      />
    </div>
  );
}
