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
import { getStateLabel } from '@/lib/engagement';
import { useGrantData } from '@/hooks/useGrantData';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

/**
 * Legacy ?tab= deep links now live at their own routes:
 * /grant/marketplace, /portfolio, /messages, /reports, /profile
 */
const LEGACY_TAB_ROUTES: Record<string, string> = {
  marketplace: '/grant/marketplace',
  portfolio: '/grant/portfolio',
  messages: '/engagements?view=messages',
  reports: '/grant/reports',
  profile: '/grant/profile',
};

export default function GrantDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useGrantData({ engagements: true, matches: true, autoRunMatching: true });

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
      else if (user.role !== 'GRANT_PROVIDER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  const topMatches = useMemo(
    () => [...data.matches].sort((a, b) => (b.compatibility_score ?? 0) - (a.compatibility_score ?? 0)).slice(0, 3),
    [data.matches]
  );

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  const highMatches = data.matches.filter(m => (m.compatibility_score ?? 0) >= 75);
  const isOrgAdmin = user.is_org_admin;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Grant Provider Hub" />
      <PageHero
        eyebrow="Grant Provider Overview"
        title={`Welcome back, ${user.full_name?.split(' ')[0] || 'Partner'}`}
        description={`${data.matches.length} matched project${data.matches.length !== 1 ? 's' : ''} in your funding pipeline — deploy concessionary capital where it moves the needle.`}
        actions={
          <>

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}
            <Link href="/grant/profile">
              <Button variant="outline" className="h-9 px-4 bg-white/10 border-white/15 text-white hover:bg-white/20" icon={<Icons.settings />

      }>
                Funding Profile
              </Button>
            </Link>
            <Link href="/grant/marketplace">
              <Button className="h-9 px-4 bg-white text-[#0b3b24] hover:bg-emerald-50 border border-emerald-200/40" icon={<Icons.search />}>
                Browse Matches
              </Button>
            </Link>
          </>
        }
      />

      {/* Unread messages alert */}
      <UnreadAlert />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Matched Projects', value: data.matches.length, sub: `${highMatches.length} strong fit (75%+)`, href: '/grant/marketplace' },
          { label: 'Active Engagements', value: data.activeEngagements.length, sub: `${data.engagements.length} total`, href: '/grant/portfolio' },
          {
            label: 'Grant Range',
            value: data.grantProfile.max_grant_size > 0
              ? `$${(data.grantProfile.min_grant_size / 1e6).toFixed(1)}M–$${(data.grantProfile.max_grant_size / 1e6).toFixed(1)}M`
              : 'Not set',
            sub: 'configured range', href: '/grant/profile',
          },
          { label: 'Focus Sectors', value: data.grantProfile.focus_sectors.length, sub: 'sectors configured', href: '/grant/profile' },
        ].map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="group">
            <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] transition-shadow group-hover:shadow-md">
              <div className="bg-[#0b3b24] px-4 py-2">
                <p className="text-[10.5px] font-extrabold text-emerald-200/70 uppercase tracking-[0.13em]">{kpi.label}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-2xl font-extrabold text-slate-900">{kpi.value}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">{kpi.sub}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top matches */}
        <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Icons.target className="size-4 text-[#166b3b]" />
              <p className="text-sm font-bold text-slate-900">Top matches</p>
            </div>
            <Link href="/grant/marketplace" className="text-[10px] font-bold text-[#166b3b] hover:underline tracking-widest uppercase">
              View all →
            </Link>
          </div>
          {data.loadingMatches ? (
            <div className="p-6 text-center"><Icons.spinner className="size-5 animate-spin mx-auto text-slate-300" /></div>
          ) : topMatches.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-xs font-bold text-slate-400">No matches yet.</p>
              <button onClick={() => data.forceRefresh()} className="mt-2 text-[11px] font-bold text-[#0b3b24] underline">Run matching</button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {topMatches.map((m) => (
                <div key={m.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <Link href={`/projects/${m.project?.id}`}>
                      <p className="text-sm font-bold text-slate-900 truncate hover:text-[#0b3b24]">{m.project?.name}</p>
                    </Link>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider mt-0.5">
                      {m.project?.technology_type?.replace(/_/g, ' ')} · {m.project?.location_country} · {m.project?.project_stage?.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className={cn(
                    'px-2 py-1 text-[10px] font-extrabold border shrink-0',
                    m.compatibility_score >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : m.compatibility_score >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  )}>
                    {m.compatibility_score}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active engagements */}
        <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Icons.handshake className="size-4 text-[#166b3b]" />
              <p className="text-sm font-bold text-slate-900">Active engagements</p>
            </div>
            <Link href="/grant/portfolio" className="text-[10px] font-bold text-[#166b3b] hover:underline tracking-widest uppercase">
              View all →
            </Link>
          </div>
          {data.loadingEngagements ? (
            <div className="p-6 text-center"><Icons.spinner className="size-5 animate-spin mx-auto text-slate-300" /></div>
          ) : data.activeEngagements.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-xs font-bold text-slate-400">No active engagements yet.</p>
              <Link href="/grant/marketplace" className="mt-2 inline-block text-[11px] font-bold text-[#0b3b24] underline">Browse matches</Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.activeEngagements.slice(0, 5).map((eng) => (
                <Link key={eng.id} href={`/engagements/${eng.id}`}>
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

      {/* Team management for org admins */}
      {isOrgAdmin && (
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5 flex flex-wrap items-center gap-4">
          <div className="size-10 rounded-none bg-[#e9f6ee] flex items-center justify-center shrink-0">
            <Icons.users className="size-5 text-[#166b3b]" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-bold text-slate-900">Team management</p>
            <p className="text-xs text-slate-500 mt-0.5">Invite colleagues to your grant organisation and control their access.</p>
          </div>
          <Link href="/settings/team">
            <Button variant="outline" size="sm" className="h-9 px-4 text-[11px]" icon={<Icons.user className="size-3.5" />}>
              Manage team
            </Button>
          </Link>
        </div>
      )}

      {/* Match explainer */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-sm font-bold text-slate-900">Why a project appears in your matches</p>
        </div>
        <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: <Icons.checkCircle2 className="size-4 text-emerald-600" />, title: 'Project is Live', desc: 'The developer has submitted and the project is approved and visible to partners.' },
            { icon: <Icons.shieldCheck className="size-4 text-blue-600" />, title: 'Developer Verified', desc: "The developer's organisation has passed platform verification." },
            { icon: <Icons.zap className="size-4 text-amber-600" />, title: 'Match Score Computed', desc: 'The matching engine has scored this project against your funding profile.' },
            { icon: <Icons.target className="size-4 text-violet-600" />, title: 'Stage Allowed', desc: 'Grant partners are eligible at every project stage — Concept through Operation.' },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
              <div className="size-8 bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">{item.icon}</div>
              <div>
                <p className="text-xs font-bold text-slate-900">{item.title}</p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Compact live alert linking to Messages when unread messages exist. */
function UnreadAlert() {
  const { totalUnread } = useUnreadMessages();
  if (totalUnread <= 0) return null;
  return (
    <Link href="/engagements?view=messages" className="block">
      <div className="flex items-center gap-3 rounded-none border border-blue-200 bg-blue-50 px-4 py-3 transition-colors hover:bg-blue-100">
        <Icons.mail className="size-4 text-blue-600 shrink-0" />
        <p className="text-xs font-bold text-blue-800 flex-1">
          You have {totalUnread} unread message{totalUnread === 1 ? '' : 's'} — view your conversations
        </p>
        <Icons.chevronRight className="size-4 text-blue-400" />
      </div>
    </Link>
  );
}
