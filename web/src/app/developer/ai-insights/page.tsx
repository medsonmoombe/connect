'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { projectService } from '@/services/projects';
import { Project } from '@/types';
import { AiInsightsDashboard } from '@/components/developer/AiInsightsDashboard';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { scoreAvailability } from '@/lib/score-visibility';

export default function AiInsightsPage() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const projectParam = searchParams.get('project');

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAiProject, setSelectedAiProject] = useState<string | null>(projectParam);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!user?.company_id) { setLoading(false); return; }
    projectService.getDeveloperProjects(user.company_id)
      .then(setProjects)
      .finally(() => setLoading(false));
  }, [user?.company_id]);

  useEffect(() => {
    if (projectParam && projects.length > 0) {
      setSelectedAiProject(projectParam);
    }
  }, [projectParam, projects]);

  const handleReanalyze = useCallback(async () => {
    const targetId = selectedAiProject || projects[0]?.id;
    if (!targetId || !user?.company_id) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/projects/${targetId}/analyze`, { method: 'POST' });
      if (!res.ok) {
        let message = 'Analysis failed';
        try {
          const body = await res.json();
          message = body?.error || message;
        } catch {}
        throw new Error(message);
      }
      const fresh = await projectService.getDeveloperProjects(user.company_id);
      setProjects(fresh);
    } catch (err) { console.error('Re-analysis failed:', err); }
    finally { setAnalyzing(false); }
  }, [selectedAiProject, projects, user?.company_id]);

  if (authLoading || loading) {
    return <div className="p-6"><DashboardSkeleton /></div>;
  }

  const selectedProject = projects.find((p) => p.id === selectedAiProject) || projects[0];

  // The API nulls `scores` while the readiness score is withheld, so a missing
  // score must never be rendered as 0 — this header used to show a bold "0%" for
  // every project that was simply still in review.
  const score = selectedProject?.scores?.capital_readiness_score ?? null;
  const scoreWithheld =
    !!selectedProject
    && score == null
    && scoreAvailability({
      status: selectedProject.status,
      hasRejectionReason: !!selectedProject.rejection_reason,
      hasScore: false,
    }) === 'hidden';

  return (
    <div className="space-y-6">
      {/* ── Header Card ── */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="bg-[#0b3b24] px-6 py-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-emerald-200/60 uppercase tracking-[0.13em] mb-1">Developer Workspace</p>
            <h1 className="text-xl font-bold text-white tracking-tight">AI Insights</h1>
            <p className="text-[11px] text-emerald-200/60 mt-1">
              {selectedProject
                ? `Document analysis, readiness scoring and risk assessment for ${selectedProject.name}`
                : 'Select a project to run AI analysis'}
            </p>
          </div>
          {selectedProject && (
            <div className="shrink-0 text-right">
              <p className="text-[9px] font-bold text-emerald-200/60 uppercase tracking-[0.13em]">Readiness</p>
              {score != null ? (
                <p className="text-2xl font-extrabold text-white">{score}%</p>
              ) : (
                <p className="text-xs font-bold text-emerald-200/80 mt-1.5">
                  {scoreWithheld ? 'Pending review' : 'Not available'}
                </p>
              )}
            </div>
          )}
        </div>
        {/* Project strip */}
        {selectedProject && (
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
            {[
              { label: 'Stage', value: selectedProject.project_stage?.replace(/_/g, ' ') || '—' },
              { label: 'Technology', value: selectedProject.technology_type?.replace(/_/g, ' ') || '—' },
              { label: 'Capacity', value: `${selectedProject.project_size_mw} MW` },
              { label: 'Documents', value: `${selectedProject.documents?.length ?? 0} files` },
            ].map((stat) => (
              <div key={stat.label} className="px-4 py-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">{stat.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <AiInsightsDashboard
        projects={projects}
        selectedProject={selectedAiProject}
        onSelectProject={setSelectedAiProject}
        onReanalyze={handleReanalyze}
        analyzing={analyzing}
      />
    </div>
  );
}
