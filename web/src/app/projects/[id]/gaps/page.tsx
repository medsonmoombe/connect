'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { projectService } from '@/services/projects';
import { Project } from '@/types';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { GapResolutionTracker } from '@/components/developer/GapResolutionTracker';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';

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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:        { label: 'Draft',        color: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-100' },
  scoring:      { label: 'Scoring',      color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
  pending_live: { label: 'Pending Live', color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
  live:         { label: 'Live',         color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  deactivated:  { label: 'Deactivated',  color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-100' },
};

export default function ProjectGapsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const p = await projectService.getProjectDetails(projectId);
        setProject(p);
        if (p.developer_id) {
          const all = await projectService.getDeveloperProjects(p.developer_id);
          setAllProjects(all);
        }
      } catch { /* project not found or no access */ }
      finally { setLoading(false); }
    }
    load();
  }, [projectId]);

  useEffect(() => {
    if (!loading && project && user) {
      const isOwner = project.developer_id === user.company_id || user.is_platform_admin;
      if (!isOwner) router.replace(`/projects/${projectId}`);
    }
  }, [loading, project, user]);

  if (loading) {
    return <div className="p-6"><TableSkeleton rows={4} cols={5} /></div>;
  }

  if (!project) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center px-4">
        <div className="size-16 bg-slate-100 flex items-center justify-center mx-auto mb-6">
          <Icons.fileText className="size-8 text-slate-300" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Project Not Found</h2>
        <p className="text-sm text-slate-500 mb-6">This project does not exist or you do not have access.</p>
        <Link href="/developer/projects" className="inline-flex items-center gap-2 h-9 px-5 rounded-none bg-green-800 text-white text-xs font-bold hover:bg-green-900 transition-colors">
          <Icons.arrowLeft className="size-3.5" /> Back
        </Link>
      </div>
    );
  }

  const stageIdx = STAGE_ORDER.indexOf(project.project_stage as (typeof STAGE_ORDER)[number]);
  const stageColor = STAGE_COLORS[project.project_stage as keyof typeof STAGE_COLORS] || STAGE_COLORS.CONCEPT;
  const statusInfo = STATUS_CONFIG[project.status || 'draft'] || STATUS_CONFIG.draft;
  const gapCount = (project.scores?.risk_flags?.length ?? 0);

  return (
    <div className="max-w-5xl mx-auto px-4  space-y-6 animate-in fade-in duration-300">

           <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors "
      >
        <Icons.arrowLeft className="size-3.5" /> Back
      </Link>

      {/* ── Project Header Card ── */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">

        {/* Dark header bar */}
        <div className="bg-[#0b3b24] px-6 py-4 flex items-start justify-between gap-4">
          
          <div className="min-w-0">
             {/* ── Back ── */}

            <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold mb-1">Gap Analysis</p>
            <h1 className="text-xl font-bold text-white tracking-tight truncate">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
              <span className={cn('px-2 py-0.5 rounded-none text-[9px] font-bold tracking-wider border', stageColor.bg, stageColor.text, stageColor.border)}>
                {project.project_stage?.replace(/_/g, ' ') || 'Concept'}
              </span>
              <span className={cn('px-2 py-0.5 rounded-none text-[9px] font-bold tracking-wider border', statusInfo.bg, statusInfo.color, statusInfo.border)}>
                {statusInfo.label}
              </span>
              <span className="text-[10px] font-bold text-emerald-200/70 tracking-wider">{project.project_size_mw} MW</span>
              <span className="text-emerald-200/30">·</span>
              <span className="text-[10px] font-bold text-emerald-200/70 tracking-wider">{project.location_country}</span>
              <span className="text-emerald-200/30">·</span>
              <span className="text-[10px] font-bold text-emerald-200/70 tracking-wider">${(project.capital_required / 1_000_000).toFixed(1)}M</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[9px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Gaps</p>
            <p className="text-2xl font-extrabold text-amber-300">{gapCount > 0 ? gapCount : '--'}</p>
          </div>
        </div>

        {/* Stage pipeline bar */}
        <div className="px-6 py-3 border-b border-slate-100">
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

        {/* Sibling nav */}
        <div className="px-6 py-2 flex items-center gap-1">
          {[
            { href: `/projects/${projectId}`,         label: 'Overview', icon: 'eye' as const },
            { href: `/projects/${projectId}/matches`,  label: 'Matches',  icon: 'search' as const },
            { href: `/projects/${projectId}/gaps`,     label: 'Gaps',     icon: 'fileSearch' as const, active: true },
            { href: `/projects/${projectId}/stages`,   label: 'Stages',   icon: 'layers' as const },
          ].map(tab => {
            const Icon = Icons[tab.icon];
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-3 rounded-none text-[10px] font-bold tracking-wider transition-all',
                  tab.active
                    ? 'bg-green-800 text-white'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                )}
              >
                <Icon className="size-3" /> {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Gap Resolution Tracker ── */}
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-6">
        <GapResolutionTracker
          projects={allProjects}
          selectedGapProject={projectId}
        />
      </div>
    </div>
  );
}
