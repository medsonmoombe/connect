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
import { useFinancierData } from '@/hooks/useFinancierData';
import { Engagement, EngagementStatus } from '@/types';

const STATUS_META: Record<EngagementStatus, { label: string; bar: string; chip: string; dot: string }> = {
  INTRO_SENT: { label: 'Introduction sent', bar: 'bg-slate-300', chip: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  INTRO_ACCEPTED: { label: 'Introduction accepted', bar: 'bg-blue-400', chip: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  NDA_SIGNED: { label: 'NDA signed', bar: 'bg-cyan-400', chip: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' },
  DUE_DILIGENCE: { label: 'Due diligence', bar: 'bg-violet-400', chip: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  TERM_SHEET: { label: 'Term sheet', bar: 'bg-indigo-400', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  CONTRACT_SIGNED: { label: 'Contract signed', bar: 'bg-teal-400', chip: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  CAPITAL_COMMITTED: { label: 'Capital committed', bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  CLOSED: { label: 'Closed', bar: 'bg-green-600', chip: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-600' },
  DROPPED: { label: 'Dropped', bar: 'bg-red-400', chip: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
};

const STAGE_ORDER: EngagementStatus[] = ['INTRO_SENT', 'INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED', 'DROPPED'];

function money(n: number) {
  if (!n || !isFinite(n)) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

export default function InvestorReportsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useFinancierData({ engagements: true });
  const [exported, setExported] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'CAPITAL_PARTNER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  const engagements = data.engagements;

  const pipeline = useMemo(() => {
    const counts = new Map<EngagementStatus, number>();
    for (const s of STAGE_ORDER) counts.set(s, 0);
    for (const e of engagements) counts.set(e.status, (counts.get(e.status) ?? 0) + 1);
    const max = Math.max(1, ...counts.values());
    return STAGE_ORDER.map(s => ({ status: s, meta: STATUS_META[s], count: counts.get(s) ?? 0, pct: ((counts.get(s) ?? 0) / max) * 100 }));
  }, [engagements]);

  const derived = useMemo(() => {
    const withProject = engagements.filter(e => e.project);
    const capital = withProject.reduce((s, e) => s + (e.project?.capital_required ?? 0), 0);
    const capacity = withProject.reduce((s, e) => s + (e.project?.project_size_mw ?? 0), 0);
    const tech = new Map<string, number>();
    for (const e of withProject) {
      const t = e.project?.technology_type;
      if (t) tech.set(t, (tech.get(t) ?? 0) + 1);
    }
    const region = new Map<string, number>();
    for (const e of withProject) {
      const c = (e.project as any)?.location_country ?? (e.project as any)?.location_region;
      if (c) region.set(c, (region.get(c) ?? 0) + 1);
    }
    const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    return {
      withProject: withProject.length,
      capital,
      capacity,
      technologies: top(tech),
      regions: top(region),
    };
  }, [engagements]);

  const exportCsv = () => {
    const rows = [
      ['Project', 'Developer', 'Stage', 'Capital required', 'Capacity (MW)', 'Started', 'Updated'],
      ...engagements.map(e => [
        e.project?.name ?? '—',
        (e.project as any)?.developer?.name ?? '—',
        STATUS_META[e.status]?.label ?? e.status,
        e.project?.capital_required ? String(e.project.capital_required) : '',
        e.project?.project_size_mw ? String(e.project.project_size_mw) : '',
        e.created_at ? new Date(e.created_at).toISOString().slice(0, 10) : '',
        e.updated_at ? new Date(e.updated_at).toISOString().slice(0, 10) : '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `investor-portfolio-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  if (loading || !user) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  const activeCount = engagements.filter(e => e.status !== 'DROPPED' && e.status !== 'CLOSED').length;
  const committedCount = engagements.filter(e => e.status === 'CAPITAL_COMMITTED').length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Reports & Analytics" />
      <PageHero
        eyebrow="Portfolio Analytics"
        title="Your deal-flow performance"
        description="Live reporting built from your engagements — pipeline health, committed capital context, and where your deal flow is concentrated."
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
          className="inline-flex h-9 items-center gap-2 rounded-none border border-slate-200 bg-white px-4 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {exported ? <Icons.check className="size-3.5 text-emerald-600" /> : <Icons.download className="size-3.5" />}
          {exported ? 'Exported' : 'Export CSV'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total deals', value: engagements.length, icon: Icons.briefcase, accent: 'text-slate-900', tile: 'bg-slate-100 text-slate-600' },
          { label: 'Active pipeline', value: activeCount, icon: Icons.activity, accent: 'text-[#166b3b]', tile: 'bg-[#e9f6ee] text-[#166b3b]' },
          { label: 'Capital committed', value: committedCount, icon: Icons.checkCircle2, accent: 'text-emerald-700', tile: 'bg-emerald-50 text-emerald-600' },
          { label: 'Dropped', value: engagements.filter(e => e.status === 'DROPPED').length, icon: Icons.close, accent: 'text-red-600', tile: 'bg-red-50 text-red-500' },
        ].map(({ label, value, icon: Icon, accent, tile }) => (
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
        {/* Pipeline funnel */}
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Icons.barChart className="size-4 text-[#166b3b]" />
            <p className="text-sm font-bold text-slate-900">Pipeline funnel</p>
          </div>
          <div className="space-y-3 p-5">
            {pipeline.map(({ status, meta, count, pct }) => (
              <div key={status} className="grid grid-cols-[150px_1fr_32px] items-center gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn('size-2 rounded-full shrink-0', meta.dot)} />
                  <span className="truncate text-xs font-semibold text-slate-600">{meta.label}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-500', meta.bar)} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-right text-xs font-black text-slate-800 tabular-nums">{count}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Concentration + value */}
        <div className="space-y-6">
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icons.dollarSign className="size-4 text-[#166b3b]" />
              <p className="text-sm font-bold text-slate-900">Engaged deal value</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-none border border-slate-100 bg-slate-50 p-4">
                <p className="text-lg font-black text-slate-900">{money(derived.capital)}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Pipeline capital required</p>
              </div>
              <div className="rounded-none border border-slate-100 bg-slate-50 p-4">
                <p className="text-lg font-black text-slate-900">{derived.capacity > 0 ? `${Math.round(derived.capacity)} MW` : '—'}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Combined capacity</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-slate-400">
              Based on the {derived.withProject} engagement{derived.withProject === 1 ? '' : 's'} with full project context loaded. Update your mandate in your profile for the strongest recommendations.
            </p>
          </div>

          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icons.pieChart className="size-4 text-[#166b3b]" />
              <p className="text-sm font-bold text-slate-900">Concentration</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Technology mix</p>
                {derived.technologies.length === 0 && <p className="text-xs text-slate-400">No engaged projects yet</p>}
                <div className="space-y-2">
                  {derived.technologies.map(([t, n]) => (
                    <div key={t} className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-600 capitalize">{t.replace(/_/g, ' ').toLowerCase()}</span>
                      <span className="text-xs font-black text-slate-800">{n}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Geography</p>
                {derived.regions.length === 0 && <p className="text-xs text-slate-400">No location data yet</p>}
                <div className="space-y-2">
                  {derived.regions.map(([r, n]) => (
                    <div key={r} className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-600">{r.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-black text-slate-800">{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
                {['Project', 'Developer', 'Stage', 'Capital required', 'Last updated'].map(h => (
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
                .map(e => {
                  const meta = STATUS_META[e.status];
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3 border-b border-slate-50">
                        <Link href={`/engagements/${e.id}`} className="text-xs font-bold text-[#0b3b24] hover:underline">
                          {e.project?.name ?? 'Project'}
                        </Link>
                      </td>
                      <td className="px-5 py-3 border-b border-slate-50 text-xs text-slate-600">
                        {(e.project as any)?.developer?.name ?? '—'}
                      </td>
                      <td className="px-5 py-3 border-b border-slate-50">
                        <span className={cn('inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold', meta.chip)}>
                          <span className={cn('size-1.5 rounded-full', meta.dot)} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 border-b border-slate-50 text-xs font-bold text-slate-700">{money(e.project?.capital_required ?? 0)}</td>
                      <td className="px-5 py-3 border-b border-slate-50 text-xs text-slate-500">
                        {new Date(e.updated_at ?? e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
