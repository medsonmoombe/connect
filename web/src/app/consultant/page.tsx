'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { StatusBadge } from '@/components/ui/dashboard-cards';
import { getStateLabel } from '@/lib/engagement';
import { useConsultantData } from '@/hooks/useConsultantData';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';

const cardClass = 'rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]';

function CardHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
      <div>
        <p className="text-[10px] font-bold text-g-600 uppercase tracking-widest">{eyebrow}</p>
        <h3 className="text-[15px] font-bold text-ink mt-0.5">{title}</h3>
      </div>
      {action}
    </div>
  );
}

function scoreChip(score: number) {
  return cn(
    'size-10 rounded-none flex items-center justify-center shrink-0 border font-black text-sm',
    score >= 75 ? 'bg-green-50 border-green-100 text-green-700' : score >= 50 ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-500'
  );
}

export default function ConsultantDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useConsultantData({ engagements: true, matches: true, autoRunMatching: true });
  const { unreadByEngagement } = useUnreadMessages();

  // Legacy ?tab= deep links now live at their own routes
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    const routes: Record<string, string> = {
      matches: '/consultant/marketplace?band=high',
      marketplace: '/consultant/marketplace',
      portfolio: '/consultant/portfolio',
      messages: '/engagements?view=messages',
      reports: '/consultant/reports',
      profile: '/consultant/profile',
    };
    if (tab && tab !== 'dashboard' && routes[tab]) router.replace(routes[tab]);
  }, [router]);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'CONSULTANT' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  const topMatches = useMemo(
    () => [...data.matches].sort((a, b) => (b.compatibility_score ?? 0) - (a.compatibility_score ?? 0)).slice(0, 3),
    [data.matches]
  );

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  const unreadTotal = Object.entries(unreadByEngagement || {})
    .filter(([id]) => data.engagements.some(e => e.id === id))
    .reduce((sum, [, n]) => sum + (n || 0), 0);

  const kpis = [
    { label: 'Years Experience', value: `${data.consultantProfile?.years_of_experience || 0} yrs`, icon: Icons.briefcase, bg: 'bg-green-50', color: 'text-green-600' },
    { label: 'Project Matches', value: data.matches.length, icon: Icons.target, bg: 'bg-blue-50', color: 'text-blue-600' },
    { label: 'Active Engagements', value: data.activeEngagements.length, icon: Icons.messageSquare, bg: 'bg-amber-50', color: 'text-amber-600' },
    { label: 'Projects Completed', value: data.consultantProfile?.total_projects_completed || 0, icon: Icons.checkCircle2, bg: 'bg-violet-50', color: 'text-violet-600' },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Consultant Hub" />
      <PageHero
        eyebrow="Consulting Overview"
        title={`Welcome back, ${user?.full_name?.split(' ')[0] || 'Consultant'}`}
        description="Your advisory pipeline at a glance — ranked matches, active engagements, and the mandates moving through your practice."
      />

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}

      {unreadTotal > 0 && (
        <Link href="/engagements?view=messages" className="block">
          <div className="flex items-center gap-3 rounded-none border border-blue-200 bg-blue-50/60 px-4 py-2.5 transition-colors hover:bg-blue-50">
            <Icons.messageSquare className="size-4 shrink-0 text-blue-600" />
            <p className="flex-1 text-xs font-semibold text-blue-900">
              You have <strong>{unreadTotal}</strong> unread message{unreadTotal === 1 ? '' : 's'} across your engagements.
            </p>
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Open inbox →</span>
          </div>
        </Link>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className={`${cardClass} p-4 hover:border-slate-300 hover:shadow-md transition-all`}>
              <div className={cn('size-8 flex items-center justify-center mb-3', kpi.bg)}>
                <Icon className={cn('size-4', kpi.color)} />
              </div>
              <p className="text-xl font-bold text-slate-950 tracking-tight">{kpi.value}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top matches */}
        <div className={`${cardClass} overflow-hidden`}>
          <CardHeader
            eyebrow="Opportunities"
            title="Top Project Matches"
            action={
              <Link href="/consultant/marketplace?band=high" className="text-[10px] font-bold tracking-widest text-g-600 hover:text-g-900 transition-colors">
                View All →
              </Link>
            }
          />
          {data.loadingMatches ? (
            <div className="p-8 text-center"><Icons.spinner className="size-5 animate-spin mx-auto text-[#0b3b24]" /></div>
          ) : topMatches.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-xs text-slate-400 font-medium">No matches yet. The matching engine runs automatically.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {topMatches.map((match: any) => {
                const project = match.project as any;
                if (!project) return null;
                const score = match.compatibility_score;
                const engaged = !!data.engagedProjectMap[project.id];
                return (
                  <Link key={match.id || match.project_id} href={`/projects/${project.id}`}>
                    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors group">
                      <div className={scoreChip(score)}>{score}%</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 truncate group-hover:text-[#0b3b24] transition-colors">
                          <span className="truncate">{project.name}</span>
                          {engaged && (
                            <span className="shrink-0 border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">Engaged</span>
                          )}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 tracking-wider mt-0.5 truncate">
                          {project.technology_type} · {project.project_size_mw} MW · {project.location_country}
                        </p>
                      </div>
                      <Icons.chevronRight className="size-4 text-slate-300 group-hover:text-[#0b3b24] transition-colors shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Active engagements */}
        <div className={`${cardClass} overflow-hidden`}>
          <CardHeader
            eyebrow="Pipeline"
            title="Active Engagements"
            action={<span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.13em]">{data.activeEngagements.length} active</span>}
          />
          {data.activeEngagements.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-xs text-slate-400 font-medium">No active engagements yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.activeEngagements.slice(0, 5).map((eng) => (
                <Link key={eng.id} href={`/engagements/${eng.id}`}>
                  <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors group">
                    <div className="size-10 rounded-none bg-[#0b3b24] flex items-center justify-center shrink-0">
                      <Icons.messageSquare className="size-4 text-emerald-200/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-[#0b3b24] transition-colors">
                        {eng.project?.name || 'Project'}
                        {(unreadByEngagement?.[eng.id] || 0) > 0 && (
                          <span className="ml-2 inline-block min-w-4 border border-blue-200 bg-blue-50 px-1 text-center text-[9px] font-black text-blue-700">
                            {unreadByEngagement[eng.id]}
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 tracking-wider mt-0.5 uppercase">{getStateLabel(eng.status)}</p>
                    </div>
                    <StatusBadge status={eng.status} />
                    <Icons.chevronRight className="size-4 text-slate-300 group-hover:text-[#0b3b24] transition-colors shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Service coverage */}
        <div className={`${cardClass} overflow-hidden`}>
          <CardHeader eyebrow="Expertise" title="Service Coverage" />
          <div className="p-5 divide-y divide-slate-100">
            {data.consultantProfile?.service_categories && data.consultantProfile.service_categories.length > 0 ? (
              data.consultantProfile.service_categories.map((service: string) => (
                <div key={service} className="flex items-center gap-2.5 py-2.5">
                  <span className="size-4 flex items-center justify-center rounded-none bg-green-50 border border-green-100 shrink-0">
                    <Icons.check className="size-2.5 text-green-600" />
                  </span>
                  <span className="text-xs font-semibold text-slate-700 capitalize">{service.replace(/_/g, ' ').toLowerCase()}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic py-2">No services configured.</p>
            )}
          </div>
        </div>

        {/* Practice metrics */}
        <div className={`${cardClass} overflow-hidden`}>
          <CardHeader eyebrow="Metrics" title="Consulting Overview" />
          <div className="p-5 divide-y divide-slate-100">
            {[
              { label: 'Largest Project', value: `${data.consultantProfile?.largest_project_mw || 0} MW` },
              { label: 'Availability', value: data.consultantProfile?.availability?.replace(/_/g, ' ') || '—' },
              { label: 'Certifications', value: data.consultantProfile?.certifications?.length || 0 },
              { label: 'Team Size', value: data.company?.team_size || '—' },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-center py-2.5">
                <span className="text-xs text-slate-500 font-semibold">{row.label}</span>
                <span className="text-sm font-bold text-slate-900">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          {[
            { href: '/consultant/marketplace', icon: Icons.search, bg: 'bg-blue-50', color: 'text-blue-600', title: 'Browse Projects', description: 'Find new advisory opportunities' },
            { href: '/consultant/reports', icon: Icons.barChart3, bg: 'bg-violet-50', color: 'text-violet-600', title: 'Practice Reports', description: 'Pipeline & delivery analytics' },
            { href: '/consultant/profile', icon: Icons.user, bg: 'bg-amber-50', color: 'text-amber-600', title: 'Update Profile', description: 'Improve match accuracy' },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.title} href={action.href} className="group">
                <div className={`${cardClass} p-5 flex items-center gap-4 hover:border-slate-300 hover:shadow-md transition-all`}>
                  <div className={cn('size-11 rounded-none flex items-center justify-center shrink-0 border border-slate-100 group-hover:scale-105 transition-transform', action.bg)}>
                    <Icon className={cn('size-5', action.color)} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#0b3b24] transition-colors">{action.title}</h4>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider mt-0.5">{action.description}</p>
                  </div>
                  <Icons.chevronRight className="size-4 text-slate-300 group-hover:text-[#0b3b24] transition-colors ml-auto shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
