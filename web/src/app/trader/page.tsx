'use client';

import { useEffect, useMemo } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { KpiBarSkeleton } from '@/components/ui/skeleton';
import { getStateLabel } from '@/lib/engagement';
import { useTraderData } from '@/hooks/useTraderData';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

/**
 * Legacy ?tab= deep links now live at their own routes:
 * /trader/marketplace, /portfolio, /messages, /reports, /profile
 */
const LEGACY_TAB_ROUTES: Record<string, string> = {
  marketplace: '/trader/marketplace',
  portfolio: '/trader/portfolio',
  messages: '/engagements?view=messages',
  reports: '/trader/reports',
  profile: '/trader/profile',
};

export default function TraderDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useTraderData({ engagements: true, marketplace: true });
  const { totalUnread } = useUnreadMessages();

  // Redirect legacy ?tab= URLs to their dedicated pages
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab && tab !== 'dashboard' && LEGACY_TAB_ROUTES[tab]) {
      router.replace(LEGACY_TAB_ROUTES[tab]);
    }
  }, [router]);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'POWER_TRADER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  const ppaReady = useMemo(
    () => data.marketplaceProjects.filter(p => {
      const stage = p.project_stage;
      return stage === 'FINANCIAL_CLOSE' || stage === 'CONSTRUCTION' || stage === 'OPERATION';
    }),
    [data.marketplaceProjects]
  );

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  const isOrgAdmin = user.is_org_admin;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Trader Hub" />
      <PageHero
        eyebrow="Power Trader Overview"
        title={`Welcome back, ${user.full_name?.split(' ')[0] || 'Partner'}`}
        description={`${data.marketplaceProjects.length} tradeable project${data.marketplaceProjects.length !== 1 ? 's' : ''} in view — build your offtake book from PPA-ready assets.`}
        actions={
          <>

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}
            <Link href="/trader/profile">
              <Button variant="outline" className="h-9 px-4 bg-white/10 border-white/15 text-white hover:bg-white/20" icon={<Icons.settings />

      }>
                Trading Profile
              </Button>
            </Link>
            <Link href="/trader/marketplace">
              <Button className="h-9 px-4 bg-white text-[#0b3b24] hover:bg-emerald-50 border border-emerald-200/40" icon={<Icons.search />}>
                Browse Projects
              </Button>
            </Link>
          </>
        }
      />

      {/* Unread messages alert */}
      {totalUnread > 0 && (
        <Link href="/engagements?view=messages" className="block">
          <div className="flex items-center gap-3 rounded-none border border-blue-200 bg-blue-50 px-4 py-3 transition-colors hover:bg-blue-100">
            <Icons.mail className="size-4 text-blue-600 shrink-0" />
            <p className="text-xs font-bold text-blue-800 flex-1">
              You have {totalUnread} unread message{totalUnread === 1 ? '' : 's'} — view your conversations
            </p>
            <Icons.chevronRight className="size-4 text-blue-400" />
          </div>
        </Link>
      )}

      {/* KPI cards */}
      {data.loadingEngagements ? (
        <KpiBarSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Offtake Capacity', value: data.traderProfile.max_offtake_capacity_mw || 0, unit: 'MW', href: '/trader/profile' },
            { label: 'Active Engagements', value: data.activeEngagements.length, sub: `${data.engagements.length} total`, href: '/trader/portfolio' },
            { label: 'PPA-Ready Projects', value: ppaReady.length, sub: `${data.marketplaceProjects.length} in marketplace`, href: '/trader/marketplace' },
            { label: 'Min PPA Duration', value: data.traderProfile.min_ppa_duration_years || 0, unit: 'yr', href: '/trader/profile' },
          ].map(kpi => (
            <Link key={kpi.label} href={kpi.href} className="group">
              <div className="rounded-none border border-line bg-white p-4 shadow-[0_1px_2px_rgba(22,36,28,0.05)] transition-shadow group-hover:shadow-md">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{kpi.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {kpi.value}
                  {kpi.unit && <span className="text-sm font-bold text-slate-400 ml-1">{kpi.unit}</span>}
                </p>
                {kpi.sub && <p className="text-[10px] font-bold text-slate-400 mt-0.5">{kpi.sub}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* PPA-ready opportunities */}
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Icons.zap className="size-4 text-[#166b3b]" />
              <p className="text-sm font-bold text-slate-900">PPA-ready projects</p>
            </div>
            <Link href="/trader/marketplace" className="text-[10px] font-bold text-[#166b3b] hover:underline tracking-widest uppercase">
              View all →
            </Link>
          </div>
          {data.loadingMarketplace ? (
            <div className="p-6 text-center"><Icons.spinner className="size-5 animate-spin mx-auto text-slate-300" /></div>
          ) : ppaReady.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-xs font-bold text-slate-400">No PPA-ready projects right now.</p>
              <Link href="/trader/marketplace" className="mt-2 inline-block text-[11px] font-bold text-[#0b3b24] underline">Browse all</Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {ppaReady.slice(0, 3).map(p => (
                <Link key={p.id} href={`/projects/${p.id}`} className="block">
                  <div className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate hover:text-[#0b3b24]">{p.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 tracking-wider mt-0.5">
                        {p.technology_type?.replace(/_/g, ' ')} · {p.project_size_mw} MW · {p.location_country}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-[10px] font-extrabold border bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                      {p.project_stage?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Active engagements */}
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Icons.handshake className="size-4 text-[#166b3b]" />
              <p className="text-sm font-bold text-slate-900">Active deals</p>
            </div>
            <Link href="/trader/portfolio" className="text-[10px] font-bold text-[#166b3b] hover:underline tracking-widest uppercase">
              View all →
            </Link>
          </div>
          {data.loadingEngagements ? (
            <div className="p-6 text-center"><Icons.spinner className="size-5 animate-spin mx-auto text-slate-300" /></div>
          ) : data.activeEngagements.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-xs font-bold text-slate-400">No active engagements yet.</p>
              <Link href="/trader/marketplace" className="mt-2 inline-block text-[11px] font-bold text-[#0b3b24] underline">Browse projects</Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.activeEngagements.slice(0, 5).map(eng => (
                <Link key={eng.id} href={`/engagements/${eng.id}`} className="block">
                  <div className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{eng.project?.name || 'Project'}</p>
                      <p className="text-[10px] font-bold text-slate-400 tracking-wider mt-0.5">{getStateLabel(eng.status)}</p>
                    </div>
                    <Icons.chevronRight className="size-4 text-slate-300 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Trading profile summary */}
        <div className="bg-white rounded-none border border-line shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icons.shieldCheck className="size-4 text-[#166b3b]" />
            <p className="text-sm font-bold text-slate-900">Trading profile</p>
          </div>
          <div className="space-y-3">
            {[
              { label: 'License Type', value: data.traderProfile.license_type?.replace(/_/g, ' ') || 'Not set' },
              { label: 'Credit Rating', value: data.traderProfile.credit_rating_equivalent || 'Not set' },
              { label: 'Min PPA Duration', value: `${data.traderProfile.min_ppa_duration_years || 0} years` },
              { label: 'Preferred Tech', value: `${(data.traderProfile.preferred_technology_types || []).length} types` },
              { label: 'Target Regions', value: `${(data.traderProfile.regions_of_interest || []).length} regions` },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center">
                <span className="text-xs text-slate-500">{row.label}</span>
                <span className="text-sm font-bold text-slate-900">{row.value}</span>
              </div>
            ))}
          </div>
          <Link href="/trader/profile" className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-[#0b3b24] hover:underline">
            Edit profile <Icons.arrowRight className="size-3" />
          </Link>
        </div>

        {/* Regions of interest */}
        <div className="bg-white rounded-none border border-line shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icons.mapPin className="size-4 text-[#166b3b]" />
            <p className="text-sm font-bold text-slate-900">Regions of interest</p>
          </div>
          <div className="space-y-2">
            {data.traderProfile.regions_of_interest?.length > 0 ? (
              data.traderProfile.regions_of_interest.map((region: string) => (
                <div key={region} className="flex items-center gap-2 p-2.5 rounded-none bg-slate-50 border border-slate-100">
                  <Icons.checkCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700">{region}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic">No regions configured yet.</p>
            )}
          </div>
        </div>

        {/* Quick actions + team */}
        <div className="space-y-4">
          <Link href="/trader/marketplace" className="block group">
            <div className="rounded-none border border-line bg-white p-4 shadow-[0_1px_2px_rgba(22,36,28,0.05)] transition-shadow group-hover:shadow-md">
              <div className="size-9 rounded-none bg-blue-50 flex items-center justify-center mb-2">
                <Icons.search className="size-4 text-blue-600" />
              </div>
              <p className="text-sm font-bold text-slate-900">Browse projects</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Find offtake opportunities</p>
            </div>
          </Link>
          <Link href="/trader/profile" className="block group">
            <div className="rounded-none border border-line bg-white p-4 shadow-[0_1px_2px_rgba(22,36,28,0.05)] transition-shadow group-hover:shadow-md">
              <div className="size-9 rounded-none bg-amber-50 flex items-center justify-center mb-2">
                <Icons.user className="size-4 text-amber-600" />
              </div>
              <p className="text-sm font-bold text-slate-900">Trading profile</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Update PPA preferences</p>
            </div>
          </Link>
          {isOrgAdmin && (
            <Link href="/settings/team" className="block group">
              <div className="rounded-none border border-line bg-white p-4 shadow-[0_1px_2px_rgba(22,36,28,0.05)] transition-shadow group-hover:shadow-md">
                <div className="size-9 rounded-none bg-[#e9f6ee] flex items-center justify-center mb-2">
                  <Icons.users className="size-4 text-[#166b3b]" />
                </div>
                <p className="text-sm font-bold text-slate-900">Team management</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Invite colleagues to your org</p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
