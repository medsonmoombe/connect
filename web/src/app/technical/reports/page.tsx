'use client';

import { useEffect, useMemo, useState } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { useTechnicalData } from '@/hooks/useTechnicalData';
import { EngagementStatus } from '@/types';

const STAGE_ORDER: EngagementStatus[] = ['INTRO_SENT', 'INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED', 'DROPPED'];
const STAGE_LABELS: Record<EngagementStatus, string> = {
  INTRO_SENT: 'Introduction sent',
  INTRO_ACCEPTED: 'Introduction accepted',
  NDA_SIGNED: 'NDA signed',
  DUE_DILIGENCE: 'Due diligence',
  TERM_SHEET: 'Term sheet',
  CONTRACT_SIGNED: 'Contract signed',
  CAPITAL_COMMITTED: 'Capital committed',
  CLOSED: 'Closed',
  DROPPED: 'Dropped',
};

export default function TechnicalReportsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useTechnicalData({ engagements: true, matches: true });
  const [exported, setExported] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'TECHNICAL_PARTNER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  const engagements = data.engagements;

  const funnel = useMemo(() => {
    const counts = new Map<EngagementStatus, number>();
    for (const s of STAGE_ORDER) counts.set(s, 0);
    for (const e of engagements) counts.set(e.status, (counts.get(e.status) ?? 0) + 1);
    const max = Math.max(1, ...counts.values());
    return STAGE_ORDER.map(s => ({ status: s, count: counts.get(s) ?? 0, pct: ((counts.get(s) ?? 0) / max) * 100 }));
  }, [engagements]);

  const derived = useMemo(() => {
    const withProject = engagements.filter(e => e.project);
    const capacity = withProject.reduce((s, e) => s + (e.project?.project_size_mw ?? 0), 0);
    const tech = new Map<string, number>();
    for (const e of withProject) {
      const t = e.project?.technology_type;
      if (t) tech.set(t, (tech.get(t) ?? 0) + 1);
    }
    const stages = new Map<string, number>();
    for (const e of withProject) {
      const st = e.project?.project_stage;
      if (st) stages.set(st, (stages.get(st) ?? 0) + 1);
    }
    const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { withProject: withProject.length, capacity, technologies: top(tech), stages: top(stages) };
  }, [engagements]);

  const profile = data.techProfile;

  const exportCsv = () => {
    const rows = [
      ['Project', 'Stage', 'Capacity (MW)', 'Engagement status', 'Started', 'Updated'],
      ...engagements.map(e => [
        e.project?.name ?? '—',
        e.project?.project_stage ?? '',
        e.project?.project_size_mw ? String(e.project.project_size_mw) : '',
        STAGE_LABELS[e.status] ?? e.status,
        e.created_at ? new Date(e.created_at).toISOString().slice(0, 10) : '',
        e.updated_at ? new Date(e.updated_at).toISOString().slice(0, 10) : '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `technical-delivery-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  const winRate = engagements.length > 0
    ? Math.round((engagements.filter(e => ['CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'].includes(e.status)).length / engagements.length) * 100)
    : 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Delivery Reports" />
      <PageHero
        eyebrow="Performance Analytics"
        title="Your engineering track record"
        description="Live reporting from your engagements and capability profile — conversion, capacity, and delivery health."
      />

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}

      

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <Icons.activity className="size-3.5 text-[#166b3b]" />
          Updated live from your engagement activity
        </div>
        <button
          onClick={exportCsv}
          disabled={engagements.length === 0}
          className="inline-flex h-9 items-center gap-2 rounded-none border border-slate-200 bg-white px-4 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {exported ? <Icons.check className="size-3.5 text-emerald-600" /> : <Icons.download className="size-3.5" />}
          {exported ? 'Exported' : 'Export CSV'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total engagements', value: engagements.length, icon: Icons.briefcase, tile: 'bg-slate-100 text-slate-600', accent: 'text-slate-900' },
          { label: 'Active pipeline', value: data.activeEngagements.length, icon: Icons.activity, tile: 'bg-[#e9f6ee] text-[#166b3b]', accent: 'text-[#166b3b]' },
          { label: 'Conversion rate', value: `${winRate}%`, icon: Icons.trendingUp, tile: 'bg-teal-50 text-teal-600', accent: 'text-teal-700' },
          { label: 'MW delivered (lifetime)', value: profile?.total_mw_delivered ?? 0, icon: Icons.zap, tile: 'bg-amber-50 text-amber-600', accent: 'text-amber-700' },
        ].map(({ label, value, icon: Icon, tile, accent }) => (
          <div key={label} className="rounded-none border border-line bg-white p-4 shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className={cn('mb-2.5 grid size-8 place-items-center rounded-none', tile)}>
              <Icon className="size-4" />
            </div>
            <p className={cn('text-xl font-black tracking-tight', accent)}>{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Icons.barChart className="size-4 text-[#166b3b]" />
            <p className="text-sm font-bold text-slate-900">Pipeline funnel</p>
          </div>
          <div className="space-y-3 p-5">
            {funnel.map(({ status, count, pct }) => (
              <div key={status} className="grid grid-cols-[150px_1fr_32px] items-center gap-3">
                <span className="truncate text-xs font-semibold text-slate-600">{STAGE_LABELS[status]}</span>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', status === 'DROPPED' ? 'bg-red-400' : status === 'CLOSED' ? 'bg-green-600' : 'bg-emerald-500/80')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-right text-xs font-black text-slate-800 tabular-nums">{count}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Capability + concentration */}
        <div className="space-y-6">
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icons.gauge className="size-4 text-[#166b3b]" />
              <p className="text-sm font-bold text-slate-900">Capability record</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-none border border-slate-100 bg-slate-50 p-4">
                <p className="text-lg font-black text-slate-900">{profile?.largest_project_mw ?? 0} MW</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Largest project</p>
              </div>
              <div className="rounded-none border border-slate-100 bg-slate-50 p-4">
                <p className="text-lg font-black text-slate-900">{profile?.average_delivery_time_months ?? 0} mo</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Avg delivery time</p>
              </div>
              <div className="rounded-none border border-slate-100 bg-slate-50 p-4">
                <p className="text-lg font-black text-slate-900">${(((profile?.bonding_capacity as number) || 0) / 1e6).toFixed(0)}M</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Bonding capacity</p>
              </div>
              <div className="rounded-none border border-slate-100 bg-slate-50 p-4">
                <p className="text-lg font-black text-slate-900">{profile?.annual_delivery_capacity_mw ?? 0} MW</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Annual capacity</p>
              </div>
            </div>
          </div>

          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icons.pieChart className="size-4 text-[#166b3b]" />
              <p className="text-sm font-bold text-slate-900">Engaged portfolio mix</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Technology</p>
                {derived.technologies.length === 0 && <p className="text-xs text-slate-400">No engaged projects yet</p>}
                <div className="space-y-2">
                  {derived.technologies.map(([t, n]) => (
                    <div key={t} className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-600">{t.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-black text-slate-800">{n}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Project stage</p>
                {derived.stages.length === 0 && <p className="text-xs text-slate-400">No engaged projects yet</p>}
                <div className="space-y-2">
                  {derived.stages.map(([s, n]) => (
                    <div key={s} className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-600">{s.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-black text-slate-800">{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {derived.capacity > 0 && (
              <p className="mt-3 text-[11px] leading-5 text-slate-400">
                Combined capacity across {derived.withProject} engaged project{derived.withProject === 1 ? '' : 's'}: <strong className="text-slate-600">{Math.round(derived.capacity)} MW</strong>.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Engagement table */}
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Icons.history className="size-4 text-[#166b3b]" />
            <p className="text-sm font-bold text-slate-900">Engagement activity</p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{engagements.length} engagements</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                {['Project', 'Stage', 'Capacity', 'Engagement status', 'Last updated'].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {engagements.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Icons.folder className="size-8 text-slate-200" />
                      <p className="text-sm font-bold text-slate-400">No engagements yet</p>
                      <p className="text-xs text-slate-400">Once you start conversations they will appear here.</p>
                    </div>
                  </td>
                </tr>
              )}
              {[...engagements]
                .sort((a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime())
                .slice(0, 20)
                .map(e => (
                  <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3 border-b border-slate-50">
                      <Link href={`/engagements/${e.id}`} className="text-xs font-bold text-[#0b3b24] hover:underline">
                        {e.project?.name ?? 'Project'}
                      </Link>
                    </td>
                    <td className="px-5 py-3 border-b border-slate-50 text-xs text-slate-600">{e.project?.project_stage?.replace(/_/g, ' ') ?? '—'}</td>
                    <td className="px-5 py-3 border-b border-slate-50 text-xs font-bold text-slate-700">{e.project?.project_size_mw ? `${e.project.project_size_mw} MW` : '—'}</td>
                    <td className="px-5 py-3 border-b border-slate-50 text-xs text-slate-600">{STAGE_LABELS[e.status] ?? e.status}</td>
                    <td className="px-5 py-3 border-b border-slate-50 text-xs text-slate-500">
                      {new Date(e.updated_at ?? e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
