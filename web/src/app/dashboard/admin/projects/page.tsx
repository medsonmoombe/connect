'use client';

import { useState, useEffect, useRef } from 'react';
import * as ReactDOM from 'react-dom';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/ui/stat-card';
import { Drawer } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { projectsApi } from '@/services/api';
import { Project, ProjectStage } from '@/types';
import Link from 'next/link';
import { useAdminOverrideScore } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getReviewRecommendation } from '@/lib/review-intelligence';
import { ReviewRecommendationCard } from '@/components/ReviewRecommendationCard';

type StatusFilter = 'REVIEW_QUEUE' | 'ALL' | 'submitted' | 'under_review' | 'validated' | 'rejected' | 'draft' | 'archived';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All Projects' },
  { value: 'REVIEW_QUEUE', label: 'Review Queue' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'validated', label: 'Validated' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_BADGES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:                   { label: 'Draft',                  color: 'text-slate-500',   bg: 'bg-slate-50',    border: 'border-slate-100' },
  pending_internal_review: { label: 'Pending Internal Review', color: 'text-purple-600',  bg: 'bg-purple-50',   border: 'border-purple-100' },
  returned:                { label: 'Returned for Rework',    color: 'text-orange-600',  bg: 'bg-orange-50',   border: 'border-orange-100' },
  submitted:               { label: 'Submitted',              color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-100' },
  under_review:            { label: 'Under Review',           color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-100' },
  validated:               { label: 'Validated',              color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
  rejected:                { label: 'Rejected',               color: 'text-red-600',     bg: 'bg-red-50',      border: 'border-red-100' },
  archived:                { label: 'Archived',               color: 'text-slate-400',   bg: 'bg-slate-50',    border: 'border-slate-100' },
};

const STAGE_BADGES: Record<string, string> = {
  CONCEPT:         'bg-slate-50 text-slate-700 border-slate-100',
  FEASIBILITY:     'bg-blue-50 text-blue-700 border-blue-100',
  PERMITTING:      'bg-purple-50 text-purple-700 border-purple-100',
  FINANCIAL_CLOSE: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  CONSTRUCTION:    'bg-orange-50 text-orange-700 border-orange-100',
  OPERATIONS:      'bg-green-50 text-green-700 border-green-100',
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
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
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <Icons.moreVertical className="size-4" />
      </button>
      {open && ReactDOM.createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999, transformOrigin: pos.origin }}
          className="w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 animate-in fade-in duration-150"
        >
          {items.map((item, i) => (
            <button
              key={i}
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onClick(); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
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

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('REVIEW_QUEUE');

  // Stats
  const [stats, setStats] = useState({ submitted: 0, under_review: 0, validated: 0, rejected: 0, draft: 0 });

  // Drawer
  const [selected, setSelected] = useState<Project | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Confirm dialogs
  const [confirmReview, setConfirmReview] = useState(false);
  const [confirmValidate, setConfirmValidate] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);

  const { mutateAsync: overrideScore, isPending: overridingScore } = useAdminOverrideScore();
  const [scoreOverrides, setScoreOverrides] = useState({ capital_readiness_score: 0, technical_readiness_score: 0 });
  const [scoreNote, setScoreNote] = useState('');
  const [showScoreDrawer, setShowScoreDrawer] = useState(false);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const isReviewQueue = statusFilter === 'REVIEW_QUEUE';
      const response = await projectsApi.getAdminAll({
        search: search || undefined,
        status: isReviewQueue || statusFilter === 'ALL' ? undefined : statusFilter,
      });
      if (response.data && isReviewQueue) {
        response.data = (response.data as Project[]).filter(
          (p) => (p as any).status === 'submitted' || (p as any).status === 'under_review'
        );
      }
      if (response.data) {
        setProjects(response.data);
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
      const statuses: StatusFilter[] = ['submitted', 'under_review', 'validated', 'rejected', 'draft'];
      const results = await Promise.all(statuses.map(s => projectsApi.getAdminAll({ status: s })));
      setStats({
        submitted: results[0].data?.length ?? 0,
        under_review: results[1].data?.length ?? 0,
        validated: results[2].data?.length ?? 0,
        rejected: results[3].data?.length ?? 0,
        draft: results[4].data?.length ?? 0,
      });
    } catch {}
  };

  useEffect(() => { fetchProjects(); }, [statusFilter]);
  useEffect(() => { fetchStats(); }, []);

  const openDrawer = (project: Project) => {
    setSelected(project);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelected(null);
    setRejectReason('');
    setConfirmReview(false);
    setConfirmValidate(false);
    setConfirmReject(false);
    setConfirmArchive(false);
  };

  const handleReview = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await projectsApi.review(selected.id);
      toast.success('Project moved to Under Review');
      closeDrawer();
      fetchProjects();
      fetchStats();
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const handleValidate = async () => {
    if (!selected) return;
    const recommendation = getReviewRecommendation(selected.scores);
    if (!selected.scores) {
      toast.error('Run AI analysis before validating this project.');
      return;
    }
    if (!recommendation.canValidate) {
      toast.error(recommendation.message);
      return;
    }
    setActing(true);
    try {
      await projectsApi.validate(selected.id);
      toast.success('Project validated — scoring triggered');
      closeDrawer();
      fetchProjects();
      fetchStats();
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) return;
    if (!selected.scores) {
      toast.error('Run AI analysis before rejecting this project.');
      return;
    }
    setActing(true);
    try {
      await projectsApi.reject(selected.id, rejectReason);
      toast.success('Project rejected');
      closeDrawer();
      fetchProjects();
      fetchStats();
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setActing(false);
    }
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

  const openScoreDrawer = (project: Project) => {
    setSelected(project);
    setScoreOverrides({
      capital_readiness_score: project.scores?.capital_readiness_score ?? 0,
      technical_readiness_score: project.scores?.technical_readiness_score ?? 0,
    });
    setScoreNote('');
    setShowScoreDrawer(true);
  };

  const reviewRecommendation = selected ? getReviewRecommendation(selected.scores) : null;

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
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="dash-section-label mb-1">Admin Projects</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Project Oversight</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Monitor and manage all energy projects across the platform.</p>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Submitted" value={stats.submitted} icon={Icons.send} valueClassName="text-blue-600" />
        <StatCard label="Under Review" value={stats.under_review} icon={Icons.eye} valueClassName="text-amber-600" />
        <StatCard label="Validated" value={stats.validated} icon={Icons.checkCircle2} valueClassName="text-emerald-600" />
        <StatCard label="Rejected" value={stats.rejected} icon={Icons.x} valueClassName="text-red-600" />
        <StatCard label="Draft" value={stats.draft} icon={Icons.fileText} valueClassName="text-slate-600" />
      </div>

      {/* ── Filters ──────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-10 pl-3 pr-8 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Icons.chevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative flex-1 max-w-sm ml-auto">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="Search by project name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchProjects(); }}
            className="pl-10 h-10 rounded-xl border-slate-200"
          />
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────── */}
      <div className="dash-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="dash-section-label mb-0.5">{STATUS_OPTIONS.find(t => t.value === statusFilter)?.label || 'All'}</p>
            <h3 className="text-sm font-semibold text-slate-900">Projects</h3>
          </div>
          <span className="text-xs text-slate-400">{isLoading ? '—' : `${projects.length} total`}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Developer</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stage</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Capital</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Created</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-6 py-3.5"><Skeleton className="h-4 w-40 rounded-lg" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-28 rounded-lg" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-5 w-24 rounded-full" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-5 w-28 rounded-full" /></td>
                    <td className="px-4 py-3.5 text-right"><Skeleton className="h-4 w-20 rounded-lg ml-auto" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-24 rounded-lg" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="size-7 rounded-lg ml-auto" /></td>
                  </tr>
                ))
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <Icons.folder className="size-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-500">No projects found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {statusFilter === 'REVIEW_QUEUE' ? 'All caught up — no projects pending review.' : 'Try a different filter or search term.'}
                    </p>
                  </td>
                </tr>
              ) : (
                projects.map((row) => {
                  const status = (row as any).status as string;
                  const st = STATUS_BADGES[status] || STATUS_BADGES.draft;
                  const stageClass = STAGE_BADGES[row.project_stage] || STAGE_BADGES.CONCEPT;
                  return (
                    <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-900 truncate">{row.name}</span>
                          <span className="text-xs text-slate-500">{row.technology_type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">{row.developer?.name || 'N/A'}</td>
                      <td className="px-4 py-3.5">
                        <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', stageClass)}>
                          {row.project_stage?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border', st.bg, st.color, st.border)}>
                          <span className="size-1.5 rounded-full bg-current" />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-slate-900 text-right">{formatCurrency(row.capital_required)}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-500">
                        {new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <RowMenu items={[
                          { label: 'View details', icon: <Icons.eye className="size-3.5" />, onClick: () => openDrawer(row) },
                          ...(status === 'submitted' ? [
                            { label: 'Start Review', icon: <Icons.eye className="size-3.5" />, onClick: () => { setSelected(row); setConfirmReview(true); } },
                            { label: 'Reject', icon: <Icons.x className="size-3.5" />, danger: true as const, onClick: () => { setSelected(row); setRejectReason(''); setConfirmReject(true); } },
                          ] : []),
                          ...(status === 'under_review' ? [
                            { label: 'Validate', icon: <Icons.checkCircle2 className="size-3.5" />, onClick: () => { setSelected(row); setConfirmValidate(true); } },
                            { label: 'Reject', icon: <Icons.x className="size-3.5" />, danger: true as const, onClick: () => { setSelected(row); setRejectReason(''); setConfirmReject(true); } },
                          ] : []),
                          ...(status === 'validated' ? [
                            { label: 'Archive', icon: <Icons.folder className="size-3.5" />, onClick: () => { setSelected(row); setConfirmArchive(true); } },
                          ] : []),
                          { label: 'Score Override', icon: <Icons.pencil className="size-3.5" />, onClick: () => openScoreDrawer(row) },
                        ]} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                <div key={label} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{value}</p>
                </div>
              ))}
            </div>

            {/* AI Score */}
            {selected.scores ? (
              <div className="p-4 rounded-xl bg-white border border-slate-200">
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
                    "{selected.scores.summary}"
                  </p>
                )}
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-3">
                  <div className="size-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
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
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                    >
                      <Icons.fileText className="size-4 text-slate-400 group-hover:text-primary shrink-0" />
                      <span className="text-[13px] font-semibold text-slate-700 group-hover:text-primary truncate flex-1">{doc.document_type}</span>
                      <Icons.arrowRight className="size-3 text-slate-300 group-hover:text-primary shrink-0" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-slate-400 font-medium">No documents uploaded.</p>
              )}
            </div>

            {/* Full page link */}
            <Link href={`/projects/${selected.id}`} target="_blank">
              <Button variant="outline" className="w-full h-10 rounded-xl border-slate-200 text-slate-600 font-semibold text-sm">
                <Icons.eye className="size-4 mr-2" />Open Full Project Page
              </Button>
            </Link>

            {reviewRecommendation && (selected as any).status === 'under_review' && (
              <ReviewRecommendationCard recommendation={reviewRecommendation} />
            )}

            {/* Quick actions */}
            <div className="border-t border-slate-100 pt-4 flex gap-2">
              {(selected as any).status === 'submitted' && (
                <>
                  <Button className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold" onClick={() => { setConfirmReview(true); }}>
                    <Icons.eye className="size-4 mr-2" />Start Review
                  </Button>
                  <Button variant="outline" className="h-11 px-4 rounded-xl border-red-200 text-red-600 font-bold hover:bg-red-50" onClick={() => { setRejectReason(''); setConfirmReject(true); }}>
                    <Icons.x className="size-4 mr-1.5" />Reject
                  </Button>
                </>
              )}
              {(selected as any).status === 'under_review' && (
                <>
                  <Button
                    className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    onClick={() => { setConfirmValidate(true); }}
                    disabled={!reviewRecommendation?.canValidate}
                    title={!reviewRecommendation?.canValidate ? 'Run AI analysis first or review low AI score' : undefined}
                  >
                    <Icons.check className="size-4 mr-2" />{reviewRecommendation?.canValidate ? 'Validate' : 'Run Analysis First'}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 px-4 rounded-xl border-red-200 text-red-600 font-bold hover:bg-red-50"
                    onClick={() => { setRejectReason(''); setConfirmReject(true); }}
                    disabled={!selected.scores}
                    title={!selected.scores ? 'Run AI analysis first' : undefined}
                  >
                    <Icons.x className="size-4 mr-1.5" />Reject
                  </Button>
                </>
              )}
              {(selected as any).status === 'validated' && (
                <Button variant="outline" className="flex-1 h-11 rounded-xl border-slate-200 text-slate-600 font-bold" onClick={() => { setConfirmArchive(true); }}>
                  <Icons.folder className="size-4 mr-2" />Archive
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Confirm: Start Review ─────────────────────────── */}
      <ConfirmDialog
        open={confirmReview}
        onClose={() => setConfirmReview(false)}
        onConfirm={handleReview}
        title="Start Review"
        description={`Start reviewing "${selected?.name}"? This moves it to "Under Review" status.`}
        confirmLabel="Start Review"
        confirmVariant="default"
        loading={acting}
      />

      {/* ── Confirm: Validate ─────────────────────────────── */}
      <ConfirmDialog
        open={confirmValidate}
        onClose={() => setConfirmValidate(false)}
        onConfirm={handleValidate}
        title="Validate Project"
        description={reviewRecommendation?.message || `Validate "${selected?.name}"? This makes it visible to partners.`}
        confirmLabel="Validate"
        confirmVariant="default"
        loading={acting}
      />

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

      {/* ── Reject Drawer ─────────────────────────────────── */}
      <Drawer
        open={confirmReject}
        onClose={() => { setConfirmReject(false); setRejectReason(''); }}
        title="Reject Project"
        description={`Provide a reason for rejecting "${selected?.name}" (sent via email).`}
        size="sm"
      >
        <div className="space-y-5">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain why this project is being rejected (min 10 characters)..."
            className="w-full h-28 px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
          />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-11 rounded-xl border-slate-200 font-bold" onClick={() => { setConfirmReject(false); setRejectReason(''); }}>
              Cancel
            </Button>
            <Button
              className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold"
              onClick={handleReject}
              disabled={acting || rejectReason.trim().length < 10}
            >
              {acting && <Icons.spinner className="size-4 animate-spin mr-1.5" />}
              Confirm Rejection
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
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Technical Readiness (0–100)</label>
              <Input
                type="number" min={0} max={100}
                value={scoreOverrides.technical_readiness_score}
                onChange={e => setScoreOverrides(s => ({ ...s, technical_readiness_score: Number(e.target.value) }))}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Override Note <span className="text-red-500">*</span></label>
            <textarea
              value={scoreNote}
              onChange={e => setScoreNote(e.target.value)}
              placeholder="Required — reason for manual score override..."
              className="w-full h-24 px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-11 rounded-xl border-slate-200 font-bold" onClick={() => setShowScoreDrawer(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 h-11 rounded-xl bg-green-800 hover:bg-green-700 text-white font-bold"
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
