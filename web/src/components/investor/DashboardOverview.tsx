'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { StatCard } from '@/components/ui/stat-card';
import { KpiBarSkeleton, Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { Project } from '@/types';

interface MatchScore {
  id: string;
  project_id: string;
  capital_partner_id: string;
  compatibility_score: number;
  project?: Project;
  score_breakdown?: Record<string, number>;
}

interface OverviewProps {
  matches: MatchScore[];
  engagementCount: number;
  loading: boolean;
  onGoToMatches: () => void;
  onGoToMarketplace: () => void;
  onGoToPortfolio: () => void;
  onGoToProfile: () => void;
  onRunMatching: () => Promise<void>;
}

export function DashboardOverview({
  matches,
  engagementCount,
  loading,
  onGoToMatches,
  onGoToMarketplace,
  onGoToPortfolio,
  onGoToProfile,
  onRunMatching,
}: OverviewProps) {
  const [running, setRunning] = useState(false);

  const topMatches = useMemo(() => matches.slice(0, 4), [matches]);

  const avgScore = useMemo(() => {
    if (!matches.length) return 0;
    return Math.round(matches.reduce((sum, m) => sum + m.compatibility_score, 0) / matches.length);
  }, [matches]);

  const highPotential = useMemo(() => matches.filter(m => m.compatibility_score >= 75).length, [matches]);

  const handleRunMatching = async () => {
    setRunning(true);
    const toastId = toast.loading('Running matching engine…');
    try {
      await onRunMatching();
      toast.success('Matching complete! Your matches have been updated.', { id: toastId });
    } catch {
      toast.error('Matching failed. Please try again.', { id: toastId });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <KpiBarSkeleton />
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-6 rounded-[32px] bg-white border border-gray-100 shadow-soft space-y-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
              <div className="grid grid-cols-3 gap-3 py-4 border-y border-gray-50">
                {[1, 2, 3].map(j => <Skeleton key={j} className="h-10 rounded-xl" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const quickActions = [
    { label: 'View Matches', icon: Icons.search, onClick: onGoToMatches, color: 'bg-primary/10 text-primary' },
    { label: 'Marketplace', icon: Icons.globe, onClick: onGoToMarketplace, color: 'bg-blue-50 text-blue-600' },
    { label: 'Portfolio', icon: Icons.briefcase, onClick: onGoToPortfolio, color: 'bg-amber-50 text-amber-600' },
    { label: 'My Profile', icon: Icons.user, onClick: onGoToProfile, color: 'bg-slate-100 text-slate-600' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Matches"
          value={matches.length}
          icon={Icons.search}
          iconClassName="text-primary"
          trend={matches.length > 0 ? { label: 'from matching engine', positive: true } : undefined}
        />
        <StatCard
          label="Avg Match Score"
          value={`${avgScore}%`}
          icon={Icons.zap}
          iconClassName="text-amber-500"
          valueClassName={avgScore >= 70 ? 'text-green-600' : 'text-slate-900'}
        />
        <StatCard
          label="High Potential"
          value={highPotential}
          icon={Icons.checkCircle2}
          iconClassName="text-green-500"
          valueClassName="text-green-600"
          trend={highPotential > 0 ? { label: 'score ≥ 75%', positive: true } : undefined}
        />
        <StatCard
          label="Active Engagements"
          value={engagementCount}
          icon={Icons.briefcase}
          iconClassName="text-blue-500"
        />
      </div>

      {/* Main content + Quick Actions side by side */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Top Matches — takes 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Top Matches</h2>
            <button onClick={onGoToMatches} className="text-xs font-bold uppercase tracking-widest text-primary hover:underline">
              View All →
            </button>
          </div>

          {topMatches?.length > 0 ? (
            <div className="space-y-3">
              {topMatches?.slice(0, 5)?.map((match) => {
                const project = match.project as any;
                if (!project) return null;
                const score = match.compatibility_score;
                return (
                  <Link key={match.id || match.project_id} href={`/projects/${project.id}`}>
                    <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center gap-4 my-2">
                      {/* Score badge */}
                      <div className={cn(
                        'size-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border',
                        score >= 75 ? 'bg-green-50 border-green-100' : score >= 50 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'
                      )}>
                        <span className={cn(
                          'text-lg font-black leading-none',
                          score >= 75 ? 'text-green-600' : score >= 50 ? 'text-amber-500' : 'text-slate-400'
                        )}>{score}%</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Match</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors truncate">{project.name}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Icons.mapPin className="size-3" />{project.location_country}</span>
                          <span>${(project.capital_required / 1_000_000).toFixed(1)}M</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-50 text-[10px] font-bold uppercase">{project.technology_type}</span>
                        </div>
                      </div>

                      <Icons.chevronRight className="size-4 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ): (
            <EmptyState
              icon="search"
              title="No Matches Yet"
              description="Run the matching engine to find projects that align with your investment preferences."
              actionLabel="Run Matching"
              onAction={handleRunMatching}
            />
          )}
        </div>

        {/* Right column: Quick Actions + Run Matching */}
        <div className="space-y-4">
          {/* Run Matching Card */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-primary/20 flex items-center justify-center">
                <Icons.zap className="size-4 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-bold">Matching Engine</p>
                <p className="text-[10px] text-slate-400">Find new opportunities</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Run the AI matching engine to score all live projects against your investment preferences.
            </p>
            <Button
              onClick={handleRunMatching}
              loading={running}
              disabled={running}
              className="w-full h-9 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90"
            >
              {!running && <Icons.zap className="size-3.5" />}
              {running ? 'Running…' : 'Run Matching'}
            </Button>
          </div>

          {/* Quick Actions */}
          <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quick Actions</p>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map(({ label, icon: Icon, onClick, color }) => (
                <button
                  key={label}
                  onClick={onClick}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                >
                  <div className={cn('size-9 rounded-xl flex items-center justify-center', color)}>
                    <Icon className="size-4" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 group-hover:text-slate-900 text-center leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Summary stats */}
          {matches.length > 0 && (
            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Score Distribution</p>
              {[
                { label: 'High (≥75%)', count: matches.filter(m => m.compatibility_score >= 75).length, color: 'bg-green-500' },
                { label: 'Medium (50–74%)', count: matches.filter(m => m.compatibility_score >= 50 && m.compatibility_score < 75).length, color: 'bg-amber-400' },
                { label: 'Low (<50%)', count: matches.filter(m => m.compatibility_score < 50).length, color: 'bg-slate-300' },
              ].map(({ label, count, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={cn('size-2 rounded-full shrink-0', color)} />
                  <span className="text-xs text-slate-600 flex-1">{label}</span>
                  <span className="text-xs font-bold text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
