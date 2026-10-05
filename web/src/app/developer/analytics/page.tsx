'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { projectService } from '@/services/projects';
import { engagementService } from '@/lib/engagement';
import { Project, Engagement } from '@/types';
import { PortfolioAnalytics } from '@/components/developer/PortfolioAnalytics';
import { AnalyticsSkeleton } from '@/components/ui/skeleton';

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.company_id) { setLoading(false); return; }
    Promise.all([
      projectService.getDeveloperProjects(user.company_id),
      engagementService.getCompanyEngagements(user.company_id),
    ]).then(([p, e]) => { setProjects(p); setEngagements(e); })
      .finally(() => setLoading(false));
  }, [user?.company_id]);

  if (authLoading || loading) {
    return <div className="p-6"><AnalyticsSkeleton /></div>;
  }

  const totalCapital = projects.reduce((acc, p) => acc + (p.capital_required || 0), 0);
  const totalCapacity = projects.reduce((acc, p) => acc + p.project_size_mw, 0);
  const avgReadiness = projects.length > 0
    ? Math.round(projects.reduce((acc, p) => acc + (p.scores?.capital_readiness_score || 0), 0) / projects.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* ── Header Card ── */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="bg-[#0b3b24] px-6 py-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold mb-1">Developer Workspace</p>
            <h1 className="text-xl font-bold text-white tracking-tight">Portfolio Analytics</h1>
            <p className="text-[11px] text-emerald-200/60 mt-1">
              Business intelligence, trends, and benchmarks across {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[9px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Portfolio Value</p>
            <p className="text-2xl font-extrabold text-white">${(totalCapital / 1000000).toFixed(0)}M</p>
          </div>
        </div>
        {/* Sub-stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
          {[
            { label: 'Total Capacity', value: `${totalCapacity} MW` },
            { label: 'Avg. Readiness', value: `${avgReadiness}%` },
            { label: 'Active Engagements', value: engagements.filter((e) => !['DROPPED', 'CLOSED'].includes(e.status)).length },
            { label: 'Projects', value: projects.length },
          ].map((stat) => (
            <div key={stat.label} className="px-4 py-3">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <PortfolioAnalytics
        projects={projects}
        engagements={engagements}
        totalCapital={totalCapital}
        totalCapacity={totalCapacity}
        avgReadiness={avgReadiness}
      />
    </div>
  );
}
