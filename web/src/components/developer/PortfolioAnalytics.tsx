'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Project, Engagement } from '@/types';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import { KitTooltip, CHART_MARGIN } from '@/components/charts/ChartKit';
import { CHART_CATEGORICAL, CHART_PRIMARY, CHART_ACCENT, GRID_PROPS, AXIS_PROPS, BAR_RADIUS } from '@/lib/chart-theme';

const CHART_COLORS = CHART_CATEGORICAL;

const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CONCEPT:              { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200' },
  PRE_FEASIBILITY:      { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  FULL_FEASIBILITY:     { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  REGULATORY_APPROVAL:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
  PPA_READY:            { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200' },
  FINANCIAL_CLOSE:      { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  CONSTRUCTION:         { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200' },
  OPERATION:            { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
};

const FUNNEL_COLORS = [
  'from-blue-500 to-blue-600',
  'from-indigo-500 to-indigo-600',
  'from-violet-500 to-violet-600',
  'from-amber-500 to-amber-600',
  'from-orange-500 to-orange-600',
  'from-emerald-500 to-emerald-600',
];

const FUNNEL_DOT_COLORS = [
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-orange-500',
  'bg-emerald-500',
];

// ── Chart Card wrapper ──────────────────────────────────────────────────────
function ChartCard({
  label,
  title,
  count,
  children,
}: {
  label: string;
  title: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
        <div>
          <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">{label}</p>
          <h3 className="text-[15px] font-bold text-ink mt-0.5">{title}</h3>
        </div>
        {count && (
          <span className="text-[11px] font-semibold text-ink-3">{count}</span>
        )}
      </div>
      <div className="p-[22px]">{children}</div>
    </div>
  );
}

export function PortfolioAnalytics({
  projects,
  engagements,
  totalCapital,
  totalCapacity,
  avgReadiness,
}: {
  projects: Project[];
  engagements: Engagement[];
  totalCapital: number;
  totalCapacity: number;
  avgReadiness: number;
}) {
  // ── Computed data ──────────────────────────────────────────────────────────

  // Stage distribution
  const stageCounts: Record<string, number> = {};
  projects.forEach((p) => {
    const stage = p.project_stage || 'DRAFT';
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  });
  const stageData = Object.entries(stageCounts).map(([name, count]) => ({
    name: name.replace(/_/g, ' '),
    count,
  }));

  // Technology distribution
  const techCounts: Record<string, number> = {};
  projects.forEach((p) => {
    const tech = p.technology_type || 'Other';
    techCounts[tech] = (techCounts[tech] || 0) + 1;
  });
  const techData = Object.entries(techCounts).map(([name, value]) => ({ name, value }));

  // Geographic distribution
  const geoCounts: Record<string, number> = {};
  projects.forEach((p) => {
    const geo = p.location_country || 'Unknown';
    geoCounts[geo] = (geoCounts[geo] || 0) + 1;
  });
  const geoData = Object.entries(geoCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const geoMax = geoData.length > 0 ? Math.max(...geoData.map((g) => g.value)) : 0;

  // Engagement funnel
  const statusCounts: Record<string, number> = {};
  engagements.forEach((e) => {
    statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
  });
  const funnelData = [
    { name: 'Intro Sent', count: statusCounts['INTRO_SENT'] || 0, icon: Icons.send },
    { name: 'Accepted', count: statusCounts['INTRO_ACCEPTED'] || 0, icon: Icons.check },
    { name: 'NDA Signed', count: statusCounts['NDA_SIGNED'] || 0, icon: Icons.shieldCheck },
    { name: 'Due Diligence', count: statusCounts['DUE_DILIGENCE'] || 0, icon: Icons.search },
    { name: 'Term Sheet', count: statusCounts['TERM_SHEET'] || 0, icon: Icons.fileText },
    { name: 'Closed', count: statusCounts['CLOSED'] || 0, icon: Icons.checkCircle2 },
  ].filter((d) => d.count > 0);

  // Readiness sorted
  const readinessTrend = useMemo(() => {
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      readiness: p.scores?.capital_readiness_score ?? 0,
      capacity: p.project_size_mw,
      stage: p.project_stage || 'DRAFT',
    })).sort((a, b) => b.readiness - a.readiness);
  }, [projects]);

  // Capital by stage
  const capitalByStage = useMemo(() => {
    const result: Record<string, number> = {};
    projects.forEach((p) => {
      const stage = p.project_stage || 'DRAFT';
      result[stage] = (result[stage] || 0) + (p.capital_required || 0);
    });
    return Object.entries(result).map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value: Math.round(value / 1000000),
    }));
  }, [projects]);

  // Conversion rates
  const totalIntros = engagements.length;
  const acceptedCount = engagements.filter((e) => ['INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'].includes(e.status)).length;
  const ndaCount = engagements.filter((e) => ['NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'].includes(e.status)).length;
  const closedCount = engagements.filter((e) => e.status === 'CLOSED').length;
  const introToAccepted = totalIntros > 0 ? Math.round((acceptedCount / totalIntros) * 100) : 0;
  const acceptedToNDA = acceptedCount > 0 ? Math.round((ndaCount / acceptedCount) * 100) : 0;
  const ndaToClose = ndaCount > 0 ? Math.round((closedCount / ndaCount) * 100) : 0;

  const funnelMax = funnelData.length > 0 ? Math.max(...funnelData.map((d) => d.count)) : 0;

  return (
    <div className="space-y-5">

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Portfolio Value', value: `$${(totalCapital / 1000000).toFixed(0)}M`, icon: Icons.dollarSign, bg: 'bg-green-50 border-green-100', iconColor: 'text-green-600' },
          { label: 'Total Capacity', value: `${totalCapacity} MW`, icon: Icons.zap, bg: 'bg-amber-50 border-amber-100', iconColor: 'text-amber-600' },
          { label: 'Engagement Rate', value: `${introToAccepted}%`, icon: Icons.trendingUp, bg: 'bg-blue-50 border-blue-100', iconColor: 'text-blue-600' },
          { label: 'Avg. Readiness', value: `${avgReadiness}%`, icon: Icons.shieldCheck, bg: 'bg-violet-50 border-violet-100', iconColor: 'text-violet-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-4 flex items-center gap-3 min-w-0">
            <div className={cn('size-10 rounded-none flex items-center justify-center shrink-0 border', kpi.bg)}>
              <kpi.icon className={cn('size-5', kpi.iconColor)} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-black leading-none text-slate-900 truncate">{kpi.value}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Stage Distribution */}
        <ChartCard label="Distribution" title="Projects by Stage" count={`${projects.length} total`}>
          {stageData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} margin={CHART_MARGIN}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="name" {...AXIS_PROPS} />
                  <YAxis {...AXIS_PROPS} allowDecimals={false} width={32} />
                  <KitTooltip />
                  <Bar dataKey="count" fill={CHART_PRIMARY} radius={BAR_RADIUS} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center">
              <p className="text-xs text-slate-400">No data yet</p>
            </div>
          )}
        </ChartCard>

        {/* Technology Mix */}
        <ChartCard label="Breakdown" title="Technology Mix">
          {techData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={techData} cx="50%" cy="50%" innerRadius="62%" outerRadius="88%" paddingAngle={2} dataKey="value" strokeWidth={0}>
                    {techData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <KitTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center">
              <p className="text-xs text-slate-400">No data yet</p>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Capital by Stage */}
        <ChartCard label="Financial" title="Capital by Stage ($M)">
          {capitalByStage.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={capitalByStage} margin={CHART_MARGIN}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="name" {...AXIS_PROPS} />
                  <YAxis {...AXIS_PROPS} width={32} />
                  <KitTooltip formatter={(value) => [`$${value}M`, 'Capital'][0]} />
                  <Bar dataKey="value" fill={CHART_ACCENT.blue} radius={BAR_RADIUS} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center">
              <p className="text-xs text-slate-400">No data yet</p>
            </div>
          )}
        </ChartCard>

        {/* Projects by Country — ranked list */}
        <ChartCard label="Geography" title="Projects by Country">
          {geoData.length > 0 ? (
            <div className="space-y-0">
              {geoData.map((geo, i) => {
                const width = geoMax > 0 ? (geo.value / geoMax) * 100 : 0;
                return (
                  <div key={geo.name} className={cn('flex items-center gap-3 py-2.5', i < geoData.length - 1 && 'border-b border-slate-100')}>
                    {/* Rank */}
                    <span className="text-[10px] font-bold text-slate-300 w-5 text-center shrink-0">{i + 1}</span>
                    {/* Country */}
                    <div className="w-24 shrink-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{geo.name}</p>
                    </div>
                    {/* Bar */}
                    <div className="flex-1 h-6 bg-slate-50 rounded-none overflow-hidden border border-slate-100">
                      <div
                        className="h-full rounded-none bg-gradient-to-r from-green-800 to-green-600 transition-all duration-500"
                        style={{ width: `${Math.max(width, 8)}%` }}
                      />
                    </div>
                    {/* Count + percentage */}
                    <div className="flex items-center gap-2 shrink-0 w-20 justify-end">
                      <span className="text-xs font-bold text-slate-900">{geo.value}</span>
                      <span className="text-[9px] font-bold text-slate-400">
                        {projects.length > 0 ? Math.round((geo.value / projects.length) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center">
              <p className="text-xs text-slate-400">No data yet</p>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Engagement Funnel — proper funnel visual ── */}
      {funnelData.length > 0 && (
        <ChartCard label="Pipeline" title="Engagement Funnel">
          {/* Conversion rate chips */}
          <div className="flex flex-wrap items-center gap-4 mb-5 pb-4 border-b border-slate-100">
            {[
              { label: 'Intro → Accepted', value: introToAccepted, color: 'text-blue-700 bg-blue-50 border-blue-200' },
              { label: 'Accepted → NDA', value: acceptedToNDA, color: 'text-violet-700 bg-violet-50 border-violet-200' },
              { label: 'NDA → Close', value: ndaToClose, color: 'text-green-700 bg-green-50 border-green-200' },
            ].map((chip) => (
              <div key={chip.label} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-none border text-[10px] font-bold tracking-wider', chip.color)}>
                {chip.label}
                <span className="text-xs font-black">{chip.value}%</span>
              </div>
            ))}
          </div>
          {/* Funnel steps */}
          <div className="space-y-0">
            {funnelData.map((stage, i) => {
              const width = funnelMax > 0 ? (stage.count / funnelMax) * 100 : 0;
              const isLast = i === funnelData.length - 1;
              const conversionRate = i > 0 && funnelData[i - 1].count > 0
                ? Math.round((stage.count / funnelData[i - 1].count) * 100)
                : null;
              const StageIcon = stage.icon;
              return (
                <div key={stage.name}>
                  {/* Conversion arrow between steps */}
                  {conversionRate !== null && (
                    <div className="flex items-center justify-center py-1.5">
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 tracking-wider">
                        <Icons.chevronDown className="size-3 text-slate-300 rotate-180" />
                        <span className={cn(
                          'px-1.5 py-0.5 rounded',
                          conversionRate >= 80 ? 'bg-green-50 text-green-600' :
                          conversionRate >= 50 ? 'bg-amber-50 text-amber-600' :
                          'bg-red-50 text-red-500'
                        )}>
                          {conversionRate}% conversion
                        </span>
                        <Icons.chevronDown className="size-3 text-slate-300 rotate-180" />
                      </div>
                    </div>
                  )}
                  {/* Step row */}
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className={cn('size-9 rounded-none flex items-center justify-center shrink-0 border border-slate-200 bg-white')}>
                      <StageIcon className={cn('size-4', i === funnelData.length - 1 ? 'text-green-600' : 'text-slate-500')} />
                    </div>
                    {/* Name + bar */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-700">{stage.name}</span>
                        <span className="text-sm font-black text-slate-900">{stage.count}</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', FUNNEL_COLORS[i % FUNNEL_COLORS.length])}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}

      {/* ── Readiness by Project — clean ranked list ── */}
      {readinessTrend.length > 0 && (
        <ChartCard label="Comparison" title="Readiness by Project">
          <div className="space-y-0">
            {readinessTrend.map((p, i) => {
              const stageColor = STAGE_COLORS[p.stage] || STAGE_COLORS.CONCEPT;
              return (
                <div key={p.id} className={cn('flex items-center gap-4 py-3', i < readinessTrend.length - 1 && 'border-b border-slate-100')}>
                  {/* Rank */}
                  <span className="text-[10px] font-bold text-slate-300 w-5 text-center shrink-0">{i + 1}</span>
                  {/* Project info */}
                  <div className="w-36 shrink-0 min-w-0">
                    <Link href={`/projects/${p.id}`} className="text-xs font-bold text-slate-800 hover:text-green-800 transition-colors truncate block">
                      {p.name}
                    </Link>
                    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded border mt-1 text-[8px] font-bold tracking-wider', stageColor.bg, stageColor.text, stageColor.border)}>
                      {p.stage.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {/* Score bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Readiness</span>
                      <span className="text-xs font-black text-slate-900">{p.readiness}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          p.readiness >= 70 ? 'bg-gradient-to-r from-green-600 to-green-400' :
                          p.readiness >= 40 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                          'bg-gradient-to-r from-red-500 to-red-400'
                        )}
                        style={{ width: `${p.readiness}%` }}
                      />
                    </div>
                  </div>
                  {/* Capacity */}
                  <div className="shrink-0 text-right w-16">
                    <p className="text-xs font-bold text-slate-900">{p.capacity}</p>
                    <p className="text-[9px] font-bold text-slate-400 tracking-wider">MW</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}

      {/* ── Portfolio Summary Table ── */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <div>
            <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Details</p>
            <h3 className="text-[15px] font-bold text-ink mt-0.5">Portfolio Summary</h3>
          </div>
          <span className="text-[11px] font-semibold text-ink-3">{projects.length} tracked</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-3 text-left text-[9px] font-bold text-slate-500 uppercase tracking-widest">Project</th>
                <th className="px-4 py-3 text-left text-[9px] font-bold text-slate-500 uppercase tracking-widest">Stage</th>
                <th className="px-4 py-3 text-right text-[9px] font-bold text-slate-500 uppercase tracking-widest">Capacity</th>
                <th className="px-4 py-3 text-right text-[9px] font-bold text-slate-500 uppercase tracking-widest">Capital</th>
                <th className="px-5 py-3 text-left text-[9px] font-bold text-slate-500 uppercase tracking-widest">Readiness</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((p, idx) => {
                const score = p.scores?.capital_readiness_score ?? 0;
                const stageColor = STAGE_COLORS[p.project_stage || 'CONCEPT'] || STAGE_COLORS.CONCEPT;
                return (
                  <tr key={p.id} className={cn('transition-colors hover:bg-green-50/30', idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40')}>
                    <td className="px-5 py-3.5">
                      <Link href={`/projects/${p.id}`} className="text-sm font-bold text-slate-900 hover:text-green-800 transition-colors">
                        {p.name}
                      </Link>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">{p.technology_type?.replace(/_/g, ' ') || '—'} · {p.location_country || '—'}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-none border text-[9px] font-bold tracking-wider', stageColor.bg, stageColor.text, stageColor.border)}>
                        {p.project_stage?.replace(/_/g, ' ') || 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-xs font-bold text-slate-900">{p.project_size_mw}</span>
                      <span className="text-[10px] font-bold text-slate-400 ml-1">MW</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-xs font-bold text-slate-900">${(p.capital_required / 1000000).toFixed(1)}</span>
                      <span className="text-[10px] font-bold text-slate-400 ml-0.5">M</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-400'
                            )}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span className={cn(
                          'text-[10px] font-black',
                          score >= 70 ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-red-500'
                        )}>
                          {score}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
