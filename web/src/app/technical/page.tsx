'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { useTechnicalData } from '@/hooks/useTechnicalData';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { KpiCard, SectionCard, ListItemRow, QuickActionCard, StatusBadge } from '@/components/ui/dashboard-cards';
import { TechnicalProfileCard } from '@/components/partners/TechnicalProfileCard';
import { cn } from '@/lib/utils';

/**
 * Legacy ?tab= deep links now live at their own routes:
 * /technical/marketplace, /portfolio, /messages, /reports, /profile
 * (matches merged into the marketplace with score-band filters)
 */
const LEGACY_TAB_ROUTES: Record<string, string> = {
  matches: '/technical/marketplace?band=high',
  marketplace: '/technical/marketplace',
  portfolio: '/technical/portfolio',
  messages: '/engagements?view=messages',
  reports: '/technical/reports',
  profile: '/technical/profile',
};

export default function TechnicalDashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useTechnicalData({ engagements: true, matches: true, autoRunMatching: true });
  const { unreadByEngagement } = useUnreadMessages();

  // Redirect legacy ?tab= URLs to their dedicated pages
  const searchParams = (typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null);
  const tab = searchParams?.get('tab');
  useEffect(() => {
    if (tab && LEGACY_TAB_ROUTES[tab]) router.replace(LEGACY_TAB_ROUTES[tab]);
  }, [tab, router]);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'TECHNICAL_PARTNER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  const unreadTotal = Object.values(unreadByEngagement).reduce((s: number, n) => s + (n as number), 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="EPC & Operator Hub" />
      <PageHero
        eyebrow="Technical Partner Overview"
        title={`Welcome back, ${user?.full_name?.split(' ')[0] || 'Partner'}`}
        description="Your engineering pipeline at a glance — live matches, delivery capability, and active engagements."
      />

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}

      

      {/* KPI cards */}
      {data.loadingEngagements ? (
        <KpiCard label="Loading" value="…" icon={Icons.activity} iconBg="bg-slate-100" iconColor="text-slate-500" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Lifetime Delivered" value={data.techProfile?.total_mw_delivered || 0} unit="MW" icon={Icons.zap} iconBg="bg-green-50" iconColor="text-green-600" />
          <KpiCard label="Project Matches" value={data.matches.length} icon={Icons.target} iconBg="bg-blue-50" iconColor="text-blue-600" />
          <KpiCard label="Active Engagements" value={data.activeEngagements.length} icon={Icons.briefcase} iconBg="bg-amber-50" iconColor="text-amber-600" />
          <KpiCard label="Annual Capacity" value={data.techProfile?.annual_delivery_capacity_mw || 0} unit="MW" icon={Icons.barChart} iconBg="bg-violet-50" iconColor="text-violet-600" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <SectionCard
          sectionLabel="Opportunities"
          title="Top Project Matches"
          onHeaderAction={() => router.push('/technical/marketplace?band=high')}
          loading={data.loadingMatches}
          empty={<p className="text-xs text-slate-400 font-medium">No matches yet. The matching engine runs automatically.</p>}
        >
          {data.matches.slice(0, 3).map((match: any) => {
            const project = match.project as any;
            if (!project) return null;
            const score = match.compatibility_score;
            return (
              <ListItemRow
                key={match.id || match.project_id}
                href={`/projects/${project.id}`}
                icon={(
                  <div className={cn(
                    'size-10 rounded-none flex items-center justify-center shrink-0 border font-black text-sm',
                    score >= 75 ? 'bg-green-50 border-green-100 text-green-700' : score >= 50 ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-500'
                  )}>
                    {score}%
                  </div>
                )}
                title={project.name}
                subtitle={`${project.technology_type} · ${project.project_size_mw} MW · ${project.location_country}`}
              />
            );
          })}
        </SectionCard>

        <SectionCard
          sectionLabel="Pipeline"
          title="Active Engagements"
          headerAction={`${data.activeEngagements.length} active`}
          empty={<p className="text-xs text-slate-400 font-medium">No active engagements yet.</p>}
        >
          {data.activeEngagements.slice(0, 5).map((eng) => (
            <ListItemRow
              key={eng.id}
              href={`/engagements/${eng.id}`}
              title={eng.project?.name || 'Project'}
              subtitle={eng.status?.replace(/_/g, ' ')}
              trailing={<StatusBadge status={eng.status} />}
            />
          ))}
        </SectionCard>
      </div>

      {/* Capability + coverage + quick actions */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-none border border-slate-100 shadow-soft p-6">
          <div className="flex items-center gap-2 mb-4">
            <Icons.wrench className="size-4 text-[#166b3b]" />
            <h3 className="text-sm font-bold text-slate-900">Service Coverage</h3>
          </div>
          <div className="space-y-2">
            {data.techProfile?.service_categories && data.techProfile.service_categories.length > 0 ? (
              data.techProfile.service_categories.map((service: string) => (
                <div key={service} className="flex items-center gap-2 p-2.5 rounded-none bg-slate-50 border border-slate-100">
                  <Icons.checkCircle2 className="size-3.5 text-green-500 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700">{service.replace(/_/g, ' ')}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-slate-400 italic mb-2">No services configured yet.</p>
                <Link href="/technical/profile" className="text-[11px] font-bold text-[#166b3b] hover:underline">Add your capabilities →</Link>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-none border border-slate-100 shadow-soft p-6">
          <div className="flex items-center gap-2 mb-4">
            <Icons.gauge className="size-4 text-[#166b3b]" />
            <h3 className="text-sm font-bold text-slate-900">Capacity Overview</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Largest Project</span>
              <span className="text-sm font-bold text-slate-900">{data.techProfile?.largest_project_mw || 0} MW</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Avg. Delivery Time</span>
              <span className="text-sm font-bold text-slate-900">{data.techProfile?.average_delivery_time_months || 0} months</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Bonding Capacity</span>
              <span className="text-sm font-bold text-slate-900">${(((data.techProfile?.bonding_capacity as number) || 0) / 1000000).toFixed(0)}M</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Team Size</span>
              <span className="text-sm font-bold text-slate-900">{data.company?.team_size || '—'}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <QuickActionCard href="/technical/marketplace" icon={Icons.search} iconBg="bg-blue-50" iconColor="text-blue-600" title="Browse Projects" description="Find new opportunities" />
          <QuickActionCard href="/technical/profile" icon={Icons.user} iconBg="bg-amber-50" iconColor="text-amber-600" title="Update Profile" description="Improve match accuracy" />
          <QuickActionCard href="/technical/reports" icon={Icons.barChart} iconBg="bg-green-50" iconColor="text-green-600" title="Delivery Reports" description="Pipeline & performance" />
          {unreadTotal > 0 && (
            <div className="rounded-none border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-2">
                <Icons.messageSquare className="size-4 text-blue-600" />
                <p className="text-xs font-bold text-blue-800">{unreadTotal} unread message{unreadTotal === 1 ? '' : 's'}</p>
              </div>
              <Link href="/engagements?view=messages" className="text-[11px] font-bold text-blue-700 hover:underline mt-1 inline-block">Open communications →</Link>
            </div>
          )}
        </div>
      </div>

      {/* Compact capability strip */}
      {data.techProfile && (
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-slate-900">Capability snapshot</p>
            <Link href="/technical/profile" className="text-[11px] font-bold text-[#166b3b] hover:underline">Full profile →</Link>
          </div>
          <TechnicalProfileCard partner={data.techProfile} compact />
        </div>
      )}
    </div>
  );
}
