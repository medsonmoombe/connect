'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { PlatformAnalytics } from '@/types';
import { apiClient } from '@/lib/api-client';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { KitTooltip, CHART_MARGIN } from '@/components/charts/ChartKit';
import { CHART_PRIMARY, CHART_ACCENT, GRID_PROPS, AXIS_PROPS, BAR_RADIUS } from '@/lib/chart-theme';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCapital(val: number): string {
  if (val >= 1_000_000_000) return `ZMW ${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `ZMW ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `ZMW ${(val / 1_000).toFixed(0)}K`;
  return `ZMW ${val}`;
}

function formatDay(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Semantic ramp for match-quality bands (strong → weak). */
const MATCH_BAND_COLORS: Record<string, string> = {
  '90-100': '#059669',
  '75-89':  '#22c55e',
  '60-74':  '#f59e0b',
  '40-59':  '#fb923c',
  '0-39':   '#f87171',
};

// ── Building blocks (admin overview style) ───────────────────────────────────

function KpiCard({ label, value, icon: Icon, accent }: {
  label: string; value: string | number; icon: React.ElementType; accent?: string;
}) {
  return (
    <div className="border rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">{label}</span>
        <Icon className="size-3.5 text-white/40" />
      </div>
      <div className="px-4 pb-4 pt-1">
        <p className={cn('text-2xl font-bold tracking-tight truncate', accent ?? 'text-slate-900')}>{value}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, label, caption, children }: {
  title: string; label?: string; caption?: string; children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
        <div className="min-w-0">
          {label && <p className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3 mb-0.5">{label}</p>}
          <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
        </div>
        {caption && <span className="text-[10px] font-semibold text-g-600 whitespace-nowrap">{caption}</span>}
      </div>
      {children}
    </div>
  );
}

function ChartSkeleton({ h = 'h-52' }: { h?: string }) {
  return <div className={cn(h, 'bg-slate-50 animate-pulse')} />;
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function PlatformAnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || !user.is_platform_admin)) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user?.is_platform_admin) return;
    setLoading(true);
    apiClient.get<{ data: PlatformAnalytics }>('/analytics/platform')
      .then(r => setAnalytics(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const trendData = (analytics?.trends ?? []).map(t => ({ ...t, label: formatDay(t.date) }));
  const hasActivity = trendData.some(t => t.projects > 0 || t.engagements > 0);
  const totalMatches = (analytics?.matchDistribution ?? []).reduce((s, b) => s + b.count, 0);
  const totalSectorCapital = (analytics?.sectorBreakdown ?? []).reduce((s, b) => s + b.capital, 0);

  if (authLoading || loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-[76px] bg-surface-2" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border border-slate-200 bg-white overflow-hidden">
              <div className="h-8 bg-surface-2" />
              <div className="h-14 bg-slate-50" />
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="border border-slate-200 bg-white overflow-hidden">
            <div className="h-11 bg-surface-2" />
            <ChartSkeleton h="h-56" />
          </div>
          <div className="border border-slate-200 bg-white overflow-hidden">
            <div className="h-11 bg-surface-2" />
            <ChartSkeleton h="h-56" />
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Platform Analytics" />

      {/* ── Header (canonical dark-green page header) ─────────── */}
      <PageHero
        eyebrow="Admin · Analytics"
        title="Platform Analytics"
        description="Cross-platform performance metrics and trends."
        topLeft={
          <Link href="/admin" className="text-[11px] font-bold text-emerald-200/70 hover:text-white transition-colors inline-flex items-center gap-1">
            <Icons.arrowLeft className="size-3" /> Back to Admin
          </Link>
        }
      />

      {/* ── KPI Strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Users" value={analytics.overview.totalUsers} icon={Icons.users} />
        <KpiCard label="Projects" value={analytics.overview.totalProjects} icon={Icons.folder} />
        <KpiCard label="Companies" value={analytics.overview.totalCompanies} icon={Icons.building} />
        <KpiCard label="Capital Pipeline" value={formatCapital(analytics.overview.totalCapital)} icon={Icons.dollarSign} accent="text-blue-600" />
        <KpiCard label="Engagements" value={analytics.overview.totalEngagements} icon={Icons.zap} />
      </div>

      {/* ── Row 1: 30-Day Activity + Match Score Distribution ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          title="30-Day Activity"
          label="Platform Trend"
          caption="New records per day"
        >
          <div className="p-5">
            {hasActivity ? (
              <ResponsiveContainer width="100%" height={224}>
                <AreaChart data={trendData} margin={CHART_MARGIN}>
                  <defs>
                    <linearGradient id="aProjects" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_ACCENT.blue} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={CHART_ACCENT.blue} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="aEngagements" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_ACCENT.amber} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={CHART_ACCENT.amber} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="label" {...AXIS_PROPS} interval={4} />
                  <YAxis {...AXIS_PROPS} width={32} allowDecimals={false} />
                  <KitTooltip />
                  <Area type="monotone" dataKey="projects" name="New projects" stroke={CHART_ACCENT.blue} strokeWidth={2} fill="url(#aProjects)" dot={false} activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="engagements" name="New engagements" stroke={CHART_ACCENT.amber} strokeWidth={2} fill="url(#aEngagements)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[224px] flex flex-col items-center justify-center text-center">
                <Icons.activity className="size-8 text-slate-200 mb-2" />
                <p className="text-sm font-bold text-slate-700">No activity in the last 30 days</p>
                <p className="text-xs text-slate-400 mt-1">New projects and engagements will appear here</p>
              </div>
            )}
            {/* Legend */}
            <div className="flex items-center gap-5 mt-3 px-1">
              {[
                { color: CHART_ACCENT.blue, label: 'New projects' },
                { color: CHART_ACCENT.amber, label: 'New engagements' },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                  <span className="size-2 rounded-full" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Match Score Distribution"
          label="Matching Engine"
          caption="Projects per score band"
        >
          <div className="p-5">
            {totalMatches === 0 ? (
              <div className="h-[224px] flex flex-col items-center justify-center text-center">
                <Icons.target className="size-8 text-slate-200 mb-2" />
                <p className="text-sm font-bold text-slate-700">No matches computed yet</p>
                <p className="text-xs text-slate-400 mt-1">Run the matching engine and score bands will appear here</p>
              </div>
            ) : (
            <ResponsiveContainer width="100%" height={224}>
              <BarChart data={analytics.matchDistribution} margin={CHART_MARGIN}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="range" {...AXIS_PROPS} tickFormatter={(v: string) => `${v}%`} />
                <YAxis {...AXIS_PROPS} width={32} allowDecimals={false} />
                <KitTooltip />
                <Bar dataKey="count" name="Matches" radius={BAR_RADIUS} maxBarSize={48}>
                  {analytics.matchDistribution.map((bucket) => (
                    <Cell key={bucket.range} fill={MATCH_BAND_COLORS[bucket.range] ?? CHART_PRIMARY} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            )}
            <p className="mt-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Score quality — green = strong matches, red = weak
            </p>
          </div>
        </SectionCard>
      </div>

      {/* ── Row 2: Engagement Funnel + Sector Breakdown ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          title="Engagement Funnel"
          label="Pipeline"
          caption={analytics.avgTimeToClose > 0 ? `Avg. time to close: ${analytics.avgTimeToClose} days` : undefined}
        >
          <div className="p-5 space-y-4">
            {analytics.engagementFunnel.map((stage, i) => {
              const maxCount = analytics.engagementFunnel[0]?.count ?? 1;
              const barWidth = maxCount === 0 ? 0 : Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 4 : 0);
              return (
                <div key={stage.stage} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">{stage.stage}</span>
                    <div className="flex items-center gap-2">
                      {i > 0 && stage.conversionRate > 0 && (
                        <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5">
                          {stage.conversionRate}% convert
                        </span>
                      )}
                      <span className="text-sm font-extrabold text-slate-900 tabular-nums">{stage.count}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full transition-all duration-700"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="Sector Breakdown"
          label="Portfolio"
          caption="By capital required"
        >
          <div className="p-5 pt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sector</th>
                  <th className="text-right py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Projects</th>
                  <th className="text-right py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Capital</th>
                  <th className="text-right py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest pr-1">Share</th>
                </tr>
              </thead>
              <tbody>
                {analytics.sectorBreakdown.map(sector => {
                  const share = totalSectorCapital > 0 ? Math.round((sector.capital / totalSectorCapital) * 100) : 0;
                  return (
                    <tr key={sector.sector} className="border-b border-slate-50 last:border-0">
                      <td className="py-3 font-semibold text-slate-900">{sector.sector}</td>
                      <td className="py-3 text-right font-bold text-slate-700 tabular-nums">{sector.count}</td>
                      <td className="py-3 text-right font-bold text-slate-700 tabular-nums">{formatCapital(sector.capital)}</td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-brand rounded-full" style={{ width: `${share}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-500 tabular-nums w-8 text-right">{share}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
