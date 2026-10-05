'use client';

import { useState, useEffect, useRef } from 'react';
import * as ReactDOM from 'react-dom';
import { Button } from '@/components/ui/button';
import { DataTable, Column } from '@/components/ui/data-table';
import { Icons } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { projectsApi } from '@/services/api';
import { Project } from '@/types';
import Link from 'next/link';
import { useAdminOverrideScore } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { SectionCard } from '@/components/ui/SectionCard';

type StatusFilter = 'ALL' | 'draft' | 'pending_live' | 'live' | 'deactivated' | 'archived';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL',          label: 'All' },
  { value: 'draft',        label: 'Draft' },
  { value: 'pending_live', label: 'Pending Live' },
  { value: 'live',         label: 'Live' },
  { value: 'deactivated',  label: 'Deactivated' },
  { value: 'archived',     label: 'Archived' },
];

const STATUS_BADGES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:       { label: 'Draft',        color: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-100' },
  pending_live:{ label: 'Pending Live', color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
  live:        { label: 'Live',         color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  deactivated: { label: 'Deactivated',  color: 'text-red-500',     bg: 'bg-red-50',     border: 'border-red-100' },
  archived:    { label: 'Archived',     color: 'text-slate-400',   bg: 'bg-slate-50',   border: 'border-slate-100' },
};

const STAGE_BADGES: Record<string, string> = {
  CONCEPT:             'bg-slate-50 text-slate-700 border-slate-100',
  PRE_FEASIBILITY:     'bg-cyan-50 text-cyan-700 border-cyan-100',
  FULL_FEASIBILITY:    'bg-blue-50 text-blue-700 border-blue-100',
  REGULATORY_APPROVAL: 'bg-purple-50 text-purple-700 border-purple-100',
  PPA_READY:           'bg-teal-50 text-teal-700 border-teal-100',
  FINANCIAL_CLOSE:     'bg-yellow-50 text-yellow-700 border-yellow-100',
  CONSTRUCTION:        'bg-orange-50 text-orange-700 border-orange-100',
  OPERATION:           'bg-green-50 text-green-700 border-green-100',
};

function getStatusBadge(project: Project): { label: string; color: string; bg: string; border: string } {
  const status = (project as any).status as string;
  return STATUS_BADGES[status] || STATUS_BADGES.draft;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

// ── Building blocks (canonical admin style) ──────────────────────────────────

function KpiCard({ label, value, icon: Icon, accent, active, onClick }: {
  label: string; value: number | string; icon: React.ElementType;
  accent?: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={cn(
        'border bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden transition-all',
        onClick && 'cursor-pointer hover:shadow-[0_8px_30px_rgba(15,23,42,0.08)]',
        active ? 'border-brand ring-1 ring-brand/25 bg-brand-soft' : 'border-slate-200',
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3 truncate">{label}</span>
        <Icon className="size-3.5 text-ink-3/50" />
      </div>
      <div className="px-4 py-3">
        <p className={cn('text-2xl font-bold tracking-tight', accent ?? 'text-slate-900')}>{value}</p>
      </div>
    </div>
  );
}

function ScorePillar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = Math.min(100, (score / max) * 100);
  return (
    <div className="text-center">
      <div className="relative size-16 flex items-center justify-center mx-auto mb-1">
        <svg className="size-full -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-100" />
          <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5"
            strokeDasharray={163} strokeDashoffset={163 - (163 * pct) / 100}
            strokeLinecap="round" className={cn('transition-all duration-700', color)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-black text-slate-900 leading-none">{score}</span>
          <span className="text-[8px] font-bold text-slate-400">/{max}</span>
        </div>
      </div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
    </div>
  );
}

function RowMenu({ items }: {
  items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }[]
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number; origin: string }>({ top: 0, right: 0, origin: 'top' });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const MENU_HEIGHT = items.length * 36 + 8;

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < MENU_HEIGHT;
      setPos({
        top: openUp ? rect.top - MENU_HEIGHT : rect.bottom + 4,
        right: window.innerWidth - rect.right,
        origin: openUp ? 'bottom' : 'top',
      });
    }
    setOpen(v => !v);
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggle}
        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <Icons.moreVertical className="size-4" />
      </button>
      {open && ReactDOM.createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999, transformOrigin: pos.origin }}
          className="w-48 bg-white border border-slate-200 shadow-lg py-1 animate-in fade-in duration-150"
        >
          {items.map((item, i) => (
            <button
              key={i}
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onClick(); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors',
                item.disabled
                  ? 'text-slate-300 cursor-not-allowed'
                  : item.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Table columns ────────────────────────────────────────────────────────────

const columns: Column<Project>[] = [
  {
    key: 'project',
    header: 'Project',
    className: 'px-6',
    render: (row) => (
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-bold text-slate-900 truncate">{row.name}</span>
        <span className="text-xs text-slate-500">{row.technology_type}</span>
      </div>
    ),
  },
  {
    key: 'developer',
    header: 'Developer',
    render: (row) => <span className="text-sm text-slate-600">{row.developer?.name || 'N/A'}</span>,
  },
  {
    key: 'stage',
    header: 'Stage',
    render: (row) => {
      const stageClass = STAGE_BADGES[row.project_stage] || STAGE_BADGES.CONCEPT;
      return (
        <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', stageClass)}>
          {row.project_stage?.replace(/_/g, ' ')}
        </span>
      );
    },
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => {
      const st = getStatusBadge(row);
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border', st.bg, st.color, st.border)}>
          <span className="size-1.5 rounded-full bg-current" />
          {st.label}
        </span>
      );
    },
  },
  {
    key: 'capital',
    header: 'Capital',
    className: 'text-right',
    render: (row) => <span className="text-sm font-semibold text-slate-900">{formatCurrency(row.capital_required)}</span>,
  },
  {
    key: 'created',
    header: 'Created',
    render: (row) => (
      <span className="text-sm text-slate-500">
        {new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </span>
    ),
  },
];

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Stats
  const [stats, setStats] = useState({ draft: 0, pending_live: 0, live: 0, deactivated: 0, archived: 0 });

  // Drawer
  const [selected, setSelected] = useState<Project | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Confirm dialogs
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmForceLive, setConfirmForceLive] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmReactivate, setConfirmReactivate] = useState(false);
  const [acting, setActing] = useState(false);

  const [forceLiveNote, setForceLiveNote] = useState('');

  const { mutateAsync: overrideScore, isPending: overridingScore } = useAdminOverrideScore();
  const [scoreOverrides, setScoreOverrides] = useState({ capital_readiness_score: 0, technical_readiness_score: 0 });
  const [scoreNote, setScoreNote] = useState('');
  const [showScoreDrawer, setShowScoreDrawer] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchProjects = async (opts?: { search?: string; status?: StatusFilter }) => {
    const effectiveSearch = opts?.search ?? debouncedSearch;
    const effectiveStatus = opts?.status ?? statusFilter;
    setIsLoading(true);
    try {
      const response = await projectsApi.getAdminAll({
        search: effectiveSearch || undefined,
        status: effectiveStatus === 'ALL' ? undefined : effectiveStatus,
      });
      if (response.data) {
        setProjects(response.data as Project[]);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch stats for all statuses
  const fetchStats = async () => {
    try {
      const statuses: StatusFilter[] = ['draft', 'pending_live', 'live', 'deactivated', 'archived'];
      const results = await Promise.all(statuses.map(s => projectsApi.getAdminAll({ status: s })));
      setStats({
        draft: results[0].data?.length ?? 0,
        pending_live: results[1].data?.length ?? 0,
        live: results[2].data?.length ?? 0,
        deactivated: results[3].data?.length ?? 0,
        archived: results[4].data?.length ?? 0,
      });
    } catch {}
  };

  useEffect(() => { fetchProjects(); }, [statusFilter, debouncedSearch]);
  useEffect(() => { fetchStats(); }, []);

  const totalCount = stats.draft + stats.pending_live + stats.live + stats.deactivated + stats.archived;
  const countFor = (s: StatusFilter) => (s === 'ALL' ? totalCount : stats[s as keyof typeof stats]);

  const openDrawer = (project: Project) => {
    setSelected(project);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelected(null);
    setConfirmArchive(false);
    setConfirmForceLive(false);
    setConfirmDeactivate(false);
    setConfirmReactivate(false);
    setForceLiveNote('');
  };

  const buildMenuItems = (row: Project) => {
    const status = (row as any).status as string;
    return [
      { label: 'View details', icon: <Icons.eye className="size-3.5" />, onClick: () => openDrawer(row) },
      ...(status === 'pending_live' ? [
        { label: 'Force Live Now', icon: <Icons.zap className="size-3.5" />, onClick: () => { setSelected(row); setForceLiveNote(''); setConfirmForceLive(true); } },
      ] : []),
      ...(status === 'live' ? [
        { label: 'Deactivate', icon: <Icons.eyeOff className="size-3.5" />, danger: true as const, onClick: () => { setSelected(row); setConfirmDeactivate(true); } },
        { label: 'Archive', icon: <Icons.folder className="size-3.5" />, onClick: () => { setSelected(row); setConfirmArchive(true); } },
      ] : []),
      ...(status === 'deactivated' ? [
        { label: 'Reactivate', icon: <Icons.eye className="size-3.5" />, onClick: () => { setSelected(row); setConfirmReactivate(true); } },
        { label: 'Archive', icon: <Icons.folder className="size-3.5" />, onClick: () => { setSelected(row); setConfirmArchive(true); } },
      ] : []),
      ...(status === 'archived' ? [
        { label: 'Reactivate', icon: <Icons.eye className="size-3.5" />, onClick: () => { setSelected(row); setConfirmReactivate(true); } },
      ] : []),
      { label: 'Score Override', icon: <Icons.pencil className="size-3.5" />, onClick: () => openScoreDrawer(row) },
    ];
  };

  const handleArchive = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await projectsApi.archive(selected.id);
      toast.success('Project archived');
      closeDrawer();
      fetchProjects();
      fetchStats();
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const handleForceLive = async () => {
    if (!selected || !forceLiveNote.trim()) return;
    setActing(true);
    try {
      const res = await projectsApi.adminForceLive(selected.id, forceLiveNote);
      if (res.error) throw new Error(res.error);
      toast.success('Project is now live and visible to investors');
      closeDrawer();
      fetchProjects();
      fetchStats();
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selected) return;
    setActing(true);
    try {
      const res = await projectsApi.adminForceState(selected.id, 'deactivated', 'Deactivated by admin');
      if (res.error) throw new Error(res.error);
      toast.success('Project deactivated');
      closeDrawer();
      fetchProjects();
      fetchStats();
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const handleReactivate = async () => {
    if (!selected) return;
    setActing(true);
    try {
      const res = await projectsApi.adminForceState(selected.id, 'live', 'Reactivated by admin');
      if (res.error) throw new Error(res.error);
      toast.success('Project reactivated');
      closeDrawer();
      fetchProjects();
      fetchStats();
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const openScoreDrawer = (project: Project) => {
    setSelected(project);
    setScoreOverrides({
      capital_readiness_score: project.scores?.capital_readiness_score ?? 0,
      technical_readiness_score: project.scores?.technical_readiness_score ?? 0,
    });
    setScoreNote('');
    setShowScoreDrawer(true);
  };

  const handleOverrideScore = async () => {
    if (!selected) return;
    try {
      await overrideScore(selected.id, scoreOverrides, scoreNote);
      toast.success('Scores updated');
      setShowScoreDrawer(false);
      fetchProjects();
    } catch (e: any) {
      toast.error(e.message || 'Score override failed');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Projects" />
      <PageHero
        eyebrow="Admin · Projects"
        title="Project Oversight"
        description="Monitor and manage all energy projects across the platform."
      />

      {/* ── KPI Strip (click a card to filter) ─────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Draft" value={stats.draft} icon={Icons.fileText} accent="text-slate-600"
          active={statusFilter === 'draft'} onClick={() => setStatusFilter('draft')} />
        <KpiCard label="Pending Live" value={stats.pending_live} icon={Icons.clock} accent="text-amber-600"
          active={statusFilter === 'pending_live'} onClick={() => setStatusFilter('pending_live')} />
        <KpiCard label="Live" value={stats.live} icon={Icons.eye} accent="text-emerald-600"
          active={statusFilter === 'live'} onClick={() => setStatusFilter('live')} />
        <KpiCard label="Deactivated" value={stats.deactivated} icon={Icons.eyeOff} accent="text-red-500"
          active={statusFilter === 'deactivated'} onClick={() => setStatusFilter('deactivated')} />
        <KpiCard label="Archived" value={stats.archived} icon={Icons.folder} accent="text-slate-400"
          active={statusFilter === 'archived'} onClick={() => setStatusFilter('archived')} />
      </div>

      {/* ── Filter & Search ────────────────────────────────────── */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <div className="flex items-center gap-2">
            <Icons.search className="size-3.5 text-g-600" />
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">Filter &amp; Search</p>
          </div>
          <span className="text-[11px] font-semibold text-g-600">
            {isLoading ? '—' : `${projects.length} result${projects.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="p-5 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects by name..."
              className="w-full h-9 pl-10 pr-4 border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-800/10 focus:border-green-700 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                <Icons.close className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex border-t border-slate-100 overflow-x-auto">
          {STATUS_OPTIONS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'flex-1 whitespace-nowrap flex items-center justify-center gap-2 px-4 py-3 text-[12px] font-bold border-b-2 transition-colors',
                statusFilter === tab.value
                  ? 'border-green-800 text-green-800 bg-green-800/[0.03]'
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              )}>
              {tab.label}
              <span className={cn(
                'text-[10px] font-black px-1.5 py-0.5 min-w-[20px] text-center',
                statusFilter === tab.value ? 'bg-green-800 text-white' : 'bg-slate-100 text-slate-500'
              )}>
                {countFor(tab.value)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────── */}
      <SectionCard
        eyebrow={STATUS_OPTIONS.find(t => t.value === statusFilter)?.label || 'All'}
        title="Projects"
        trailing={<span className="text-[11px] font-semibold text-g-600">{isLoading ? '—' : `${projects.length} total`}</span>}
        bodyClassName="p-0"
      >
        <DataTable
          columns={columns}
          data={projects}
          loading={isLoading}
          emptyTitle="No projects found"
          emptyDescription="Try a different filter or search term."
          rowKey={(p) => p.id}
          pageSize={50}
          actions={(row) => (
            <RowMenu items={buildMenuItems(row)} />
          )}
        />
      </SectionCard>

      {/* ── View Drawer ──────────────────────────────── */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={selected?.name ?? ''}
        description={selected?.developer?.name ?? ''}
        size="lg"
      >
        {selected && (
          <div className="space-y-5">
            {/* Status */}
            {(() => {
              const st = STATUS_BADGES[(selected as any).status] || STATUS_BADGES.draft;
              return (
                <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border', st.bg, st.color, st.border)}>
                  <span className="size-1.5 rounded-full bg-current" />{st.label}
                </span>
              );
            })()}

            {/* Summary grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Developer', value: selected.developer?.name || 'N/A' },
                { label: 'Technology', value: selected.technology_type || 'N/A' },
                { label: 'Stage', value: selected.project_stage?.replace(/_/g, ' ') || 'N/A' },
                { label: 'Location', value: `${selected.location_country}${selected.location_region ? `, ${selected.location_region}` : ''}` },
                { label: 'Capital Required', value: formatCurrency(selected.capital_required) },
                { label: 'Size', value: `${selected.project_size_mw} MW` },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 bg-slate-50 border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{value}</p>
                </div>
              ))}
            </div>

            {/* AI Score */}
            {selected.scores ? (
              <div className="p-4 bg-white border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">AI Readiness Score</p>
                <div className="flex justify-around">
                  <ScorePillar label="Regulatory" score={selected.scores.regulatory_score ?? 0} max={40} color="text-blue-500" />
                  <ScorePillar label="Financial"  score={selected.scores.financial_score ?? 0}  max={35} color="text-emerald-500" />
                  <ScorePillar label="Developer"  score={selected.scores.developer_score ?? 0}  max={25} color="text-amber-500" />
                  <div className="text-center">
                    <div className={cn(
                      'size-16 rounded-full flex items-center justify-center border-4 mx-auto mb-1',
                      (selected.scores.capital_readiness_score ?? 0) >= 60 ? 'border-emerald-400 bg-emerald-50' :
                      (selected.scores.capital_readiness_score ?? 0) >= 40 ? 'border-amber-400 bg-amber-50' :
                                                                              'border-red-400 bg-red-50'
                    )}>
                      <span className="text-lg font-black text-slate-900">{selected.scores.capital_readiness_score ?? 0}</span>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                  </div>
                </div>
                {selected.scores.summary && (
                  <p className="mt-4 text-xs text-slate-600 italic leading-relaxed border-t border-slate-100 pt-3">
                    &ldquo;{selected.scores.summary}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              <div className="p-5 bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-3">
                  <div className="size-8 bg-amber-100 flex items-center justify-center shrink-0">
                    <Icons.alertTriangle className="size-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900">No Analysis Yet</p>
                    <p className="text-xs text-amber-700 font-medium mt-0.5">
                      AI readiness scoring runs automatically when the project is submitted for review.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Documents */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Documents ({selected.documents?.length ?? 0})
              </p>
              {selected.documents && selected.documents.length > 0 ? (
                <div className="space-y-1.5">
                  {selected.documents.map((doc, i) => (
                    <a
                      key={i}
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 hover:border-brand/30 hover:bg-brand-soft transition-all group"
                    >
                      <Icons.fileText className="size-4 text-slate-400 group-hover:text-[#0b3b24] shrink-0" />
                      <span className="text-[13px] font-semibold text-slate-700 group-hover:text-[#0b3b24] truncate flex-1">{doc.document_type}</span>
                      <Icons.arrowRight className="size-3 text-slate-300 group-hover:text-[#0b3b24] shrink-0" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-slate-400 font-medium">No documents uploaded.</p>
              )}
            </div>

            {/* Full page link */}
            <Link href={`/projects/${selected.id}`} target="_blank" className="block">
              <Button variant="outline" className="w-full h-10 border-slate-200 text-slate-600 font-bold text-sm">
                <Icons.eye className="size-4 mr-2" />Open Full Project Page
              </Button>
            </Link>

            {/* Quick actions */}
            <div className="border-t border-slate-100 pt-4 flex gap-2">
              {(selected as any).status === 'pending_live' && (
                <Button
                  className="flex-1 h-10 bg-brand hover:bg-brand-hover text-white font-bold"
                  onClick={() => { setForceLiveNote(''); setConfirmForceLive(true); }}
                >
                  <Icons.zap className="size-4 mr-2" />Force Live Now
                </Button>
              )}
              {(selected as any).status === 'live' && (
                <>
                  <Button
                    variant="outline"
                    className="flex-1 h-10 border-red-200 text-red-600 font-bold hover:bg-red-50"
                    onClick={() => { setConfirmDeactivate(true); }}
                  >
                    <Icons.eyeOff className="size-4 mr-2" />Deactivate
                  </Button>
                  <Button variant="outline" className="h-10 px-4 border-slate-200 text-slate-600 font-bold" onClick={() => { setConfirmArchive(true); }}>
                    <Icons.folder className="size-4 mr-1.5" />Archive
                  </Button>
                </>
              )}
              {(selected as any).status === 'deactivated' && (
                <>
                  <Button
                    className="flex-1 h-10 bg-brand hover:bg-brand-hover text-white font-bold"
                    onClick={() => { setConfirmReactivate(true); }}
                  >
                    <Icons.eye className="size-4 mr-2" />Reactivate
                  </Button>
                  <Button variant="outline" className="h-10 px-4 border-slate-200 text-slate-600 font-bold" onClick={() => { setConfirmArchive(true); }}>
                    <Icons.folder className="size-4 mr-1.5" />Archive
                  </Button>
                </>
              )}
              {(selected as any).status === 'archived' && (
                <Button
                  className="flex-1 h-10 bg-brand hover:bg-brand-hover text-white font-bold"
                  onClick={() => { setConfirmReactivate(true); }}
                >
                  <Icons.eye className="size-4 mr-2" />Reactivate
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Confirm: Archive ──────────────────────────────── */}
      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={handleArchive}
        title="Archive Project"
        description={`Archive "${selected?.name}"? It will be removed from the marketplace.`}
        confirmLabel="Archive"
        confirmVariant="danger"
        loading={acting}
      />

      {/* ── Confirm: Deactivate ──────────────────────────── */}
      <ConfirmDialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={handleDeactivate}
        title="Deactivate Project"
        description={`Deactivate "${selected?.name}"? It will be hidden from investors and partners.`}
        confirmLabel="Deactivate"
        confirmVariant="danger"
        loading={acting}
      />

      {/* ── Confirm: Reactivate ──────────────────────────── */}
      <ConfirmDialog
        open={confirmReactivate}
        onClose={() => setConfirmReactivate(false)}
        onConfirm={handleReactivate}
        title="Reactivate Project"
        description={`Reactivate "${selected?.name}"? It will become live again.`}
        confirmLabel="Reactivate"
        confirmVariant="default"
        loading={acting}
      />

      {/* ── Force Live Drawer ─────────────────────────────────── */}
      <Drawer
        open={confirmForceLive}
        onClose={() => { setConfirmForceLive(false); setForceLiveNote(''); }}
        title="Force Project Live"
        description={`Bypass the activation delay for "${selected?.name}". This makes it immediately visible to investors.`}
        size="sm"
      >
        <div className="space-y-5">
          <div className="p-3 bg-amber-50 border border-amber-200 flex items-start gap-2.5">
            <Icons.alertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 font-medium">
              This skips the normal 1-business-day delay. Use only when the cron failed or the developer needs urgent activation.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reason <span className="text-red-500">*</span></label>
            <textarea
              value={forceLiveNote}
              onChange={(e) => setForceLiveNote(e.target.value)}
              placeholder="Why is this being force-activated? (e.g. cron failure, Friday submission, admin request)"
              className="w-full h-24 px-4 py-3 border border-slate-200 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/20"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-10 font-bold" onClick={() => { setConfirmForceLive(false); setForceLiveNote(''); }}>
              Cancel
            </Button>
            <Button
              className="flex-1 h-10 bg-amber-600 hover:bg-amber-500 text-white font-bold"
              onClick={handleForceLive}
              disabled={acting || forceLiveNote.trim().length < 5}
            >
              {acting && <Icons.spinner className="size-4 animate-spin mr-1.5" />}
              Confirm Force Live
            </Button>
          </div>
        </div>
      </Drawer>

      {/* ── Score Override Drawer ─────────────────────────── */}
      <Drawer
        open={showScoreDrawer}
        onClose={() => setShowScoreDrawer(false)}
        title="Override Score"
        description={selected?.name ?? ''}
        size="md"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Capital Readiness (0–100)</label>
              <Input
                type="number" min={0} max={100}
                value={scoreOverrides.capital_readiness_score}
                onChange={e => setScoreOverrides(s => ({ ...s, capital_readiness_score: Number(e.target.value) }))}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Technical Readiness (0–100)</label>
              <Input
                type="number" min={0} max={100}
                value={scoreOverrides.technical_readiness_score}
                onChange={e => setScoreOverrides(s => ({ ...s, technical_readiness_score: Number(e.target.value) }))}
                className="h-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Override Note <span className="text-red-500">*</span></label>
            <textarea
              value={scoreNote}
              onChange={e => setScoreNote(e.target.value)}
              placeholder="Required — reason for manual score override..."
              className="w-full h-24 px-4 py-3 border border-slate-200 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/20"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-10 font-bold" onClick={() => setShowScoreDrawer(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 h-10 bg-brand hover:bg-brand-hover text-white font-bold"
              onClick={handleOverrideScore}
              disabled={overridingScore || !scoreNote.trim()}
            >
              {overridingScore ? <Icons.spinner className="size-4 animate-spin mr-1.5" /> : null}
              Apply Override
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
