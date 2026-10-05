'use client';

import { Icons } from '@/components/ui/icons';
import { Engagement } from '@/types';
import { KpiCard, SectionCard, ListItemRow, QuickActionCard, StatusBadge } from '@/components/ui/dashboard-cards';

interface DashboardOverviewProps {
  matches: any[];
  engagementCount: number;
  loading: boolean;
  onGoToMatches: () => void;
  engagements?: Engagement[];
  unreadByEngagement?: Record<string, number>;
}



export function DashboardOverview({
  matches,
  engagementCount,
  loading,
  onGoToMatches,
  engagements = [],
  unreadByEngagement = {},
}: DashboardOverviewProps) {
  const highMatches = matches.filter(m => m.compatibility_score >= 80).length;
  const activeEngagements = engagements.filter(e => !['CLOSED', 'DROPPED'].includes(e.status)).length;
  const pendingAction = engagements.filter(e => e.status === 'INTRO_ACCEPTED').length;
  const totalUnread = Object.values(unreadByEngagement).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Matches" value={matches.length} icon={Icons.target} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <KpiCard label="High Potential (80%+)" value={highMatches} icon={Icons.checkCircle2} iconBg="bg-green-50" iconColor="text-green-600" valueClassName="text-green-600" />
        <KpiCard label="Active Deals" value={activeEngagements} icon={Icons.briefcase} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <KpiCard label="Unread Messages" value={totalUnread} icon={Icons.messageSquare} iconBg="bg-red-50" iconColor="text-red-600" />
      </div>

      {/* ── Two Column Layout ─────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <SectionCard
          sectionLabel="Opportunities"
          title="Top Matches"
          onHeaderAction={onGoToMatches}
          loading={loading}
          empty={<p className="text-xs text-slate-400 font-medium">No matches yet. The matching engine runs automatically.</p>}
        >
          {matches.slice(0, 3).map((match) => (
            <ListItemRow
              key={match.id}
              href={`/projects/${match.project_id}`}
              icon={<div className="size-10 rounded-none bg-slate-50 border border-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 shrink-0 group-hover:scale-105 transition-transform">{match.project?.name?.substring(0, 2).toUpperCase() || 'PR'}</div>}
              title={match.project?.name || 'Project'}
              subtitle={`${match.project?.technology_type} · ${match.project?.project_size_mw} MW`}
              trailing={<div className="text-right"><p className="text-lg font-extrabold text-primary">{match.compatibility_score}%</p><p className="text-[9px] font-bold text-slate-400 tracking-widest">Match</p></div>}
            />
          ))}
        </SectionCard>

        <SectionCard
          sectionLabel="Pipeline"
          title="Active Engagements"
          headerAction={`${activeEngagements} active`}
          empty={<p className="text-xs text-slate-400 font-medium">No active engagements yet.</p>}
        >
          {engagements
            .filter(e => !['CLOSED', 'DROPPED'].includes(e.status))
            .slice(0, 5)
            .map((eng) => {
              const unread = unreadByEngagement[eng.id] ?? 0;
              return (
                <ListItemRow
                  key={eng.id}
                  href={`/engagements/${eng.id}`}
                  title={eng.project?.name || 'Project'}
                  trailing={
                    <div className="flex items-center gap-2">
                      <StatusBadge status={eng.status} />
                      {unread > 0 && (
                        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[9px] font-black">
                          {unread}
                        </span>
                      )}
                    </div>
                  }
                />
              );
            })}
        </SectionCard>
      </div>

      {/* ── Quick Actions ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickActionCard href="/investor/marketplace" icon={Icons.search} iconBg="bg-blue-50" iconColor="text-blue-600" title="Browse Marketplace" description="Discover new projects" />
        <QuickActionCard href="/investor/marketplace?band=high" icon={Icons.target} iconBg="bg-green-50" iconColor="text-green-600" title="Review Matches" description={`${highMatches} high-potential matches`} />
        <QuickActionCard href="/investor/profile" icon={Icons.user} iconBg="bg-amber-50" iconColor="text-amber-600" title="Investment Profile" description="Update your criteria" />
      </div>
    </div>
  );
}
