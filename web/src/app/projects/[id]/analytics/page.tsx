'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icons, ArrowLeft, Zap, MapPin } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { projectService } from '@/services/projects';
import { Project } from '@/types';
import type { ProjectAnalyticsResponse } from '@/app/api/projects/[id]/analytics/route';
import { apiClient } from '@/lib/api-client';

async function fetchAnalytics(projectId: string): Promise<ProjectAnalyticsResponse> {
  const json = await apiClient.get<{ success: boolean; data: ProjectAnalyticsResponse }>(
    `/projects/${projectId}/analytics`
  );
  return json.data;
}

// ── SVG Sparkline ─────────────────────────────────────────────
function Sparkline({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const W = 280, H = 64, PAD = 4;
  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((d.count / max) * (H - PAD * 2));
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  const area = `${PAD},${H - PAD} ${polyline} ${W - PAD},${H - PAD}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="currentColor" stopOpacity="0.12" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#spark-fill)" className="text-primary" />
      <polyline points={polyline} fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        className="text-primary" />
      {data.map((d, i) => {
        const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
        const y = H - PAD - ((d.count / max) * (H - PAD * 2));
        return d.count > 0 ? (
          <circle key={i} cx={x} cy={y} r="3.5" fill="currentColor" className="text-primary" />
        ) : null;
      })}
    </svg>
  );
}

// ── Funnel Bar ────────────────────────────────────────────────
// One color family (primary → deeper shades), success state picked out in emerald.
const FUNNEL_COLORS = ['bg-primary/90', 'bg-primary/75', 'bg-primary/60', 'bg-primary/45', 'bg-emerald-500'];
const FUNNEL_DOT    = ['bg-primary/90', 'bg-primary/75', 'bg-primary/60', 'bg-primary/45', 'bg-emerald-500'];

function FunnelBar({ label, count, rate, maxCount, color, isFirst, index }: {
  label: string; count: number; rate: number;
  maxCount: number; color: string; isFirst: boolean; index: number;
}) {
  // Width relative to the top-of-funnel count so the row shape actually narrows.
  const barWidth = maxCount === 0 ? 0 : Math.max((count / maxCount) * 100, count > 0 ? 4 : 0);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2.5">
        <span className="size-5 rounded-full bg-background border border-gray-100 flex items-center justify-center text-[9px] font-bold text-text-muted shrink-0">
          {index + 1}
        </span>
        <span className="text-xs font-bold text-text-main truncate">{label}</span>
        {!isFirst && (
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest shrink-0">
            {rate}% conv.
          </span>
        )}
        <span className="ml-auto text-sm font-extrabold text-text-main tabular-nums shrink-0">
          {count}
        </span>
      </div>
      <div className="w-full h-2.5 bg-background rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', color)}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, icon }: {
  label: string; value: number | string; sub?: string; icon: React.ReactNode;
}) {
  return (
    <div className="p-5 rounded-2xl bg-surface border border-gray-100 shadow-soft flex items-center justify-between gap-3 min-w-0">
      <div className="min-w-0">
        <p className="text-meta mb-1 truncate">{label}</p>
        <p className="text-2xl font-extrabold text-text-main tabular-nums truncate">{value}</p>
        {sub && <p className="text-[10px] font-bold text-text-muted mt-1 uppercase tracking-wider truncate">{sub}</p>}
      </div>
      <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-gray-100 rounded-2xl', className)} />;
}

// ── Section Card — matches the site's card pattern ────────────
function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('p-6 rounded-2xl bg-surface border border-gray-100 shadow-soft', className)}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="text-base font-bold text-text-main mb-5 flex items-center gap-2.5">
      <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <span className="truncate">{children}</span>
    </h3>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function ProjectAnalyticsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user, loading: authLoading } = useAuth();

  const [project, setProject]     = useState<Project | null>(null);
  const [analytics, setAnalytics] = useState<ProjectAnalyticsResponse | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Wait for auth to rehydrate before fetching — prevents
  // "Not authenticated" on hard refresh while session is still loading.
  useEffect(() => {
    if (!projectId || authLoading) return;
    let cancelled = false;

    async function load() {
      try {
        const [proj, data] = await Promise.all([
          projectService.getProjectDetails(projectId),
          fetchAnalytics(projectId),
        ]);
        if (!cancelled) { setProject(proj); setAnalytics(data); }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [projectId, authLoading]);

  const loading = authLoading || dataLoading;

  const funnelMaxCount = analytics?.funnel.intro.count ?? 0;
  const funnelStages = analytics ? [
    { label: 'Introductions',  ...analytics.funnel.intro,        color: FUNNEL_COLORS[0], isFirst: true  },
    { label: 'NDA Signed',     ...analytics.funnel.nda,          color: FUNNEL_COLORS[1], isFirst: false },
    { label: 'Due Diligence',  ...analytics.funnel.dueDiligence, color: FUNNEL_COLORS[2], isFirst: false },
    { label: 'Term Sheet',     ...analytics.funnel.termSheet,    color: FUNNEL_COLORS[3], isFirst: false },
    { label: 'Closed',         ...analytics.funnel.closed,       color: FUNNEL_COLORS[4], isFirst: false },
  ].map((stage, i) => ({ ...stage, maxCount: funnelMaxCount, index: i })) : [];

  const totalDayViews = analytics?.velocity.reduce((s, d) => s + d.count, 0) ?? 0;
  const peakDay = analytics?.velocity.reduce((a, b) => b.count > a.count ? b : a, { date: '', count: 0 });

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Icons.spinner className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Back link */}
      {project && (
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-primary transition-colors uppercase tracking-widest"
        >
          <ArrowLeft className="size-3.5" />
          Back to Project
        </Link>
      )}

      {/* Hero — same rounded card pattern as the dashboard */}
      <div className="p-6 rounded-2xl bg-surface border border-gray-100 shadow-soft relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-bl-[120px] -z-10" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3 bg-primary/5 border border-primary/10 text-[10px] font-bold uppercase tracking-widest text-primary">
              <Icons.barChart2 className="size-3" />
              Institutional Deal Analytics
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text-main leading-tight mb-3 truncate">
              {project?.name ?? '—'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-wider">
              {project && (
                <>
                  <span className="flex items-center gap-1.5 bg-background px-3 py-1.5 rounded-xl shrink-0">
                    <Zap className="size-3.5 text-primary" /> {project.project_size_mw} MW
                  </span>
                  <span className="flex items-center gap-1.5 bg-background px-3 py-1.5 rounded-xl min-w-0">
                    <MapPin className="size-3.5 text-primary shrink-0" /> <span className="truncate">{project.location_country}</span>
                  </span>
                  <span className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border shrink-0',
                    project.status === 'live' ? 'bg-green-50 text-green-600 border-green-100' :
                    project.status === 'scoring' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                    project.status === 'deactivated' ? 'bg-red-50 text-red-600 border-red-100' :
                    project.status === 'pending_live' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                    project.status === 'archived' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                    'bg-slate-50 text-slate-500 border-slate-100'
                  )}>
                    {project.status ?? 'draft'}
                  </span>
                </>
              )}
            </div>
          </div>
          {/* Readiness score mini — mirrors hero card */}
          {project?.scores && (
            <div className="flex flex-col items-center justify-center p-5 bg-white border border-gray-100 rounded-2xl min-w-[110px] shadow-soft shrink-0">
              <p className="text-meta mb-1.5">Readiness</p>
              <p className="text-3xl font-black text-primary">{project.scores.capital_readiness_score ?? 0}%</p>
              <div className="w-full bg-gray-100 h-1 rounded-full mt-2.5 overflow-hidden">
                <div className="bg-primary h-full" style={{ width: `${project.scores.capital_readiness_score ?? 0}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Viewers"
          value={analytics?.views.unique ?? 0}
          sub="unique users"
          icon={<Icons.globe className="size-4" />}
        />
        <StatCard
          label="Data Room Opens"
          value={analytics?.views.dataroom ?? 0}
          sub="document accesses"
          icon={<Icons.lock className="size-4" />}
        />
        <StatCard
          label="Total Matches"
          value={analytics?.matches.total ?? 0}
          sub={`${analytics?.matches.capital ?? 0} capital · ${analytics?.matches.technical ?? 0} technical`}
          icon={<Icons.zap className="size-4" />}
        />
        <StatCard
          label="Engagements"
          value={analytics?.funnel.intro.count ?? 0}
          sub={`${analytics?.funnel.closed.count ?? 0} closed deals`}
          icon={<Icons.messageSquare className="size-4" />}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">

        {/* Left col */}
        <div className="lg:col-span-2 space-y-5">

          {/* Engagement Funnel */}
          <SectionCard>
            <SectionTitle icon={<Icons.barChart2 className="size-4" />}>
              Engagement Funnel
            </SectionTitle>
            <div className="space-y-4">
              {funnelStages.map(stage => (
                <FunnelBar key={stage.label} {...stage} />
              ))}
            </div>
            {analytics && analytics.funnel.intro.count > 0 && (
              <div className="mt-6 pt-5 border-t border-gray-50 flex items-center justify-between gap-3">
                <span className="text-meta">Overall close rate</span>
                <span className={cn(
                  'text-sm font-extrabold px-3 py-1 rounded-full shrink-0',
                  analytics.funnel.closed.count > 0 ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-text-muted'
                )}>
                  {Math.round((analytics.funnel.closed.count / analytics.funnel.intro.count) * 100)}%
                </span>
              </div>
            )}
            {analytics && analytics.funnel.intro.count === 0 && (
              <div className="mt-5 p-6 text-center bg-background rounded-2xl border border-dashed border-gray-200">
                <p className="text-meta">No engagements yet</p>
                <p className="text-xs font-medium text-text-muted mt-1">
                  Funnel data will appear once partners engage with this project
                </p>
              </div>
            )}
          </SectionCard>

          {/* View Velocity */}
          <SectionCard>
            <div className="flex items-start justify-between gap-3 mb-4">
              <SectionTitle icon={<Icons.lineChart className="size-4" />}>
                View Velocity
              </SectionTitle>
              <div className="text-right shrink-0">
                <p className="text-2xl font-extrabold text-text-main tabular-nums">{totalDayViews}</p>
                <p className="text-meta whitespace-nowrap">viewers · 7 days</p>
              </div>
            </div>
            <div className="h-20">
              {analytics && totalDayViews > 0
                ? <Sparkline data={analytics.velocity} />
                : (
                  <div className="h-full flex items-center justify-center border border-dashed border-gray-200 rounded-2xl">
                    <p className="text-meta">No viewers yet</p>
                  </div>
                )
              }
            </div>
            {analytics && (
              <div className="flex justify-between mt-3">
                {analytics.velocity.map(d => (
                  <span key={d.date} className="text-meta">
                    {new Date(d.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' })}
                  </span>
                ))}
              </div>
            )}
            {peakDay && peakDay.count > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between gap-3">
                <span className="text-meta">Peak day</span>
                <span className="text-xs font-extrabold text-text-main whitespace-nowrap">
                  {peakDay.count} viewers · {new Date(peakDay.date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right col */}
        <div className="space-y-5">

          {/* Match Breakdown — dark card, same as project page sidebar */}
          <div className="p-6 rounded-2xl bg-slate-900 text-white shadow-soft relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-white/5 rounded-bl-[80px]" />
            <h3 className="text-base font-bold mb-5">Match Breakdown</h3>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-center gap-3 mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">Capital Partners</span>
                  <span className="text-lg font-extrabold tabular-nums shrink-0">{analytics?.matches.capital ?? 0}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: `${analytics?.matches.total ? (analytics.matches.capital / analytics.matches.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center gap-3 mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">Technical Partners</span>
                  <span className="text-lg font-extrabold tabular-nums shrink-0">{analytics?.matches.technical ?? 0}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-400 rounded-full transition-all duration-700"
                    style={{ width: `${analytics?.matches.total ? (analytics.matches.technical / analytics.matches.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-700 flex justify-between items-center gap-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
                <span className="text-2xl font-black tabular-nums text-primary">{analytics?.matches.total ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Deal Pipeline */}
          <SectionCard>
            <SectionTitle icon={<Icons.handshake className="size-4" />}>
              Deal Pipeline
            </SectionTitle>
            <div className="space-y-2.5">
              {funnelStages.map((stage, i) => (
                <div key={stage.label} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-background border border-gray-50">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn('size-2 rounded-full shrink-0', FUNNEL_DOT[i])} />
                    <span className="text-xs font-bold text-text-muted truncate">{stage.label}</span>
                  </div>
                  <span className="text-sm font-extrabold text-text-main tabular-nums shrink-0">{stage.count}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Visibility */}
          <SectionCard>
            <SectionTitle icon={<Icons.globe className="size-4" />}>
              Visibility
            </SectionTitle>
            <div className="space-y-2.5">
              {[
                { label: 'Viewers',  value: analytics?.views.unique ?? 0, icon: <Icons.globe className="size-4" /> },
                { label: 'Data Room Opens', value: analytics?.views.dataroom ?? 0, icon: <Icons.lock className="size-4" /> },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-background border border-gray-50">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                      {row.icon}
                    </div>
                    <p className="text-meta truncate">{row.label}</p>
                  </div>
                  <p className="text-xl font-extrabold text-text-main tabular-nums shrink-0">{row.value}</p>
                </div>
              ))}
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  );
}