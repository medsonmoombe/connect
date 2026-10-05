'use client';

import { usePlatformAnalytics } from '@/hooks/queries/useFeatures';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { PlatformAnalytics } from '@/types';

export function ReportsTab() {
  const { data, isLoading } = usePlatformAnalytics();

  if (isLoading) {
    return (
      <div className="py-6 text-center bg-white rounded-none border border-gray-100">
        <Icons.spinner className="size-5 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon="pieChart"
        title="Reports Coming Soon"
        description="Investment reports and analytics will appear once you have active portfolio engagements."
      />
    );
  }

  const kpis = [
    { label: 'Total Projects', value: data.overview.totalProjects, icon: <Icons.folder className="size-4" />, color: 'text-slate-900', iconBg: 'bg-slate-100' },
    { label: 'Active Engagements', value: data.overview.totalEngagements, icon: <Icons.handshake className="size-4" />, color: 'text-blue-600', iconBg: 'bg-blue-50' },
    { label: 'Total Companies', value: data.overview.totalCompanies, icon: <Icons.building className="size-4" />, color: 'text-green-600', iconBg: 'bg-green-50' },
    { label: 'Avg. Time to Close', value: `${data.avgTimeToClose}d`, icon: <Icons.clock className="size-4" />, color: 'text-amber-600', iconBg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="px-2">
        <p className="dash-section-label mb-0.5">Reports</p>
        <h3 className="text-sm font-semibold text-slate-900">Platform Overview</h3>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(({ label, value, icon, color, iconBg }) => (
          <div key={label} className="bg-white rounded-none border border-gray-100 shadow-soft p-4 flex items-center gap-3">
            <div className={cn('size-9 rounded-none flex items-center justify-center shrink-0', iconBg, color)}>
              {icon}
            </div>
            <div className="min-w-0">
              <p className={cn('text-xl font-black leading-none truncate', color)}>{value}</p>
              <p className="text-[9px] font-bold text-slate-400 tracking-widest mt-1 truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Sector Breakdown */}
      <div className="bg-white rounded-none border border-gray-100 shadow-soft p-5">
        <h4 className="text-xs font-bold text-slate-700 tracking-wider mb-4">Sector Breakdown</h4>
        <div className="space-y-3">
          {data.sectorBreakdown.map(({ sector, count }) => {
            const pct = data.overview.totalProjects > 0 ? Math.round((count / data.overview.totalProjects) * 100) : 0;
            return (
              <div key={sector} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600 w-24 shrink-0 truncate">{sector}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 w-12 text-right">{count} ({pct}%)</span>
              </div>
            );
          })}
          {data.sectorBreakdown.length === 0 && (
            <p className="text-xs text-slate-400 font-medium text-center py-4">No sector data yet.</p>
          )}
        </div>
      </div>

      {/* Engagement Funnel */}
      <div className="bg-white rounded-none border border-gray-100 shadow-soft p-5">
        <h4 className="text-xs font-bold text-slate-700 tracking-wider mb-4">Engagement Funnel</h4>
        <div className="space-y-2">
          {data.engagementFunnel.map(({ stage, count, conversionRate }) => (
            <div key={stage} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
              <span className="text-xs font-semibold text-slate-600 w-32 shrink-0">{stage}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(conversionRate, 100)}%` }} />
              </div>
              <span className="text-xs font-bold text-slate-500 w-16 text-right">{count}</span>
              <span className="text-[10px] font-bold text-slate-400 w-12 text-right">{conversionRate}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Match Distribution */}
      <div className="bg-white rounded-none border border-gray-100 shadow-soft p-5">
        <h4 className="text-xs font-bold text-slate-700 tracking-wider mb-4">Match Distribution</h4>
        <div className="grid grid-cols-3 gap-3">
          {data.matchDistribution.map(({ range, count }) => (
            <div key={range} className="bg-slate-50 rounded-none p-3 text-center">
              <p className="text-lg font-black text-slate-900">{count}</p>
              <p className="text-[9px] font-bold text-slate-400 tracking-widest mt-0.5">{range}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
