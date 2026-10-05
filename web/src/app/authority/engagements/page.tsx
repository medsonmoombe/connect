'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { getStateLabel, getStateProgress, ENGAGEMENT_STATES } from '@/lib/engagement';
import PageTitle from '@/components/PageTitle';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAuth } from '@/hooks/useAuth';
import {
  Hero, HeroGhostButton, TabBar, SearchInput,
  EmptyState, TH_CLASS, TD_CLASS, StatusPill, CountChip, Badge, type Tone,
} from '@/components/ui/kit';
import type { EngagementStatus } from '@/types';

const STATUS_OPTIONS = ['ALL', 'INTRO_SENT', 'INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED', 'DROPPED'];

type EngagementRow = {
  id: string;
  status: string;
  counterparty_type: string;
  created_at: string;
  updated_at?: string | null;
  project?: {
    id: string;
    name: string;
    project_stage?: string;
    technology_type?: string;
    project_size_mw?: number;
    developer?: { id: string; name: string; country?: string | null } | null;
  } | null;
};

/** Engagement pipeline stage → kit badge tone. */
function stageTone(status: string): Tone {
  if (status === 'CLOSED') return 'green';
  if (status === 'DROPPED') return 'red';
  if (['INTRO_SENT', 'INTRO_ACCEPTED'].includes(status)) return 'amber';
  if (['NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET'].includes(status)) return 'blue';
  return 'brand';
}

export default function AuthorityEngagementsPage() {
  const [engagements, setEngagements] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const { user } = useAuth();

  // Debounce search — avoid an API call per keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      const res = await fetch(`/api/authority/engagements?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load engagements');
      setEngagements(json.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Could not load engagements');
    } finally {
      setLoading(false);
    }
  }, [status, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    total: engagements.length,
    active: engagements.filter(e => !['CLOSED', 'DROPPED'].includes(e.status)).length,
    closed: engagements.filter(e => e.status === 'CLOSED').length,
    dropped: engagements.filter(e => e.status === 'DROPPED').length,
  }), [engagements]);

  // Cumulative funnel — how far non-dropped engagements have progressed
  const funnel = useMemo(() => {
    const order = ENGAGEMENT_STATES.filter(s => s !== 'DROPPED') as string[];
    return order.map(state => {
      const idx = order.indexOf(state);
      const count = engagements.filter(e => {
        if (e.status === 'DROPPED') return false;
        return order.indexOf(e.status) >= idx;
      }).length;
      return { state, label: getStateLabel(state as EngagementStatus), count };
    });
  }, [engagements]);

  const exportCsv = () => {
    const rows = [
      ['Project', 'Developer', 'Counterparty Type', 'Status', 'Progress %', 'Created', 'Last Activity'],
      ...engagements.map(e => [
        e.project?.name ?? '',
        e.project?.developer?.name ?? '',
        e.counterparty_type.replace(/_/g, ' '),
        getStateLabel(e.status as EngagementStatus),
        String(getStateProgress(e.status as EngagementStatus)),
        new Date(e.created_at).toISOString().slice(0, 10),
        e.updated_at ? new Date(e.updated_at).toISOString().slice(0, 10) : '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `engagements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Engagements exported');
  };

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-500">
      <PageTitle title="Engagements" />

      <Hero
        eyebrow="Governance · Deal Flow"
        icon={Icons.messageSquare}
        title="Engagement Oversight"
        description="Monitor partnership progress across reviewed projects."
        actions={
          <>
            <HeroGhostButton onClick={exportCsv} className="px-3">
              <Icons.download className="size-4" /> CSV
            </HeroGhostButton>
            <HeroGhostButton onClick={load} className="px-3">
              <Icons.refreshCw className={cn('size-4', loading && 'animate-spin')} /> Refresh
            </HeroGhostButton>
          </>
        }
        stats={[
          { value: counts.total, label: 'Total engagements' },
          { value: counts.active, label: 'Active' },
          { value: counts.closed, label: 'Closed deals' },
          { value: counts.dropped, label: 'Dropped' },
        ].map(s => ({
          ...s,
          value: loading ? <span className="inline-block h-6 w-10 animate-pulse rounded bg-white/20" /> : s.value,
        }))}
      />

      {/* Pipeline funnel — clickable stage cards */}
      <SectionCard
        noHeader
        bodyClassName="p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-ink">Pipeline funnel</h3>
            <CountChip>{engagements.length}</CountChip>
          </div>
          <span className="text-[11px] font-semibold text-ink-3">cumulative · non-dropped</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          {funnel.map(({ state, label, count }) => {
            const max = funnel[0]?.count ?? 1;
            const pct = max === 0 ? 0 : Math.round((count / max) * 100);
            return (
              <button
                key={state}
                onClick={() => setStatus(state)}
                className={cn(
                  'group rounded-none border p-3 text-left transition-all',
                  status === state
                    ? 'border-brand/40 bg-brand-soft ring-1 ring-brand/25'
                    : 'border-line bg-white hover:border-line-strong hover:bg-surface-2',
                )}
              >
                <p className="text-lg font-bold tabular-nums text-ink">{count}</p>
                <p className="mt-0.5 text-[9.5px] font-bold uppercase leading-tight tracking-wider text-ink-3">{label}</p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <TabBar
          tabs={STATUS_OPTIONS.map(s => ({
            id: s,
            label: s === 'ALL' ? 'All' : getStateLabel(s as EngagementStatus),
          }))}
          active={status}
          onChange={setStatus}
        />
        <div className="flex items-center gap-2 lg:ml-auto">
          <SearchInput value={search} onChange={setSearch} placeholder="Search project or developer…" className="w-full sm:w-72" />
        </div>
      </div>

      {/* Table */}
      <SectionCard noHeader bodyClassName="">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className={TH_CLASS}>Project</th>
                <th className={TH_CLASS}>Developer</th>
                <th className={TH_CLASS}>Type</th>
                <th className={TH_CLASS}>Status</th>
                <th className={TH_CLASS}>Progress</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-[22px] py-12 text-center">
                    <Icons.spinner className="mx-auto size-5 animate-spin text-ink-3/50" />
                    <p className="mt-2 text-[13px] font-semibold text-ink-3">Loading engagements…</p>
                  </td>
                </tr>
              ) : engagements.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon="messageSquare" title="No engagements found" sub="Try a different filter or search term." />
                  </td>
                </tr>
              ) : (
                engagements.map(eng => {
                  const progress = getStateProgress(eng.status as any);
                  return (
                    <tr key={eng.id} className="transition-colors hover:bg-surface-2">
                      <td className={TD_CLASS}>
                        <Link href={`/engagements/${eng.id}`} className="group block">
                          <p className="max-w-[220px] truncate text-[13.5px] font-semibold text-ink group-hover:text-brand-text">{eng.project?.name || 'Unknown project'}</p>
                          <p className="mt-0.5 text-xs text-ink-3">{eng.project?.technology_type || '—'} · {eng.project?.project_size_mw ?? '—'} MW</p>
                        </Link>
                      </td>
                      <td className={TD_CLASS}>
                        <p className="truncate text-[13px] text-ink-2">{eng.project?.developer?.name || 'Unknown'}</p>
                        <p className="text-xs text-ink-3">{eng.project?.developer?.country || ''}</p>
                      </td>
                      <td className={TD_CLASS}>
                        <Badge tone="slate" className="capitalize">{eng.counterparty_type.replace(/_/g, ' ').toLowerCase()}</Badge>
                      </td>
                      <td className={TD_CLASS}>
                        <Badge tone={stageTone(eng.status)}>{getStateLabel(eng.status as EngagementStatus)}</Badge>
                      </td>
                      <td className={TD_CLASS}>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="w-8 text-right text-[11px] font-bold text-ink-2">{progress}%</span>
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
    </div>
  );
}
