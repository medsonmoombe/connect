'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { GRID_PROPS, AXIS_PROPS, BAR_RADIUS } from '@/lib/chart-theme';
import { ENGAGEMENT_STATES, getStateLabel } from '@/lib/engagement';
import { useConsultantData } from '@/hooks/useConsultantData';
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

export default function ConsultantReportsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useConsultantData({ engagements: true, matches: true });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'CONSULTANT' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Funnel: engagements per stage, in canonical order
  const funnel = useMemo(
    () =>
      ENGAGEMENT_STATES.map(state => ({
        state,
        label: getStateLabel(state).replace(/ /g, '\n'),
        count: data.engagements.filter(e => e.status === state).length,
      })),
    [data.engagements]
  );

  const totals = useMemo(() => {
    const total = data.engagements.length;
    const committed = data.engagements.filter(e => e.status === 'CAPITAL_COMMITTED' || e.status === 'CLOSED').length;
    const active = data.activeEngagements.length;
    const dropped = data.engagements.filter(e => e.status === 'DROPPED').length;
    return {
      total,
      committed,
      active,
      dropped,
      conversion: total > 0 ? Math.round((committed / total) * 100) : 0,
      strongMatches: data.matches.filter(m => (m.compatibility_score ?? 0) >= 75).length,
    };
  }, [data.engagements, data.activeEngagements, data.matches]);

  const activity = useMemo(
    () =>
      [...data.engagements]
        .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
        .slice(0, 20),
    [data.engagements]
  );

  const exportCsv = () => {
    if (data.engagements.length === 0) {
      toast.warning('No engagements to export yet.');
      return;
    }
    setExporting(true);
    try {
      const rows: (string | number)[][] = [
        ['Project', 'Status', 'Stage Progress %', 'Created', 'Last Updated'],
        ...data.engagements.map(e => [
          e.project?.name || 'Unknown',
          getStateLabel(e.status),
          e.status === 'DROPPED' ? 0 : e.status === 'CLOSED' ? 100 : '',
          new Date(e.created_at).toLocaleDateString(),
          new Date(e.updated_at || e.created_at).toLocaleDateString(),
        ]),
      ];
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `consultant-portfolio-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report exported.');
    } finally {
      setExporting(false);
    }
  };

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  const profile = data.consultantProfile;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Practice Reports" />
      <PageHero
        eyebrow="Analytics"
        title="Consulting performance & pipeline"
        description="How your advisory practice converts matches into engagements — funnel, conversion, capability record, and recent activity."
      />

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Engagements', value: totals.total, hint: 'all time' },
          { label: 'Active Pipeline', value: totals.active, hint: 'in progress now' },
          { label: 'Converted', value: totals.committed, hint: 'committed or closed' },
          { label: 'Conversion Rate', value: `${totals.conversion}%`, hint: 'of all engagements' },
        ].map(k => (
          <div key={k.label} className={cn(cardClass, 'p-4')}>
            <p className="text-xl font-bold text-slate-950 tracking-tight">{k.value}</p>
            <p className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{k.label}</p>
            <p className="text-[9px] font-semibold text-slate-300 mt-0.5">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Funnel chart */}
        <div className={cn(cardClass, 'overflow-hidden lg:col-span-2')}>
          <CardHeader
            eyebrow="Pipeline"
            title="Engagement funnel by stage"
            action={<span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{totals.total} engagements</span>}
          />
          <div className="p-5">
            {totals.total === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Icons.barChart3 className="mb-3 size-8 text-slate-200" />
                <p className="text-xs font-semibold text-slate-400">No engagements yet — your funnel will build here as mandates progress.</p>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnel} margin={{ top: 8, right: 8, left: -20, bottom: 24 }}>
                    <CartesianGrid {...GRID_PROPS} vertical={false} />
                    <XAxis
                      dataKey="state"
                      {...AXIS_PROPS}
                      tickFormatter={(v: string) => getStateLabel(v as any).split(' ')[0]}
                      angle={-30}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis {...AXIS_PROPS} allowDecimals={false} />
                    <Bar dataKey="count" fill="#0b3b24" radius={BAR_RADIUS} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Match quality + capability */}
        <div className="space-y-6">
          <div className={cn(cardClass, 'overflow-hidden')}>
            <CardHeader eyebrow="Matching" title="Match quality" />
            <div className="p-5 space-y-3">
              {[
                { label: 'Strong fits (≥75%)', value: totals.strongMatches, color: 'bg-green-500' },
                { label: 'Total scored matches', value: data.matches.length, color: 'bg-[#0b3b24]' },
                { label: 'Dropped engagements', value: totals.dropped, color: 'bg-rose-400' },
              ].map(row => (
                <div key={row.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500">{row.label}</span>
                    <span className="font-black text-slate-900">{row.value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-none bg-slate-100">
                    <div
                      className={cn('h-full rounded-none', row.color)}
                      style={{ width: `${data.matches.length > 0 || row.label === 'Dropped engagements' ? Math.min(100, row.value * 10) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={cn(cardClass, 'overflow-hidden')}>
            <CardHeader eyebrow="Capability" title="Practice record" />
            <div className="p-5 divide-y divide-slate-100">
              {[
                { label: 'Years of experience', value: `${profile?.years_of_experience || 0} yrs` },
                { label: 'Projects completed', value: profile?.total_projects_completed || 0 },
                { label: 'Largest project', value: `${profile?.largest_project_mw || 0} MW` },
                { label: 'Certifications', value: profile?.certifications?.length || 0 },
                { label: 'Service categories', value: profile?.service_categories?.length || 0 },
                { label: 'Availability', value: profile?.availability?.replace(/_/g, ' ') || '—' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-2.5">
                  <span className="text-xs font-semibold text-slate-500">{row.label}</span>
                  <span className="text-sm font-bold text-slate-900">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Activity table */}
      <div className={cn(cardClass, 'overflow-hidden')}>
        <CardHeader
          eyebrow="Activity"
          title="Recent engagement activity"
          action={
            <button
              onClick={exportCsv}
              disabled={exporting}
              className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-none border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <Icons.download className="size-3" />
              Export CSV
            </button>
          }
        />
        {activity.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-xs font-semibold text-slate-400">No activity yet — engagements will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line">
                  {['Project', 'Stage', 'Progress', 'Created', 'Last Updated'].map(h => (
                    <th key={h} className="px-[22px] py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activity.map(e => (
                  <tr key={e.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60">
                    <td className="max-w-52 truncate px-[22px] py-3 text-[13px] font-bold text-slate-900">
                      <Link href={`/engagements/${e.id}`} className="hover:text-[#0b3b24] hover:underline">
                        {e.project?.name || 'Project'}
                      </Link>
                    </td>
                    <td className="px-[22px] py-3 text-xs font-semibold text-slate-600">{getStateLabel(e.status)}</td>
                    <td className="px-[22px] py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-none bg-slate-100">
                          <div
                            className={cn('h-full rounded-none', e.status === 'DROPPED' ? 'bg-rose-400' : 'bg-[#0b3b24]')}
                            style={{ width: `${e.status === 'CLOSED' ? 100 : e.status === 'DROPPED' ? 0 : Math.max(12, (ENGAGEMENT_STATES.indexOf(e.status) / (ENGAGEMENT_STATES.length - 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">{ENGAGEMENT_STATES.indexOf(e.status) + 1}/{ENGAGEMENT_STATES.length}</span>
                      </div>
                    </td>
                    <td className="px-[22px] py-3 text-xs text-slate-500">{new Date(e.created_at).toLocaleDateString()}</td>
                    <td className="px-[22px] py-3 text-xs text-slate-500">{new Date(e.updated_at || e.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
