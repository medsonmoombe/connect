'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Project } from '@/types';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

type SortKey = 'date' | 'name' | 'score' | 'capital' | 'stage';

const STAGE_ORDER = [
  'CONCEPT', 'PRE_FEASIBILITY', 'FULL_FEASIBILITY', 'REGULATORY_APPROVAL',
  'PPA_READY', 'FINANCIAL_CLOSE', 'CONSTRUCTION', 'OPERATION',
] as const;

const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CONCEPT:              { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-200' },
  PRE_FEASIBILITY:      { bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-100' },
  FULL_FEASIBILITY:     { bg: 'bg-indigo-50',   text: 'text-indigo-700',  border: 'border-indigo-100' },
  REGULATORY_APPROVAL:  { bg: 'bg-violet-50',   text: 'text-violet-700',  border: 'border-violet-100' },
  PPA_READY:            { bg: 'bg-cyan-50',     text: 'text-cyan-700',    border: 'border-cyan-100' },
  FINANCIAL_CLOSE:      { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-100' },
  CONSTRUCTION:         { bg: 'bg-green-50',    text: 'text-green-700',   border: 'border-green-100' },
  OPERATION:            { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
};

const STAGE_BG_COLORS = [
  'bg-slate-400', 'bg-blue-400', 'bg-indigo-400', 'bg-violet-400',
  'bg-cyan-400', 'bg-amber-400', 'bg-green-400', 'bg-emerald-600',
];

export function ProjectIntelligence({
  projects,
  loading,
  onDelete,
}: {
  projects: Project[];
  loading: boolean;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [filterStage, setFilterStage] = useState<string>('all');

  const stages = Array.from(
    new Set(projects.map((p) => p.project_stage).filter(Boolean))
  ) as string[];

  const filtered = useMemo(() => {
    return projects
      .filter((p) => {
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
          case 'name': return a.name.localeCompare(b.name);
          case 'score': return (b.scores?.capital_readiness_score || 0) - (a.scores?.capital_readiness_score || 0);
          case 'capital': return (b.capital_required || 0) - (a.capital_required || 0);
          case 'stage':
            return STAGE_ORDER.indexOf(b.project_stage as any) - STAGE_ORDER.indexOf(a.project_stage as any);
          case 'date':
          default:
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });
  }, [projects, search, sortBy, filterStage]);

  if (loading) {
    return (
      <div className="py-8 text-center bg-white rounded-none border border-slate-100">
        <Icons.spinner className="size-5 animate-spin mx-auto text-primary mb-2" />
        <p className="text-[11px] font-bold text-slate-400">Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="dash-section-label mb-0.5">Developer Portfolio</p>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Project Intelligence</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Deep view into each project's status, readiness, and partner interest.
          </p>
        </div>
        <Link href="/developer/submit">
          <button className="h-9 px-4 rounded-none bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5">
            <Icons.plus className="size-3.5" /> New Project
          </button>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, country, technology..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full pl-9 pr-3 rounded-none border border-slate-200 text-sm bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <SearchableSelect
          value={filterStage}
          onChange={(val) => setFilterStage(val)}
          options={[{ value: 'all', label: 'All Stages' }, ...stages.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))]}
          placeholder="Filter by stage..."
          className="w-48"
        />
        <SearchableSelect
          value={sortBy}
          onChange={(val) => setSortBy(val as SortKey)}
          options={[
            { value: 'date', label: 'Newest First' },
            { value: 'name', label: 'Name' },
            { value: 'score', label: 'Readiness Score' },
            { value: 'capital', label: 'Capital Required' },
            { value: 'stage', label: 'Stage Progress' },
          ]}
          placeholder="Sort by..."
          className="w-44"
        />
        <span className="text-[10px] font-bold text-slate-400 tracking-widest ml-auto">
          {filtered.length} of {projects.length}
        </span>
      </div>

      {/* Project Intelligence Cards */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((project) => (
            <ProjectIntelligenceCard
              key={project.id}
              project={project}
              onDelete={() => onDelete(project.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="folder"
          title={search || filterStage !== 'all' ? 'No Matching Projects' : 'No Projects Found'}
          description={
            search || filterStage !== 'all'
              ? 'Try adjusting your filters or search terms.'
              : "You haven't registered any infrastructure projects yet. Get started by creating your first one."
          }
          actionLabel={search || filterStage !== 'all' ? undefined : 'Create Project'}
          actionHref={search || filterStage !== 'all' ? undefined : '/developer/submit'}
        />
      )}
    </div>
  );
}

// ── Intelligence Card ────────────────────────────────────────────────────────
function ProjectIntelligenceCard({
  project,
  onDelete,
}: {
  project: Project;
  onDelete: () => void;
}) {
  const score = project.scores?.capital_readiness_score ?? 0;
  const stageIdx = STAGE_ORDER.indexOf(project.project_stage as any);
  const stageColor = STAGE_COLORS[project.project_stage as keyof typeof STAGE_COLORS] || STAGE_COLORS.CONCEPT;
  const docCount = project.documents?.length ?? 0;
  const scoreColor = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-red-500';
  const scoreBg = score >= 70 ? 'bg-green-50 border-green-100' : score >= 40 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100';

  // Compute days since creation
  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(project.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="p-5 rounded-none bg-white border border-slate-100 shadow-soft hover:shadow-md transition-all group">
      <div className="flex items-start gap-4">
        {/* Project Icon */}
        <div className="size-12 rounded-none bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <Icons.zap className="size-5 text-primary" />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/projects/${project.id}`} className="block">
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors truncate">
                  {project.name}
                </h4>
              </Link>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider flex items-center gap-1">
                  <Icons.zap className="size-3" />{project.project_size_mw} MW
                </span>
                <span className="text-[10px] font-bold text-slate-400 tracking-wider flex items-center gap-1">
                  <Icons.mapPin className="size-3" />{project.location_country}
                </span>
                <span className="text-[10px] font-bold text-slate-400 tracking-wider flex items-center gap-1">
                  <Icons.dollarSign className="size-3" />${(project.capital_required / 1000000).toFixed(1)}M
                </span>
                {project.technology_type && (
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider flex items-center gap-1">
                    <Icons.zap className="size-3" />{project.technology_type}
                  </span>
                )}
              </div>
            </div>
            {/* Score Badge */}
            <div className={cn('px-3 py-1.5 rounded-none border text-center shrink-0', scoreBg)}>
              <p className={cn('text-lg font-extrabold leading-none', scoreColor)}>
                {score > 0 ? `${score}%` : '--'}
              </p>
              <p className="text-[8px] font-bold text-slate-400 tracking-widest mt-0.5">READINESS</p>
            </div>
          </div>

          {/* Stage Pipeline */}
          <div className="mt-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={cn('px-2 py-0.5 rounded-none text-[9px] font-bold tracking-wider border', stageColor.bg, stageColor.text, stageColor.border)}>
                {project.project_stage?.replace(/_/g, ' ') || 'Draft'}
              </span>
              <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                {daysSinceCreation}d in portfolio
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              {STAGE_ORDER.map((stage, idx) => (
                <div
                  key={stage}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-all',
                    idx <= stageIdx ? STAGE_BG_COLORS[idx] : 'bg-slate-100'
                  )}
                  title={stage.replace(/_/g, ' ')}
                />
              ))}
            </div>
          </div>

          {/* Intelligence Row */}
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-50">
            {/* Document Status */}
            <div className="flex items-center gap-1.5">
              <Icons.file className="size-3.5 text-slate-400" />
              <span className={cn(
                'text-[10px] font-bold tracking-wider',
                docCount > 0 ? 'text-slate-600' : 'text-red-400'
              )}>
                {docCount > 0 ? `${docCount} doc${docCount > 1 ? 's' : ''}` : 'No docs'}
              </span>
            </div>

            {/* Capital Gap */}
            <div className="flex items-center gap-1.5">
              <Icons.trendingUp className="size-3.5 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-600 tracking-wider">
                ${(project.capital_required / 1000000).toFixed(0)}M target
              </span>
            </div>

            {/* Stage Position */}
            <div className="flex items-center gap-1.5">
              <Icons.layers className="size-3.5 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-600 tracking-wider">
                Stage {stageIdx >= 0 ? stageIdx + 1 : 1} of 8
              </span>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <Link
                href={`/projects/${project.id}`}
                className="h-8 px-3 rounded-none bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-600 hover:bg-primary hover:text-white hover:border-primary transition-all flex items-center gap-1"
              >
                <Icons.eye className="size-3" /> View
              </Link>
              <Link
                href={`/developer/find-partners?project=${project.id}`}
                className="h-8 px-3 rounded-none bg-primary/5 border border-primary/10 text-[10px] font-bold text-primary hover:bg-primary hover:text-white transition-all flex items-center gap-1"
              >
                <Icons.search className="size-3" /> Match
              </Link>
              <Link
                href={`/projects/${project.id}/gaps`}
                className="h-8 px-3 rounded-none bg-violet-50 border border-violet-100 text-[10px] font-bold text-violet-600 hover:bg-violet-600 hover:text-white transition-all flex items-center gap-1"
              >
                <Icons.fileSearch className="size-3" /> Gaps
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (confirm('Are you sure you want to delete this project?')) onDelete();
                }}
                className="h-8 px-2 rounded-none hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
              >
                <Icons.trash className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
