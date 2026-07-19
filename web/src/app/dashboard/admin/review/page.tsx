'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { projectsApi } from '@/services/api';
import { toast } from 'sonner';
import { Project } from '@/types';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending_live: { label: 'Pending Activation', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  scoring:      { label: 'Scoring',           color: 'text-blue-600',  bg: 'bg-blue-50',  border: 'border-blue-100' },
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function AdminReviewPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'scoring' | 'pending_live'>('all');

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const res = await projectsApi.getAdminAll({});
      if (res.data) {
        setProjects(
          (res.data as Project[]).filter(
            (p) => (p as any).status === 'scoring' || (p as any).status === 'pending_live'
          )
        );
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = projects.filter((p) => {
    const matchesStatus = statusFilter === 'all' || (p as any).status === statusFilter;
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const scoringCount = projects.filter((p) => (p as any).status === 'scoring').length;
  const pendingCount = projects.filter((p) => (p as any).status === 'pending_live').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="dash-section-label mb-1">Project Pipeline</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Review Queue</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {isLoading ? 'Loading...' : projects.length === 0
              ? 'No projects currently in the pipeline.'
              : `${projects.length} project${projects.length !== 1 ? 's' : ''} processing or awaiting activation.`}
          </p>
        </div>
        <Link href="/dashboard/admin/projects">
          <Button variant="outline" className="h-9 px-4 rounded-xl">
            <Icons.folder className="mr-2 size-4" /> All Projects
          </Button>
        </Link>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="flex gap-2 p-1.5 bg-white rounded-2xl border border-slate-100 shadow-sm w-fit">
          {([
            { id: 'all', label: 'All', count: projects.length },
            { id: 'scoring', label: 'Scoring', count: scoringCount },
            { id: 'pending_live', label: 'Pending', count: pendingCount },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                'px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2',
                statusFilter === tab.id
                  ? 'bg-green-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-600'
              )}
            >
              {tab.label}
              <span className={cn(
                'text-[10px] font-black px-1.5 py-0.5 rounded-md',
                statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm ml-auto">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="Search by project name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl border-slate-200"
          />
        </div>
      </div>

      {/* Project Cards */}
      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="dash-card p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-48 bg-slate-100 rounded" />
                  <div className="h-3 w-32 bg-slate-100 rounded" />
                  <div className="flex gap-2 mt-2">
                    <div className="h-6 w-20 bg-slate-100 rounded-full" />
                    <div className="h-6 w-24 bg-slate-100 rounded-full" />
                  </div>
                </div>
                <div className="h-9 w-24 bg-slate-100 rounded-xl self-start" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="dash-card p-16 text-center">
          <div className="size-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Icons.folder className="size-6 text-slate-300" />
          </div>
          <p className="text-sm font-bold text-slate-900 mb-1">
            {search ? 'No projects match your search.' : 'No projects in the pipeline.'}
          </p>
          <p className="text-xs text-slate-500 font-medium">
            {search ? 'Try a different search term.' : 'Projects appear here while scoring or awaiting activation.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((project) => {
            const status = (project as any).status as string;
            const st = STATUS_CONFIG[status] ?? STATUS_CONFIG.scoring;
            const score = project.scores?.capital_readiness_score ?? 0;

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="dash-card p-5 hover:border-slate-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border', st.bg, st.color, st.border)}>
                        <span className="size-1.5 rounded-full bg-current" />
                        {st.label}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {new Date(project.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <h3 className="text-[13px] font-bold text-slate-900 truncate">{project.name}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {project.developer?.name || 'Unknown org'} · {project.technology_type} · {project.project_stage?.replace(/_/g, ' ')}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-700">
                        <Icons.dollarSign className="size-3 text-primary" />{formatCurrency(project.capital_required)}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-700">
                        <Icons.mapPin className="size-3 text-primary" />{project.location_country}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-700">
                        <Icons.fileText className="size-3 text-primary" />{project.documents?.length ?? 0} doc{(project.documents?.length ?? 0) !== 1 ? 's' : ''}
                      </span>
                      {project.scores && (
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold',
                          score >= 60 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                          score >= 40 ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                        'bg-red-50 border-red-100 text-red-700'
                        )}>
                          <Icons.zap className="size-3" />AI Score: {score}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-4 rounded-xl text-xs font-bold"
                    >
                      <Icons.eye className="size-3.5 mr-1.5" /> View
                    </Button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
