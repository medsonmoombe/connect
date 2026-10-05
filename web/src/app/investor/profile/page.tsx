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
import { ProfileTab } from '@/components/investor/ProfileTab';
import { useFinancierData } from '@/hooks/useFinancierData';

export default function InvestorProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useFinancierData({ engagements: true });

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'CAPITAL_PARTNER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || !user || !user.company_id) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Investment Mandate" />
      <PageHero
        eyebrow="Investor Profile"
        title="Define how you want to be matched"
        description="Your mandate shapes every match you receive. Keep it current so developers and the matching engine understand exactly what you fund."
      />

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}

      

      <div className="inline-flex items-center gap-2 rounded-none border border-line bg-white px-4 py-2 shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        {data.capProfile ? (
          <>
            <Icons.checkCircle2 className="size-3.5 text-emerald-600" />
            <span className="text-xs font-bold text-slate-700">Mandate profile on file — update anytime</span>
          </>
        ) : (
          <>
            <Icons.info className="size-3.5 text-amber-600" />
            <span className="text-xs font-bold text-slate-700">Complete your mandate to unlock the strongest matches</span>
          </>
        )}
      </div>

      <ProfileTab
        capProfile={data.capProfile}
        capitalPartnerId={data.capitalPartnerId}
        userId={user.company_id}
        onProfileSaved={data.handleProfileSaved}
      />
    </div>
  );
}
