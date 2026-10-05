'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { projectService } from '@/services/projects';
import { engagementService } from '@/lib/engagement';
import { Project, Engagement } from '@/types';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { InboundInterestTab } from '@/components/developer/InboundInterestTab';
import { DashboardSkeleton } from '@/components/ui/skeleton';

export default function InboundPage() {
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

  const totalInterest = engagements.length;
  const activeEngagements = engagements.filter((e) => !['DROPPED', 'CLOSED'].includes(e.status)).length;

  if (authLoading || loading) {
    return <div className="p-6"><DashboardSkeleton /></div>;
  }

  return (
    <div className="space-y-6">
      {/* ── Header Card ── */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="bg-[#0b3b24] px-6 py-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold mb-1">Developer Workspace</p>
            <h1 className="text-xl font-bold text-white tracking-tight">Inbound Interest</h1>
            <p className="text-[11px] text-emerald-200/60 mt-1">
              {totalInterest > 0
                ? `${totalInterest} partner${totalInterest !== 1 ? 's' : ''} showing interest across ${projects.length} project${projects.length !== 1 ? 's' : ''}`
                : 'Partners will appear here once they express interest in your projects'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[9px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Active</p>
            <p className="text-2xl font-extrabold text-white">{activeEngagements}</p>
          </div>
        </div>
        {/* Sub-stats strip */}
        {totalInterest > 0 && (
          <div className="grid grid-cols-3 divide-x divide-slate-100">
            {[
              { label: 'Total Interest', value: totalInterest },
              { label: 'Pending Response', value: engagements.filter((e) => e.status === 'INTRO_SENT').length },
              { label: 'Closed Deals', value: engagements.filter((e) => e.status === 'CLOSED').length },
            ].map((stat) => (
              <div key={stat.label} className="px-5 py-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{stat.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <InboundInterestTab projects={projects} engagements={engagements} loading={loading} />
    </div>
  );
}
