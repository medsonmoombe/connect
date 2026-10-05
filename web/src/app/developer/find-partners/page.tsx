/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { projectService } from '@/services/projects';
import { matchingApi } from '@/services/api';
import { Project } from '@/types';
import { FindPartnersEngine } from '@/components/developer/FindPartnersEngine';
import { PartnerSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

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

const STAGE_ORDER = [
  'CONCEPT', 'PRE_FEASIBILITY', 'FULL_FEASIBILITY', 'REGULATORY_APPROVAL',
  'PPA_READY', 'FINANCIAL_CLOSE', 'CONSTRUCTION', 'OPERATION',
] as const;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:        { label: 'Draft',        color: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-100' },
  scoring:      { label: 'Scoring',      color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
  pending_live: { label: 'Pending Live', color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
  live:         { label: 'Live',         color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  deactivated:  { label: 'Deactivated',  color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-100' },
};

export default function FindPartnersPage() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const selectedProjectIdParam = searchParams.get('project');

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [capMatches, setCapMatches] = useState<any[]>([]);
  const [techMatches, setTechMatches] = useState<any[]>([]);
  const [consultMatches, setConsultMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  useEffect(() => {
    if (!user?.company_id) { setLoading(false); return; }
    projectService.getDeveloperProjects(user.company_id)
      .then(setProjects)
      .finally(() => setLoading(false));
  }, [user?.company_id]);

  const findPartnersProject = useMemo(() => {
    if (selectedProjectIdParam) return projects.find((p) => p.id === selectedProjectIdParam) || projects[0] || null;
    return projects[0] || null;
  }, [projects, selectedProjectIdParam]);

  useEffect(() => {
    async function fetchAllMatches() {
      if (!findPartnersProject) return;
      setLoadingMatches(true);
      try {
        const response = await matchingApi.getProjectMatches(findPartnersProject.id);
        const capData = response.data?.capital || [];
        const techData = response.data?.technical || [];
        const consultData = response.data?.consultant || [];
        if ((capData.length === 0 || techData.length === 0) && findPartnersProject.status === 'live') {
          try {
            await matchingApi.runForProject(findPartnersProject.id);
            const refreshed = await matchingApi.getProjectMatches(findPartnersProject.id);
            setCapMatches(refreshed.data?.capital || []);
            setTechMatches(refreshed.data?.technical || []);
            setConsultMatches(refreshed.data?.consultant || []);
            return;
          } catch (err) { console.error('[FindPartners] Matching run exception:', err); }
        }
        setCapMatches(capData);
        setTechMatches(techData);
        setConsultMatches(consultData);
      } catch (error) { console.error('Error fetching matches:', error); }
      finally { setLoadingMatches(false); }
    }
    if (findPartnersProject) fetchAllMatches();
  }, [findPartnersProject]);

  if (authLoading || loading) {
    return <div className="p-6"><PartnerSkeleton count={6} /></div>;
  }

  const project = findPartnersProject;
  const stageIdx = project ? STAGE_ORDER.indexOf(project.project_stage as any) : -1;
  const stageColor = project ? (STAGE_COLORS[project.project_stage as keyof typeof STAGE_COLORS] || STAGE_COLORS.CONCEPT) : null;
  const statusInfo = project ? (STATUS_CONFIG[project.status || 'draft'] || STATUS_CONFIG.draft) : null;
  const totalMatches = capMatches.length + techMatches.length + consultMatches.length;

  return (
    <div className="space-y-6">

      {/* ── Header Card ── */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">

        {/* Dark bar */}
        <div className="bg-[#0b3b24] px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold mb-1">Developer Workspace</p>
            <h1 className="text-xl font-bold text-white tracking-tight">Find Partners</h1>
            {project ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                {stageColor && (
                  <span className={cn('px-2 py-0.5 rounded-none text-[9px] font-bold tracking-wider border', stageColor.bg, stageColor.text, stageColor.border)}>
                    {project.project_stage?.replace(/_/g, ' ') || 'Concept'}
                  </span>
                )}
                {statusInfo && (
                  <span className={cn('px-2 py-0.5 rounded-none text-[9px] font-bold tracking-wider border', statusInfo.bg, statusInfo.color, statusInfo.border)}>
                    {statusInfo.label}
                  </span>
                )}
                <span className="text-[10px] font-bold text-emerald-200/70 tracking-wider">{project.name}</span>
                <span className="text-emerald-200/30">·</span>
                <span className="text-[10px] font-bold text-emerald-200/70 tracking-wider">{project.project_size_mw} MW</span>
                <span className="text-emerald-200/30">·</span>
                <span className="text-[10px] font-bold text-emerald-200/70 tracking-wider">{project.location_country}</span>
              </div>
            ) : (
              <p className="text-[10px] font-bold text-emerald-200/50 mt-1">Select a project to begin matching</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[9px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Matches</p>
            <p className="text-2xl font-extrabold text-white">{totalMatches}</p>
          </div>
        </div>

        {/* Stage pipeline bar */}
        {project && (
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
        )}

        {/* KPI strip */}
        {project && (
          <div className="grid grid-cols-3 divide-x divide-slate-100">
            <div className="px-6 py-3">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Stage</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{project.project_stage?.replace(/_/g, ' ')}</p>
            </div>
            <div className="px-6 py-3">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Capital Required</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">${(project.capital_required / 1_000_000).toFixed(1)}M</p>
            </div>
            <div className="px-6 py-3">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Readiness</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {project.scores?.capital_readiness_score ? `${project.scores.capital_readiness_score}%` : '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Engine ── */}
      <FindPartnersEngine
        projects={projects}
        findPartnersProject={findPartnersProject}
        capMatches={capMatches}
        techMatches={techMatches}
        consultMatches={consultMatches}
        loadingMatches={loadingMatches}
      />
    </div>
  );
}
