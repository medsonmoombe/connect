'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { projectService } from '@/services/projects';
import { Project } from '@/types';
import { StageGateControl } from '@/components/developer/StageGateControl';
import { TableSkeleton } from '@/components/ui/skeleton';
import { PageHero } from '@/components/ui/PageHero';
import { Icons } from '@/components/ui/icons';

export default function ProjectStagesPage() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const projectParam = searchParams.get('project');

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStageProject, setSelectedStageProject] = useState<string | null>(projectParam);

  useEffect(() => {
    if (!user?.company_id) { setLoading(false); return; }
    projectService.getDeveloperProjects(user.company_id)
      .then(setProjects)
      .finally(() => setLoading(false));
  }, [user?.company_id]);

  useEffect(() => {
    if (projectParam && projects.length > 0) {
      setSelectedStageProject(projectParam);
    }
  }, [projectParam, projects]);

  if (authLoading || loading) {
    return <div className="p-6"><TableSkeleton rows={4} cols={5} /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHero
        eyebrow="Developer Workspace"
        title="Project Stages"
        description="Track project maturity from concept through construction and operation."
        actions={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/15 text-[10px] font-bold text-emerald-200 tracking-wider">
              <Icons.layers className="size-3" />
              {projects.length} Project{projects.length !== 1 ? 's' : ''}
            </span>
          </div>
        }
      />
      <StageGateControl
        projects={projects}
        selectedProject={selectedStageProject}
        onSelectProject={setSelectedStageProject}
      />
    </div>
  );
}
