'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { projectService } from '@/services/projects';
import { Project } from '@/types';
import { DataRoomTab } from '@/components/investor/DataRoomTab';
import { DataRoomSkeleton } from '@/components/ui/skeleton';
import { PageHero } from '@/components/ui/PageHero';
import { Icons } from '@/components/ui/icons';

export default function DataRoomPage() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const projectParam = searchParams.get('project');
  const requirementParam = searchParams.get('requirement');

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProjects = useCallback(async () => {
    if (!user?.company_id) return;
    const data = await projectService.getDeveloperProjects(user.company_id);
    setProjects(data);
  }, [user?.company_id]);

  useEffect(() => {
    if (!user?.company_id) { setLoading(false); return; }
    refreshProjects().finally(() => setLoading(false));
  }, [user?.company_id, refreshProjects]);

  if (authLoading || loading) {
    return <div className="p-6"><DataRoomSkeleton /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHero
        eyebrow="Developer Workspace"
        title="Data Room"
        description="Secure document vault for your project portfolio and partner sharing."
        actions={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/15 text-[10px] font-bold text-emerald-200 tracking-wider">
              <Icons.folder className="size-3" />
              {projects.length} Project{projects.length !== 1 ? 's' : ''}
            </span>
          </div>
        }
      />
      <DataRoomTab
        projects={projects}
        loading={loading}
        initialProjectId={projectParam || undefined}
        onDocumentsChanged={refreshProjects}
        requiredDocType={requirementParam || undefined}
      />
    </div>
  );
}
