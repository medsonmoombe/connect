'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { projectService } from '@/services/projects';
import { Project } from '@/types';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/ui/PageHero';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBanner } from '@/components/ui/StatusBanner';
import PageTitle from '@/components/PageTitle';
import { cn } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

// ── Stage Definitions ──────────────────────────────────────────────────────

const STAGE_ORDER = [
  'CONCEPT', 'PRE_FEASIBILITY', 'FULL_FEASIBILITY', 'REGULATORY_APPROVAL',
  'PPA_READY', 'FINANCIAL_CLOSE', 'CONSTRUCTION', 'OPERATION',
] as const;

const STAGE_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  CONCEPT:              { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-200', dot: 'bg-slate-400' },
  PRE_FEASIBILITY:      { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',  dot: 'bg-blue-500' },
  FULL_FEASIBILITY:     { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200', dot: 'bg-indigo-500' },
  REGULATORY_APPROVAL:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200', dot: 'bg-violet-500' },
  PPA_READY:            { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200',   dot: 'bg-cyan-500' },
  FINANCIAL_CLOSE:      { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  dot: 'bg-amber-500' },
  CONSTRUCTION:         { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',  dot: 'bg-green-500' },
  OPERATION:            { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-600' },
};

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  draft:           { label: 'Draft',                       tone: 'slate' },
  scoring:         { label: 'Analyzing',                   tone: 'blue' },
  scoring_retry:   { label: 'Re-analyzing',                tone: 'blue' },
  under_review:    { label: 'Under Regulator Review',      tone: 'amber' },
  pending_live:    { label: 'Pending Go-Live (legacy)',    tone: 'amber' },
  live:            { label: 'Live',                        tone: 'green' },
  deactivated:     { label: 'Deactivated',                 tone: 'red' },
};

type SortKey = 'date' | 'name' | 'score' | 'capital' | 'stage';

// ── Main Component ────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [filterStage, setFilterStage] = useState<string>('all');

  useEffect(() => {
    if (!user?.company_id) { setLoading(false); return; }
    projectService.getDeveloperProjects(user.company_id)
      .then(setProjects)
      .finally(() => setLoading(false));
  }, [user?.company_id]);

  const summary = useMemo(() => {
    const total = projects.length;
    const totalMw = projects.reduce((sum, p) => sum + (p.project_size_mw || 0), 0);
    const totalCapital = projects.reduce((sum, p) => sum + (p.capital_required || 0), 0);
    const scored = projects.filter(p => (p.scores?.capital_readiness_score ?? 0) > 0);
    const avgReadiness = scored.length > 0
      ? Math.round(scored.reduce((sum, p) => sum + (p.scores?.capital_readiness_score ?? 0), 0) / scored.length)
      : 0;
    const liveCount = projects.filter(p => p.status === 'live').length;
    const underReviewCount = projects.filter(p => p.status === 'under_review').length;
    const inProgressCount = projects.filter(p => ['under_review', 'scoring', 'scoring_retry'].includes(p.status || '')).length;
    const draftCount = projects.filter(p => p.status === 'draft').length;
    return { total, totalMw, totalCapital, avgReadiness, liveCount, underReviewCount, inProgressCount, draftCount };
  }, [projects]);

  const stages = useMemo(() =>
    Array.from(new Set(projects.map(p => p.project_stage).filter(Boolean))) as string[],
    [projects]
  );

  const filtered = useMemo(() => {
    return projects
      .filter(p => {
        if (filterStage !== 'all' && p.project_stage !== filterStage) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            p.name.toLowerCase().includes(q) ||
            p.location_country?.toLowerCase().includes(q) ||
            p.technology_type?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':    return a.name.localeCompare(b.name);
          case 'score':   return (b.scores?.capital_readiness_score || 0) - (a.scores?.capital_readiness_score || 0);
          case 'capital': return (b.capital_required || 0) - (a.capital_required || 0);
          case 'stage':   return STAGE_ORDER.indexOf(b.project_stage as any) - STAGE_ORDER.indexOf(a.project_stage as any);
          default:        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });
  }, [projects, search, sortBy, filterStage]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await projectService.deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch {
      alert('Failed to delete project');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="p-6">
        <div className="space-y-6">
          <div className="space-y-2"><div className="h-3 w-24 rounded bg-slate-100 animate-pulse" /><div className="h-7 w-32 rounded bg-slate-100 animate-pulse" /></div>
          <TableSkeleton rows={5} cols={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageTitle title="My Projects" />

      {/* ── Page Header (canonical dark-green) ─────────────── */}
      <PageHero
        eyebrow="Developer Portfolio"
        title="My Projects"
        description="Manage, track, and advance your infrastructure projects."
        actions={
          <Link href="/developer/submit">
            <Button className="h-9 px-4 bg-white text-[#0b3b24] hover:bg-emerald-50 border border-emerald-200/40 font-bold text-xs">
              <Icons.plus className="size-4 mr-1.5" /> New Project
            </Button>
          </Link>
        }
      />

      {/* ── KPI Strip ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiTile icon="folder"       label="Total Projects"  value={String(summary.total)}                                                                    color="blue" />
        <KpiTile icon="checkCircle2" label="Live"            value={String(summary.liveCount)}                                                                color="green" />
        <KpiTile icon="clock"        label="Under Review"    value={String(summary.inProgressCount)}                                                          color="amber" />
        <KpiTile icon="file"         label="Drafts"          value={String(summary.draftCount)}                                                               color="slate" />
        <KpiTile icon="zap"          label="Total Capacity"  value={`${summary.totalMw} MW`}                                                                  color="violet" />
        <KpiTile icon="barChart3"    label="Avg Readiness"   value={summary.avgReadiness > 0 ? `${summary.avgReadiness}%` : '—'}                              color={summary.avgReadiness >= 70 ? 'green' : summary.avgReadiness >= 40 ? 'amber' : 'slate'} />
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────── */}
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] px-5 py-3.5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Icons.search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full pl-10 pr-3 rounded-none border border-slate-200 text-sm bg-slate-50 text-slate-700 font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-green-600/20 transition-all"
          />
        </div>
        <select
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value)}
          className="h-9 px-3 rounded-none border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-green-600/20 transition-all"
        >
          <option value="all">All Stages</option>
          {stages.map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="h-9 px-3 rounded-none border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-green-600/20 transition-all"
        >
          <option value="date">Newest First</option>
          <option value="name">Name A–Z</option>
          <option value="score">Readiness Score</option>
          <option value="capital">Capital Required</option>
          <option value="stage">Stage Progress</option>
        </select>
        <span className="text-[10px] font-bold text-slate-400 tracking-widest ml-auto hidden sm:block">
          {filtered.length} of {projects.length} PROJECTS
        </span>
      </div>

      {/* ── Project Cards ───────────────────────────────────────────── */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={() => handleDelete(project.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-12 text-center">
          <div className="size-14 bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-4">
            <Icons.folder className="size-6 text-slate-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            {search || filterStage !== 'all' ? 'No Matching Projects' : 'No Projects Yet'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
            {search || filterStage !== 'all'
              ? 'Try adjusting your filters or search terms.'
              : 'Create your first infrastructure project to get started with the matching engine.'}
          </p>
          {!search && filterStage === 'all' && (
            <Link href="/developer/submit">
              <button className="h-9 px-5 rounded-none bg-green-800 text-white text-xs font-bold hover:bg-green-900 transition-colors flex items-center gap-2 mx-auto">
                <Icons.plus className="size-4" /> Create Project
              </button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ── KPI Tile ─────────────────────────────────────────────────────────────

function KpiTile({ icon, label, value, color }: { icon: keyof typeof Icons; label: string; value: string; color: string }) {
  const colorMap: Record<string, { bg: string; icon: string }> = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600' },
    green:  { bg: 'bg-green-50',  icon: 'text-green-600' },
    amber:  { bg: 'bg-amber-50',  icon: 'text-amber-600' },
    violet: { bg: 'bg-violet-50', icon: 'text-violet-600' },
    slate:  { bg: 'bg-slate-100', icon: 'text-slate-600' },
  };
  const c = colorMap[color] || colorMap.slate;
  const Icon = Icons[icon];
  return (
    <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-4">
      <div className={cn('size-8 rounded-none flex items-center justify-center mb-3', c.bg)}>
        <Icon className={cn('size-4', c.icon)} />
      </div>
      <p className="text-xl font-bold text-slate-950 tracking-tight">{value}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

// ── Project Card ─────────────────────────────────────────────────────────

function ProjectCard({ project, onDelete }: { project: Project; onDelete: () => void }) {
  const score = project.scores?.capital_readiness_score ?? 0;
  // Score is only visible if the API returned it (server already gates by
  // status). A non-null `project.scores` means the reviewer has either
  // approved (live) or returned with a comment (draft + rejection_reason).
  const scoreVisible = !!project.scores;
  const displayScore = scoreVisible ? score : 0;
  const stageIdx = STAGE_ORDER.indexOf(project.project_stage as any);
  const stageColor = STAGE_COLORS[project.project_stage as keyof typeof STAGE_COLORS] || STAGE_COLORS.CONCEPT;
  const statusInfo = STATUS_LABELS[project.status || 'draft'] || STATUS_LABELS.draft;
  const docCount = project.documents?.length ?? 0;
  const daysSince = Math.floor((Date.now() - new Date(project.created_at).getTime()) / 86400000);
  const reviewComment = (project as any).rejection_reason as string | undefined;

  const scoreTone = displayScore >= 70
    ? { text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', fill: 'bg-green-500' }
    : displayScore >= 40
    ? { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', fill: 'bg-amber-500' }
    : displayScore > 0
    ? { text: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-200',   fill: 'bg-red-500' }
    : { text: 'text-slate-400', bg: 'bg-slate-50',  border: 'border-slate-200', fill: 'bg-slate-300' };

  return (
    <div className="border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_30px_rgba(15,23,42,0.08)] transition-all duration-200 group overflow-hidden">

      {/* ── Header row: project name + status pill + readiness ── */}
      <div className="px-5 py-4 flex items-center justify-between gap-4 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <Icons.zap className="size-4 text-emerald-700" />
          </div>
          <div className="min-w-0">
            <Link href={`/projects/${project.id}`} className="block group/link">
              <h3 className="text-sm font-bold text-slate-900 group-hover/link:text-emerald-700 transition-colors truncate">
                {project.name}
              </h3>
            </Link>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5">
              <span className="text-[10px] font-bold text-slate-500 tracking-wider">{project.project_size_mw} MW</span>
              <span className="text-slate-300">·</span>
              <span className="text-[10px] font-bold text-slate-500 tracking-wider">{project.location_country}</span>
              {project.technology_type && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-[10px] font-bold text-slate-500 tracking-wider">{project.technology_type}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status + Score */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            'px-2.5 py-1 text-[10px] font-bold tracking-widest border',
            statusInfo.tone === 'green' ? 'bg-green-50 text-green-700 border-green-200'
            : statusInfo.tone === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200'
            : statusInfo.tone === 'blue'  ? 'bg-blue-50 text-blue-700 border-blue-200'
            : statusInfo.tone === 'red'   ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-slate-50 text-slate-700 border-slate-200'
          )}>
            {statusInfo.label}
          </span>
          <div className={cn('w-16 text-center border py-1.5', scoreTone.bg, scoreTone.border)}>
            <p className={cn('text-base font-extrabold leading-none', scoreTone.text)}>
              {scoreVisible && displayScore > 0 ? `${displayScore}%` : '—'}
            </p>
            <p className="text-[7px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
              {scoreVisible ? 'Readiness' : 'Pending'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Stage Pipeline ─────────────────────────────────────────── */}
      <div className="px-5 pt-3.5 pb-0">
        <div className="flex items-center gap-2 mb-2">
          <span className={cn(
            'px-2 py-0.5 rounded-none text-[9px] font-bold tracking-wider border',
            stageColor.bg, stageColor.text, stageColor.border
          )}>
            {project.project_stage?.replace(/_/g, ' ') || 'Concept'}
          </span>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider">
            Stage {stageIdx >= 0 ? stageIdx + 1 : 1} of 8
          </span>
          <span className="text-slate-300 mx-1">·</span>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider">{daysSince}d in portfolio</span>
        </div>
        <div className="flex items-center gap-0.5">
          {STAGE_ORDER.map((stage, idx) => (
            <div
              key={stage}
              className={cn('h-1.5 flex-1 rounded-full transition-all', idx <= stageIdx ? (STAGE_COLORS[stage]?.dot || 'bg-slate-400') : 'bg-slate-100')}
              title={stage.replace(/_/g, ' ')}
            />
          ))}
        </div>
      </div>

        {project.status === 'draft' && reviewComment && (
          <div className="px-5 pb-3">
            <StatusBanner
              variant="danger"
              label="Returned by reviewer"
              message={
                <>
                  <p className="whitespace-pre-wrap text-slate-700 font-medium">{reviewComment}</p>
                  <p className="text-[11px] text-slate-500 mt-1 font-normal">
                    Open the project to address the feedback, then resubmit. Your AI score is now visible.
                  </p>
                </>
              }
              actions={
                <Link
                  href={`/projects/${project.id}`}
                  className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Icons.refreshCw className="size-3.5" /> Open &amp; Edit
                </Link>
              }
            />
          </div>
        )}

        {project.status === 'under_review' && (
          <div className="px-5 pb-3">
            <StatusBanner
              variant="info"
              label="Under Regulator Review"
              message="Your project is being reviewed by the platform team / regulators. You will be notified once a decision is made."
            />
          </div>
        )}

        {/* ── Bottom: Info + Actions ─────────────────────────────────── */}
      <div className="px-5 py-3 mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100">
        <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider', docCount > 0 ? 'text-slate-600' : 'text-red-400')}>
          <Icons.file className="size-3.5" />
          {docCount > 0 ? `${docCount} document${docCount !== 1 ? 's' : ''}` : 'No documents'}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 tracking-wider">
          <Icons.target className="size-3.5" />
          ${(project.capital_required / 1_000_000).toFixed(0)}M target
        </span>
        {project.has_secured_land && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 tracking-wider">
            <Icons.shieldCheck className="size-3.5" /> Land Secured
          </span>
        )}
        {project.has_reached_financial_close && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 tracking-wider">
            <Icons.checkCircle2 className="size-3.5" /> Financial Close
          </span>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          {/* A plain draft (never submitted) is an unfinished application — make
              continuing it the first, primary action on the card. */}
          {project.status === 'draft' && !reviewComment && (
            <Link href={`/developer/submit?edit=${project.id}`}
              className="h-8 px-3 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1.5 transition-all">
              <Icons.play className="size-3" /> Continue application
            </Link>
          )}
          <Link href={`/projects/${project.id}`}
            className="h-8 px-3 rounded-none bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all flex items-center gap-1.5">
            <Icons.eye className="size-3" /> View
          </Link>
          <Link href={`/projects/${project.id}/matches`}
            className="h-8 px-3 rounded-none bg-green-50 border border-green-200 text-[10px] font-bold text-green-700 hover:bg-green-100 transition-all flex items-center gap-1.5">
            <Icons.search className="size-3" /> Match
          </Link>
          <Link href={`/projects/${project.id}/gaps`}
            className="h-8 px-3 rounded-none bg-blue-50 border border-blue-200 text-[10px] font-bold text-blue-700 hover:bg-blue-100 transition-all flex items-center gap-1.5">
            <Icons.fileSearch className="size-3" /> Gaps
          </Link>
          <Link href={`/projects/${project.id}/stages`}
            className="h-8 px-3 rounded-none bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700 hover:bg-amber-100 transition-all flex items-center gap-1.5">
            <Icons.layers className="size-3" /> Stages
          </Link>
          {scoreVisible && (project.scores?.capital_readiness_score ?? 0) < 40 && (project.scores?.capital_readiness_score ?? 0) > 0 && (
            <Link href={`/developer/consultation-request?project=${project.id}`}
              className="h-8 px-3 rounded-none bg-orange-50 border border-orange-200 text-[10px] font-bold text-orange-700 hover:bg-orange-100 transition-all flex items-center gap-1.5">
              <Icons.headphones className="size-3" /> Request Help
            </Link>
          )}
          <button
            onClick={(e) => { e.preventDefault(); onDelete(); }}
            className="h-8 px-2 rounded-none hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
            title="Delete project"
          >
            <Icons.trash className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
