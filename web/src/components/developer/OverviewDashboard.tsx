'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Project, Engagement } from '@/types';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { DonutStat, KitTooltip, CHART_MARGIN } from '@/components/charts/ChartKit';
import {
  STAGE_COLORS as STAGE_COLOR_MAP,
  ENGAGEMENT_STATUS_COLORS,
  CHART_PRIMARY,
  CHART_CATEGORICAL,
  GRID_PROPS,
  AXIS_PROPS,
  BAR_RADIUS,
  fmtCompactCurrency,
} from '@/lib/chart-theme';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';

// ── Stage config ───────────────────────────────────────────────────────────

const STAGE_ORDER = [
  'CONCEPT', 'PRE_FEASIBILITY', 'FULL_FEASIBILITY', 'REGULATORY_APPROVAL',
  'PPA_READY', 'FINANCIAL_CLOSE', 'CONSTRUCTION', 'OPERATION',
] as const;

const STAGE_LABELS: Record<string, string> = {
  CONCEPT: 'Concept', PRE_FEASIBILITY: 'Pre-Feasibility', FULL_FEASIBILITY: 'Full Feasibility',
  REGULATORY_APPROVAL: 'Regulatory', PPA_READY: 'PPA Ready', FINANCIAL_CLOSE: 'Fin. Close',
  CONSTRUCTION: 'Construction', OPERATION: 'Operation',
};

const STAGE_COLORS: Record<string, string> = STAGE_COLOR_MAP;

const TECH_COLORS: Record<string, string> = {
  Solar: '#f59e0b', Wind: '#3b82f6', Hydro: '#06b6d4', Biomass: '#22c55e',
  Geothermal: '#ef4444', Storage: '#8b5cf6', Grid: '#64748b',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

function fmtRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// (Chart theming now lives in @/lib/chart-theme + components/charts/ChartKit)

// ── Main component ─────────────────────────────────────────────────────────

export function OverviewDashboard({
  projects,
  engagements,
  totalCapital,
  avgReadiness,
  totalCapacity,
  unreadByEngagement,
}: {
  projects: Project[];
  engagements: Engagement[];
  totalCapital: number;
  avgReadiness: number;
  totalCapacity: number;
  unreadByEngagement?: Record<string, number>;
}) {
  // ── Derived data ──────────────────────────────────────────────────────
  const activeProjects = projects.filter(p => p.status === 'live' || !p.status);
  const reviewProjects = projects.filter(p => p.status === 'pending_live' || p.status === 'scoring');

  const totalDocs = projects.reduce((acc, p) => acc + (p.documents?.length ?? 0), 0);
  const projectsWithDocs = projects.filter(p => (p.documents?.length ?? 0) > 0);
  const docCompletionPct = projects.length > 0
    ? Math.round((projectsWithDocs.length / projects.length) * 100)
    : 0;

  const activeEngagements = engagements.filter(e => !['DROPPED', 'CLOSED'].includes(e.status));
  const pendingIntros = engagements.filter(e => e.status === 'INTRO_SENT');
  const unreadTotal = unreadByEngagement
    ? Object.values(unreadByEngagement).reduce((a, b) => a + b, 0)
    : 0;

  // (Stage donut data is derived as `stageBreakdown` below.)

  // ── Technology distribution for bar chart ──────────────────────────────
  const techData = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => {
      const t = p.technology_type || 'Solar';
      counts[t] = (counts[t] || 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return {
      labels: entries.map(([k]) => k),
      data: entries.map(([, v]) => v),
      colors: entries.map(([k]) => TECH_COLORS[k] || '#94a3b8'),
    };
  }, [projects]);

  // ── Funding by project (vertical bar, single hue) ───────────────
  const fundingData = useMemo(() => {
    const sorted = [...projects]
      .filter(p => p.capital_required > 0)
      .sort((a, b) => b.capital_required - a.capital_required)
      .slice(0, 5);
    return {
      rows: sorted.map(p => ({
        name: p.name.length > 20 ? `${p.name.substring(0, 20)}…` : p.name,
        value: p.capital_required,
      })),
    };
  }, [projects]);

  // ── Action items (most important section) ──────────────────────────────
  const actionItems = useMemo(() => {
    const items: { id: string; title: string; description: string; severity: 'critical' | 'warning' | 'info'; href: string; icon: keyof typeof Icons }[] = [];

    projects.forEach(p => {
      const docCount = p.documents?.length ?? 0;
      // Unfinished application: a draft that has never been submitted (no
      // rejection reason) still needs the wizard completed. Surfaced first so
      // partially-entered applications are never forgotten.
      const rejectionReason = (p as { rejection_reason?: string | null }).rejection_reason;
      if (p.status === 'draft' && !rejectionReason) {
        items.push({
          id: `resume-${p.id}`,
          title: `Continue application for "${p.name}"`,
          description: 'Your inputs are saved — pick up exactly where you left off.',
          severity: 'warning',
          href: `/developer/submit?edit=${p.id}`,
          icon: 'play',
        });
      }
      if (docCount === 0 && p.status !== 'draft') {
        items.push({ id: `no-docs-${p.id}`, title: `Upload documents for "${p.name}"`, description: 'No documents uploaded — analysis cannot run.', severity: 'critical', href: `/developer/data-room?project=${p.id}`, icon: 'fileWarning' });
      }
      const score = p.scores?.capital_readiness_score ?? 0;
      if (score > 0 && score < 40) {
        items.push({ id: `low-score-${p.id}`, title: `Request consultant help for "${p.name}"`, description: `Readiness at ${score}% — our consultants can help you improve documentation.`, severity: 'warning', href: `/developer/consultation-request?project=${p.id}`, icon: 'headphones' });
      }
      if (p.status === 'draft' && docCount > 0) {
        items.push({ id: `submit-${p.id}`, title: `Submit "${p.name}" for review`, description: 'Documents uploaded — ready to submit for AI analysis.', severity: 'info', href: `/developer/projects`, icon: 'send' });
      }
    });

    if (pendingIntros.length > 0) {
      items.push({ id: 'pending-intros', title: `${pendingIntros.length} intro${pendingIntros.length > 1 ? 's' : ''} awaiting response`, description: 'Follow up to keep momentum with interested partners.', severity: 'info', href: '/inbound', icon: 'mail' });
    }

    return items.slice(0, 5);
  }, [projects, pendingIntros]);

  // ── Recent partner activity ────────────────────────────────────────────
  const recentActivity = useMemo(() => {
    return engagements
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 4)
      .map(e => ({
        id: e.id,
        text: `${e.counterparty_type === 'CAPITAL' ? 'Investor' : 'Partner'} interested in ${e.project?.name || 'your project'}`,
        time: fmtRelative(e.updated_at),
        status: e.status,
      }));
  }, [engagements]);

  // ── Top project by readiness ───────────────────────────────────────────
  const topProject = useMemo(() => {
    return [...projects]
      .filter(p => (p.scores?.capital_readiness_score ?? 0) > 0)
      .sort((a, b) => (b.scores?.capital_readiness_score ?? 0) - (a.scores?.capital_readiness_score ?? 0))[0];
  }, [projects]);

  // ── Stage progress bars ────────────────────────────────────────────────
  const stageBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => { const s = p.project_stage || 'CONCEPT'; counts[s] = (counts[s] || 0) + 1; });
    return STAGE_ORDER
      .filter(s => counts[s] > 0)
      .map(s => ({ stage: s, label: STAGE_LABELS[s], count: counts[s], color: STAGE_COLORS[s] }));
  }, [projects]);

  const severityStyles = {
    critical: { bg: 'bg-red-50', border: 'border-red-100', icon: 'text-red-500' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'text-amber-500' },
    info: { bg: 'bg-blue-50', border: 'border-blue-100', icon: 'text-blue-500' },
  };

  return (
    <div className="space-y-6">

      {/* ── KPI Summary Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiTile label="Total Projects" value={projects.length} icon="folder" color="blue" href="/developer/projects" />
        <KpiTile label="Active Projects" value={activeProjects.length} icon="zap" color="green" href="/developer/projects" />
        <KpiTile label="Under Review" value={reviewProjects.length} icon="eye" color="amber" href="/developer/projects" />
        <KpiTile label="Total Capacity" value={`${totalCapacity} MW`} icon="activity" color="violet" href="/developer/analytics" />
        <KpiTile label="Funding Requested" value={fmtCurrency(totalCapital)} icon="dollarSign" color="emerald" href="/developer/analytics" />
        <KpiTile label="Avg. Readiness" value={projects.length > 0 ? `${avgReadiness}%` : '—'} icon="shieldCheck" color="slate" href="/developer/ai-insights" />
      </div>

      {/* ── Action Center + Charts Row ───────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Action Center (2 cols wide) */}
        <div className="lg:col-span-2 space-y-5">

          {/* Action Center */}
          {actionItems.length > 0 && (
            <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
              <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
                <div className="flex items-center gap-2">
                  <Icons.bell className="size-4 text-g-700" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-widest">Action Center</h3>
                </div>
                <p className="text-[11px] text-g-600 mt-0.5">What needs your attention</p>
              </div>
              <div className="divide-y divide-slate-50">
                {actionItems.map(item => {
                  const style = severityStyles[item.severity];
                  const ActionIcon = Icons[item.icon];
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={cn('flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors group', style.bg, style.border)}
                    >
                      <div className={cn('size-8 rounded-none flex items-center justify-center shrink-0', style.icon)}>
                        <ActionIcon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{item.title}</p>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">{item.description}</p>
                      </div>
                      <Icons.chevronRight className="size-4 text-slate-300 group-hover:text-green-700 shrink-0 transition-colors" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Project Stage Breakdown */}
          {projects.length > 0 && (
            <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Portfolio</p>
                  <h3 className="text-sm font-bold text-slate-900 mt-0.5">Projects by Stage</h3>
                </div>
                <Link href="/developer/projects" className="text-[10px] font-bold text-green-700 hover:text-green-800 uppercase tracking-widest">
                  View All
                </Link>
              </div>
              <DonutStat
                slices={stageBreakdown.map(s => ({ label: s.label, value: s.count, color: s.color }))}
                centerValue={projects.length}
                centerLabel="projects"
              />
            </div>
          )}

          {/* Funding Pipeline (single-hue bar) */}
          {fundingData.rows.length > 0 && (
            <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Capital</p>
                  <h3 className="text-sm font-bold text-slate-900 mt-0.5">Funding by Project</h3>
                </div>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fundingData.rows} margin={CHART_MARGIN}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis
                      dataKey="name"
                      {...AXIS_PROPS}
                      tick={{ ...AXIS_PROPS.tick, fill: '#475569' }}
                      interval={0}
                      tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 14)}…` : v)}
                    />
                    <YAxis tickFormatter={(v: number) => fmtCompactCurrency(v)} {...AXIS_PROPS} width={52} />
                    <KitTooltip formatter={(v) => fmtCompactCurrency(Number(v))} />
                    <Bar dataKey="value" fill={CHART_PRIMARY} radius={BAR_RADIUS} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Document Health */}
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data Room</p>
            <h3 className="text-sm font-bold text-slate-900 mt-1">Document Health</h3>
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-medium text-slate-600">Completion</span>
                  <span className="text-xs font-bold text-slate-900">{docCompletionPct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-600 rounded-full transition-all" style={{ width: `${docCompletionPct}%` }} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Total documents</span>
                <span className="text-xs font-bold text-slate-900">{totalDocs}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Projects with docs</span>
                <span className="text-xs font-bold text-slate-900">{projectsWithDocs.length}/{projects.length}</span>
              </div>
            </div>
            <Link href="/developer/data-room" className="mt-4 flex items-center justify-center gap-1.5 h-8 rounded-none border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              <Icons.folder className="size-3" /> Open Data Room
            </Link>
          </div>

          {/* Partner Activity */}
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Partners</p>
            <h3 className="text-sm font-bold text-slate-900 mt-1">Activity</h3>
            <div className="mt-4 space-y-2.5">
              <ActivityRow icon="eye" label="Profile views" value="—" />
              <ActivityRow icon="search" label="Project views" value="—" />
              <ActivityRow icon="send" label="Intro requests" value={pendingIntros.length} />
              <ActivityRow icon="users" label="Active matches" value={activeEngagements.length} />
              <ActivityRow icon="messageSquare" label="Open conversations" value={activeEngagements.length} />
            </div>
          </div>

          {/* Technology Mix */}
          {techData.data.length > 0 && (
            <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Portfolio</p>
              <h3 className="text-sm font-bold text-slate-900 mt-1">Technology Mix</h3>
              <div className="mt-4 space-y-2.5">
                {techData.labels.map((label, i) => {
                  const pct = Math.round((techData.data[i] / projects.length) * 100);
                  return (
                    <div key={label}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: techData.colors[i] }} />
                          <span className="text-xs font-medium text-slate-700">{label}</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">{techData.data[i]} · {pct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: techData.colors[i] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
              <div className="px-5 py-3.5 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Activity</p>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">Recent</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {recentActivity.map(item => (
                  <div key={item.id} className="px-5 py-3">
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">{item.text}</p>
                    <p className="text-[10px] text-slate-400 font-bold tracking-wider mt-0.5">{item.time}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unread Messages */}
          {unreadTotal > 0 && (
            <Link href="/engagements" className="block">
              <div className="p-4 rounded-none bg-[#0b3b24] text-white shadow-[0_20px_60px_rgba(15,23,42,0.15)]">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-none bg-white/10 flex items-center justify-center">
                    <Icons.mail className="size-4 text-emerald-200" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Unread Messages</p>
                    <p className="text-[11px] text-emerald-200/80 font-medium">{unreadTotal} new</p>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Quick Links */}
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Actions</p>
            <div className="space-y-1.5">
              {[
                { href: '/developer/submit', icon: 'plus' as keyof typeof Icons, label: 'New Project', color: 'bg-green-50 text-green-600' },
                { href: '/developer/find-partners', icon: 'search' as keyof typeof Icons, label: 'Find Partners', color: 'bg-blue-50 text-blue-600' },
                { href: '/developer/data-room', icon: 'folder' as keyof typeof Icons, label: 'Data Room', color: 'bg-amber-50 text-amber-600' },
              ].map(action => {
                const ActionIcon = Icons[action.icon];
                return (
                  <Link key={action.href} href={action.href} className="flex items-center gap-2.5 p-2.5 rounded-none hover:bg-slate-50 transition-colors group">
                    <div className={cn('size-7 rounded-none flex items-center justify-center shrink-0', action.color)}>
                      <ActionIcon className="size-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-700 group-hover:text-green-800 transition-colors">{action.label}</span>
                    <Icons.chevronRight className="size-3 text-slate-300 ml-auto group-hover:text-green-700 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Top Readiness Project */}
          {topProject && (
            <div className="border border-green-100 bg-green-50 shadow-[0_20px_60px_rgba(15,23,42,0.06)] p-5">
              <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Top Readiness</p>
              <h3 className="text-sm font-bold text-slate-900 mt-1 truncate">{topProject.name}</h3>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-2 bg-green-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-600 rounded-full" style={{ width: `${topProject.scores?.capital_readiness_score ?? 0}%` }} />
                </div>
                <span className="text-xs font-bold text-green-800">{topProject.scores?.capital_readiness_score ?? 0}%</span>
              </div>
              <p className="text-[10px] text-green-700/70 mt-1.5">{topProject.project_size_mw} MW · {topProject.location_country}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiTile({ label, value, icon, color, href }: {
  label: string;
  value: React.ReactNode;
  icon: keyof typeof Icons;
  color: string;
  href: string;
}) {
  const Icon = Icons[icon];
  const colorMap: Record<string, { bg: string; icon: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600' },
    green: { bg: 'bg-green-50', icon: 'text-green-600' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600' },
    violet: { bg: 'bg-violet-50', icon: 'text-violet-600' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
    slate: { bg: 'bg-slate-100', icon: 'text-slate-600' },
  };
  const c = colorMap[color] || colorMap.slate;
  return (
    <Link href={href} className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] block p-4 hover:border-slate-300 hover:shadow-md transition-all group">
      <div className={cn('size-8 rounded-none flex items-center justify-center mb-3', c.bg)}>
        <Icon className={cn('size-4', c.icon)} />
      </div>
      <p className="text-xl font-bold text-slate-950 tracking-tight">{value}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
    </Link>
  );
}

function ActivityRow({ icon, label, value }: { icon: keyof typeof Icons; label: string; value: React.ReactNode }) {
  const Icon = Icons[icon];
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-slate-400" />
        <span className="text-xs font-medium text-slate-600">{label}</span>
      </div>
      <span className="text-xs font-bold text-slate-900">{value}</span>
    </div>
  );
}
