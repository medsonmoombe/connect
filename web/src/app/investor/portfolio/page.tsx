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
import { PortfolioTab } from '@/components/investor/PortfolioTab';
import { useFinancierData } from '@/hooks/useFinancierData';

const ACTIVE_STATUSES = ['INTRO_SENT', 'INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED'];

export default function InvestorPortfolioPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useFinancierData({ engagements: true });

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'CAPITAL_PARTNER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  const total = data.engagements.length;
  const active = data.engagements.filter(e => ACTIVE_STATUSES.includes(e.status)).length;
  const committed = data.engagements.filter(e => ['CAPITAL_COMMITTED', 'CONTRACT_SIGNED', 'CLOSED'].includes(e.status)).length;

  if (loading || !user) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Deal Portfolio" />
      <PageHero
        eyebrow="Deal Pipeline"
        title="Your active engagements"
        description="Track every engagement from first introduction to capital committed, with the full project context at each stage."
      />

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}

      

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total deals', value: total, icon: Icons.briefcase, tone: 'text-slate-800' },
          { label: 'Active pipeline', value: active, icon: Icons.activity, tone: 'text-[#166b3b]' },
          { label: 'Committed / closed', value: committed, icon: Icons.checkCircle2, tone: 'text-emerald-700' },
          { label: 'Last updated', value: total ? 'Recently' : '—', icon: Icons.clock, tone: 'text-slate-500' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-none border border-line bg-white p-4 shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className="mb-2.5 grid size-8 place-items-center rounded-none bg-[#e9f6ee] text-[#166b3b]">
              <Icon className="size-4" />
            </div>
            <p className={`text-xl font-black tracking-tight ${tone}`}>{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <PortfolioTab
        engagements={data.engagements}
        loading={data.loadingEngagements}
        onExplore={() => router.push('/investor/marketplace')}
        onStatusChange={data.handleEngagementStatusChange}
      />
    </div>
  );
}
