'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Engagement } from '@/types';
import { getStateLabel, getStateProgress, ENGAGEMENT_STATES } from '@/lib/engagement';
import type { EngagementStatus } from '@/types';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { SectionCard } from '@/components/ui/SectionCard';
import { toast } from 'sonner';
import { useAdminOverrideEngagement } from '@/hooks/queries';

// ── Constants ────────────────────────────────────────────────────────────────

type StageFilter = 'ALL' | 'active' | 'terminal';

const PIPELINE_STATES = ENGAGEMENT_STATES.filter(s => s !== 'DROPPED');

function statusChipCls(status: string): string {
  switch (status) {
    case 'CLOSED':            return 'bg-green-50 text-green-700 border-green-200';
    case 'DROPPED':           return 'bg-red-50 text-red-600 border-red-100';
    case 'CAPITAL_COMMITTED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'CONTRACT_SIGNED':   return 'bg-teal-50 text-teal-700 border-teal-100';
    case 'TERM_SHEET':        return 'bg-cyan-50 text-cyan-700 border-cyan-100';
    case 'DUE_DILIGENCE':     return 'bg-violet-50 text-violet-700 border-violet-100';
    case 'NDA_SIGNED':        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    case 'INTRO_ACCEPTED':    return 'bg-blue-50 text-blue-700 border-blue-100';
    case 'INTRO_SENT':        return 'bg-amber-50 text-amber-700 border-amber-100';
    default:                  return 'bg-slate-50 text-slate-600 border-slate-100';
  }
}

const COUNTERPARTY_META: Record<string, { label: string; cls: string }> = {
  CAPITAL:        { label: 'Capital Partner',  cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  TECHNICAL:      { label: 'Technical Partner', cls: 'bg-purple-50 text-purple-700 border-purple-100' },
  CONSULTANT:     { label: 'Consultant',        cls: 'bg-slate-50 text-slate-700 border-slate-200' },
  GRANT_PROVIDER: { label: 'Grant Provider',    cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  POWER_TRADER:   { label: 'Power Trader',      cls: 'bg-pink-50 text-pink-700 border-pink-100' },
};

function counterpartyChip(type: string) {
  const meta = COUNTERPARTY_META[type] ?? { label: type, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 text-[10px] font-bold border', meta.cls)}>
      {meta.label}
    </span>
  );
}

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function daysOpen(dateStr: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

type EngagementRow = Engagement & {
  project?: { name?: string; developer?: { name?: string } | null };
  counterparty_name?: string | null;
};

// ── Building blocks (canonical admin style) ──────────────────────────────────

function KpiCard({ label, value, icon: Icon, accent, sub }: {
  label: string; value: number | string; icon: React.ElementType; accent?: string; sub?: string;
}) {
  return (
    <div className="border rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3 truncate">{label}</span>
        <Icon className="size-3.5 text-ink-3/50" />
      </div>
      <div className="px-4 py-3">
        <p className={cn('text-2xl font-bold tracking-tight', accent ?? 'text-slate-900')}>{value}</p>
        {sub && <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function MilestoneTimeline({ status }: { status: string }) {
  const dropped = status === 'DROPPED';
  const currentIdx = PIPELINE_STATES.indexOf(status as any);
  return (
    <div className="space-y-0">
      {PIPELINE_STATES.map((state, i) => {
        const reached = !dropped && currentIdx >= i;
        const isCurrent = !dropped && currentIdx === i;
        return (
          <div key={state} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={cn(
                'size-2.5 rounded-full border-2 shrink-0 my-1',
                isCurrent ? 'bg-brand border-brand ring-2 ring-brand/25'
                  : reached ? 'bg-brand border-brand'
                  : 'bg-white border-slate-300',
              )} />
              {i < PIPELINE_STATES.length - 1 && (
                <span className={cn('w-px flex-1 min-h-[14px]', reached && !dropped ? 'bg-brand' : 'bg-slate-200')} />
              )}
            </div>
            <p className={cn(
              'text-xs pb-3',
              isCurrent ? 'font-bold text-[#0b3b24]' : reached ? 'font-semibold text-slate-600' : 'font-medium text-slate-400',
            )}>
              {getStateLabel(state)}
              {isCurrent && <span className="ml-2 text-[9px] font-bold uppercase tracking-widest text-emerald-200/90 bg-brand text-white px-1.5 py-0.5">current</span>}
            </p>
          </div>
        );
      })}
      {dropped && (
        <div className="flex gap-3 items-center">
          <span className="size-2.5 rounded-full bg-red-500 shrink-0" />
          <p className="text-xs font-bold text-red-600">Dropped — engagement was terminated</p>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminEngagementsPage() {
  const [engagements, setEngagements] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<StageFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Detail drawer
  const [selected, setSelected] = useState<EngagementRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Override state
  const [overrideTarget, setOverrideTarget] = useState<EngagementRow | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<string>('DROPPED');
  const [overrideReason, setOverrideReason] = useState('');
  const { mutateAsync: overrideEngagement, isPending: overriding } = useAdminOverrideEngagement();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    async function fetchEngagements() {
      try {
        const { data, error } = await supabase
          .from('engagements')
          .select(`
            *,
            project:projects(name, developer:companies(name))
          `)
          .order('updated_at', { ascending: false });

        if (error) throw error;
        setEngagements(data || []);
      } catch (err) {
        console.error('Error fetching engagements:', err);
        toast.error('Failed to load engagements');
      } finally {
        setLoading(false);
      }
    }

    fetchEngagements();
  }, []);

  const updateLocalStatus = (id: string, status: string) => {
    setEngagements(prev => prev.map(e => (e.id === id ? { ...e, status: status as any, updated_at: new Date().toISOString() } : e)));
    setSelected(prev => (prev && prev.id === id ? { ...prev, status: status as any } : prev));
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = engagements.filter(e => e.status !== 'DROPPED' && e.status !== 'CLOSED');
    const closed = engagements.filter(e => e.status === 'CLOSED');
    const dropped = engagements.filter(e => e.status === 'DROPPED');
    const avgProgress = engagements.length > 0
      ? Math.round(engagements.filter(e => e.status !== 'DROPPED').reduce((acc, e) => acc + getStateProgress(e.status), 0) / Math.max(1, engagements.length - dropped.length))
      : 0;
    const avgDays = active.length > 0
      ? Math.round(active.reduce((acc, e) => acc + daysOpen(e.created_at), 0) / active.length)
      : 0;
    const stalled = active.filter(e => daysOpen(e.updated_at) >= 14).length;
    return { total: engagements.length, active: active.length, closed: closed.length, dropped: dropped.length, avgProgress, avgDays, stalled };
  }, [engagements]);

  const stageCounts = useMemo(() => {
    const active = engagements.filter(e => e.status !== 'DROPPED' && e.status !== 'CLOSED').length;
    return { ALL: engagements.length, active, terminal: engagements.length - active };
  }, [engagements]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: engagements.length };
    for (const t of Object.keys(COUNTERPARTY_META)) {
      counts[t] = engagements.filter(e => e.counterparty_type === t).length;
    }
    return counts;
  }, [engagements]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return engagements.filter(e => {
      if (stageFilter === 'active' && (e.status === 'DROPPED' || e.status === 'CLOSED')) return false;
      if (stageFilter === 'terminal' && e.status !== 'DROPPED' && e.status !== 'CLOSED') return false;
      if (typeFilter !== 'ALL' && e.counterparty_type !== typeFilter) return false;
      if (q) {
        const hay = `${e.project?.name ?? ''} ${(e.project as any)?.developer?.name ?? ''} ${e.counterparty_name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [engagements, stageFilter, typeFilter, debouncedSearch]);

  const funnel = useMemo(() => {
    const order: string[] = ['INTRO_SENT', 'INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'];
    const reachedCounts = order.map(state => {
      const idx = order.indexOf(state);
      return engagements.filter(e => {
        if (e.status === 'DROPPED') return false;
        const cur = order.indexOf(e.status);
        return cur >= idx;
      }).length;
    });
    return order.map((state, i) => ({ state, count: reachedCounts[i] }));
  }, [engagements]);

  // ── Override / revive ──────────────────────────────────────────────────────
  const isReviveMode = selectedOrTargetDropped(overrideTarget);

  function selectedOrTargetDropped(t: EngagementRow | null) {
    return t?.status === 'DROPPED';
  }

  const handleOverride = async () => {
    if (!overrideTarget || !overrideReason.trim()) return;
    try {
      await overrideEngagement(overrideTarget.id, overrideStatus, overrideReason);
      updateLocalStatus(overrideTarget.id, overrideStatus);
      toast.success(isReviveMode ? 'Engagement revived' : `Engagement ${overrideStatus.toLowerCase()}`);
      setOverrideTarget(null);
      setOverrideReason('');
    } catch (e: any) {
      toast.error(e.message || 'Override failed');
    }
  };

  const openOverride = (eng: EngagementRow) => {
    setOverrideTarget(eng);
    setOverrideReason('');
    setOverrideStatus(eng.status === 'DROPPED' ? 'NDA_SIGNED' : 'DROPPED');
  };

  const closeDetail = () => { setDetailOpen(false); setSelected(null); };

  const stageTabs: { value: StageFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'terminal', label: 'Closed / Dropped' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Milestone Pipelines" />
      <PageHero
        eyebrow="Admin · Engagements"
        title="Engagement Pipeline"
        description="Monitor active partnerships and project milestones across the platform."
      />

      {/* ── KPI Strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Engagements" value={stats.total} icon={Icons.messageSquare} />
        <KpiCard label="Active" value={stats.active} icon={Icons.activity} accent="text-blue-600" sub={`${stats.stalled} inactive 14+ days`} />
        <KpiCard label="Closed Deals" value={stats.closed} icon={Icons.checkCircle2} accent="text-green-700" sub={`${stats.dropped} dropped`} />
        <KpiCard label="Avg. Progress" value={`${stats.avgProgress}%`} icon={Icons.trendingUp} accent="text-[#0b3b24]" />
        <KpiCard label="Avg. Days Active" value={stats.avgDays} icon={Icons.clock} accent="text-amber-600" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ── Pipeline Funnel ──────────────────────────────────── */}
        <SectionCard
          eyebrow="Conversion"
          title="Pipeline Funnel"
          trailing={<span className="text-[10px] font-semibold text-g-600">cumulative · non-dropped</span>}
        >
          <div className="space-y-3">
            {funnel.map(({ state, count }) => {
              const max = funnel[0]?.count ?? 1;
              const width = max === 0 ? 0 : Math.max((count / max) * 100, count > 0 ? 4 : 0);
              return (
                <div key={state}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-slate-600">{getStateLabel(state as EngagementStatus)}</span>
                    <span className="text-xs font-extrabold text-slate-900 tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 overflow-hidden">
                    <div className="h-full bg-brand transition-all duration-700" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ── Filter & Search ──────────────────────────────────── */}
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] xl:col-span-2 overflow-hidden flex flex-col">
          <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
            <div className="flex items-center gap-2">
              <Icons.search className="size-3.5 text-g-600" />
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">Filter &amp; Search</p>
            </div>
            <span className="text-[11px] font-semibold text-g-600">
              {loading ? '—' : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="p-5 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by project, developer or counterparty..."
                className="w-full h-9 pl-10 pr-4 border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-800/10 focus:border-green-700 transition-colors"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                  <Icons.close className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setTypeFilter('ALL')}
                className={cn(
                  'h-8 px-3 text-[10px] font-bold uppercase tracking-widest border transition-all',
                  typeFilter === 'ALL' ? 'bg-brand border-brand text-white' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300',
                )}
              >
                All Types
              </button>
              {Object.entries(COUNTERPARTY_META).map(([type, meta]) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={cn(
                    'h-8 px-3 text-[10px] font-bold uppercase tracking-widest border transition-all',
                    typeFilter === type ? 'bg-brand border-brand text-white' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300',
                  )}
                >
                  {meta.label.replace(' Partner', '').replace(' Provider', '')}
                </button>
              ))}
            </div>
          </div>
          <div className="flex border-t border-slate-100 mt-auto">
            {stageTabs.map(tab => (
              <button key={tab.value} onClick={() => setStageFilter(tab.value)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[12px] font-bold border-b-2 transition-colors',
                  stageFilter === tab.value
                    ? 'border-green-800 text-green-800 bg-green-800/[0.03]'
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50',
                )}>
                {tab.label}
                <span className={cn(
                  'text-[10px] font-black px-1.5 py-0.5 min-w-[20px] text-center',
                  stageFilter === tab.value ? 'bg-green-800 text-white' : 'bg-slate-100 text-slate-500',
                )}>
                  {stageCounts[tab.value]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      <SectionCard
        eyebrow="Directory"
        title="All Engagements"
        trailing={<span className="text-[11px] font-semibold text-g-600">{loading ? '—' : `${filtered.length} of ${engagements.length}`}</span>}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 text-ink-3 text-[10.5px] font-extrabold uppercase tracking-[0.1em] border-b border-line">
                <th className="px-6 py-3">Project</th>
                <th className="px-4 py-3">Counterparty</th>
                <th className="px-4 py-3">Milestone Status</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Last Activity</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 w-48" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 w-28" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 w-24" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 w-20" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 w-16" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center">
                    <Icons.messageSquare className="size-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No engagements found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Try a different filter or search term.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((eng) => {
                  const progress = getStateProgress(eng.status);
                  const dropped = eng.status === 'DROPPED';
                  const closed = eng.status === 'CLOSED';
                  const terminal = dropped || closed;
                  const stalled = !terminal && daysOpen(eng.updated_at) >= 14;
                  return (
                    <tr key={eng.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <button onClick={() => { setSelected(eng); setDetailOpen(true); }} className="text-left group">
                          <span className="text-sm font-bold text-slate-900 group-hover:text-[#0b3b24] transition-colors block truncate max-w-[220px]">
                            {eng.project?.name || 'Unknown Project'}
                          </span>
                          <span className="text-xs text-slate-400 block truncate max-w-[220px]">
                            {(eng.project as any)?.developer?.name || 'Unknown Developer'}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          {counterpartyChip(eng.counterparty_type)}
                          {eng.counterparty_name && (
                            <span className="text-xs text-slate-500 truncate max-w-[140px]">{eng.counterparty_name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold border', statusChipCls(eng.status))}>
                          <span className="size-1.5 rounded-full bg-current" />
                          {getStateLabel(eng.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 h-1.5 overflow-hidden">
                            <div
                              className={cn('h-full transition-all', dropped ? 'bg-red-400' : closed ? 'bg-green-600' : 'bg-brand')}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-500 tabular-nums">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-500">{timeAgo(eng.updated_at || eng.created_at)}</span>
                          {stalled && (
                            <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider mt-0.5">Stalled 14d+</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/engagements/${eng.id}`}>
                            <button className="text-brand-text hover:text-brand-hover text-xs font-bold px-2 py-1.5 hover:bg-brand-soft transition-colors">
                              Monitor
                            </button>
                          </Link>
                          {!terminal && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-red-600 hover:bg-red-50 font-semibold"
                              onClick={() => openOverride(eng)}
                            >
                              Override
                            </Button>
                          )}
                          {dropped && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-[#0b3b24] hover:bg-brand-soft font-semibold"
                              onClick={() => openOverride(eng)}
                            >
                              Revive
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Detail Drawer ────────────────────────────────────── */}
      <Drawer
        open={detailOpen}
        onClose={closeDetail}
        title={selected?.project?.name ?? 'Engagement'}
        description={(selected?.project as any)?.developer?.name ?? ''}
        size="md"
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold border', statusChipCls(selected.status))}>
                <span className="size-1.5 rounded-full bg-current" />
                {getStateLabel(selected.status)}
              </span>
              {counterpartyChip(selected.counterparty_type)}
              {selected.counterparty_name && (
                <span className="text-xs font-semibold text-slate-500">{selected.counterparty_name}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Developer', value: (selected.project as any)?.developer?.name || 'N/A' },
                { label: 'Progress', value: `${getStateProgress(selected.status)}%` },
                { label: 'Initiated', value: new Date(selected.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                { label: 'Days Open', value: `${daysOpen(selected.created_at)} days` },
                { label: 'Last Activity', value: timeAgo(selected.updated_at || selected.created_at) },
                { label: 'Engagement ID', value: selected.id.slice(0, 8) + '…' },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 bg-slate-50 border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{value}</p>
                </div>
              ))}
            </div>

            <div className="border border-slate-200 p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Milestone Timeline</p>
              <MilestoneTimeline status={selected.status as string} />
            </div>

            <div className="border-t border-slate-100 pt-4 flex gap-2">
              <Link href={`/engagements/${selected.id}`} className="flex-1">
                <Button variant="outline" className="w-full h-10 border-slate-200 text-slate-600 font-bold text-sm">
                  <Icons.eye className="size-4 mr-2" />Open Engagement
                </Button>
              </Link>
              {selected.status !== 'CLOSED' && selected.status !== 'DROPPED' && (
                <Button
                  variant="outline"
                  className="h-10 px-4 border-red-200 text-red-600 font-bold hover:bg-red-50"
                  onClick={() => openOverride(selected)}
                >
                  Override
                </Button>
              )}
              {selected.status === 'DROPPED' && (
                <Button
                  className="h-10 px-4 bg-brand hover:bg-brand-hover text-white font-bold"
                  onClick={() => openOverride(selected)}
                >
                  Revive
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Override / Revive Drawer ─────────────────────────── */}
      <Drawer
        open={!!overrideTarget}
        onClose={() => { setOverrideTarget(null); setOverrideReason(''); }}
        title={isReviveMode ? 'Revive Dropped Engagement' : 'Override Engagement'}
        description={overrideTarget?.project?.name ?? ''}
        size="sm"
      >
        <div className="space-y-5">
          {isReviveMode ? (
            <div className="p-3 bg-brand-soft border border-brand/20 flex items-start gap-2.5">
              <Icons.info className="size-4 text-[#0b3b24] shrink-0 mt-0.5" />
              <p className="text-xs text-slate-700 font-medium">
                This engagement was dropped. Reviving restores it to an earlier pipeline stage. Both parties will be notified with your reason.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 flex items-start gap-2.5">
              <Icons.alertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium">
                Overrides bypass the state machine and notify both parties with your reason. Use for dispute resolution only.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {isReviveMode ? 'Restore To Stage' : 'Force Status'}
            </label>
            {isReviveMode ? (
              <select
                value={overrideStatus}
                onChange={e => setOverrideStatus(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/20"
              >
                {PIPELINE_STATES.filter(s => s !== 'CLOSED').map(s => (
                  <option key={s} value={s}>{getStateLabel(s)}</option>
                ))}
              </select>
            ) : (
              <div className="flex gap-2">
                {(['DROPPED', 'CLOSED'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setOverrideStatus(s)}
                    className={cn(
                      'flex-1 py-2.5 text-xs font-bold border transition-all',
                      overrideStatus === s
                        ? s === 'DROPPED' ? 'bg-red-600 text-white border-red-600' : 'bg-green-800 text-white border-green-800'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300',
                    )}
                  >
                    {s === 'DROPPED' ? 'Drop' : 'Close'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reason <span className="text-red-500">*</span></label>
            <textarea
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="Required — both parties will be notified with this reason..."
              className="w-full h-24 px-4 py-3 border border-slate-200 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/20"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-10 font-bold" onClick={() => { setOverrideTarget(null); setOverrideReason(''); }}>
              Cancel
            </Button>
            <Button
              className={cn(
                'flex-1 h-10 font-bold text-white',
                isReviveMode ? 'bg-brand hover:bg-brand-hover' : 'bg-red-600 hover:bg-red-700',
              )}
              onClick={handleOverride}
              disabled={overriding || !overrideReason.trim()}
            >
              {overriding ? <Icons.spinner className="size-4 animate-spin" /> : isReviveMode ? 'Revive Engagement' : `Force ${overrideStatus === 'DROPPED' ? 'Drop' : 'Close'}`}
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
