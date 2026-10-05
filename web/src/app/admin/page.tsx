'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { KpiBarSkeleton, Skeleton } from '@/components/ui/skeleton';
import { useAdminHealth, useAuditLogs } from '@/hooks/queries';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { AuditLog } from '@/types';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { KitTooltip, CHART_MARGIN } from '@/components/charts/ChartKit';
import { CHART_ACCENT, GRID_PROPS, AXIS_PROPS, BAR_RADIUS } from '@/lib/chart-theme';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCapital(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

function getActionMeta(log: AuditLog): { label: string; category: 'user' | 'org' | 'project' | 'engagement' | 'system' } {
  const entityName = log.after_state?.name || log.after_state?.full_name || log.after_state?.file_name || null;
  const name = entityName ? ` "${entityName}"` : '';
  switch (log.action_type) {
    case 'USER_SIGNED_UP':        return { label: `New user signed up${name}`, category: 'user' };
    case 'USER_PROVISIONED':      return { label: `Admin provisioned user${name}`, category: 'user' };
    case 'USER_UPDATED':          return { label: `Updated user profile${name}`, category: 'user' };
    case 'ONBOARDING_COMPLETED':  return { label: `Completed onboarding${name}`, category: 'user' };
    case 'ONBOARDING_SETUP_COMPANY': return { label: `Created company "${log.after_state?.name || 'Unknown'}"`, category: 'org' };
    case 'ONBOARDING_JOIN_COMPANY':  return { label: `Joined company`, category: 'org' };
    case 'COMPANY_CREATED':       return { label: `Created company "${log.after_state?.name || 'Unknown'}"`, category: 'org' };
    case 'COMPANY_UPDATED':       return { label: `Updated company "${log.after_state?.name || 'Unknown'}"`, category: 'org' };
    case 'ORG_VERIFIED':          return { label: `Verified company "${log.after_state?.name || 'Unknown'}"`, category: 'org' };
    case 'ORG_REJECTED':          return { label: `Rejected company "${log.before_state?.name || 'Unknown'}"`, category: 'org' };
    case 'ORG_NEEDS_UPDATE':      return { label: `Requested update from "${log.before_state?.name || 'Unknown'}"`, category: 'org' };
    case 'PROJECT_CREATED':       return { label: `Submitted project "${log.after_state?.name || 'Unknown'}"`, category: 'project' };
    case 'PROJECT_UPDATED':       return { label: `Updated project "${log.after_state?.name || 'Unknown'}"`, category: 'project' };
    case 'PROJECT_ANALYZED':      return { label: `AI analyzed project${name}`, category: 'project' };
    case 'ENGAGEMENT_CREATED':    return { label: `New engagement created`, category: 'engagement' };
    case 'ENGAGEMENT_UPDATED':    return { label: `Engagement status changed`, category: 'engagement' };
    case 'INVITE_ISSUED':         return { label: `Sent invite to ${log.after_state?.email || 'user'}`, category: 'system' };
    case 'AI_ANALYSIS_COMPLETED': return { label: `AI portfolio analysis completed`, category: 'system' };
    case 'DOCUMENT_UPLOADED':     return { label: `Uploaded document${name}`, category: 'project' };
    default:                      return { label: log.action_type.toLowerCase().replace(/_/g, ' '), category: 'system' };
  }
}

const CATEGORY_STYLES = {
  user:       { icon: 'bg-blue-100 text-blue-600',    IconComponent: Icons.shieldCheck },
  org:        { icon: 'bg-emerald-100 text-emerald-600', IconComponent: Icons.building },
  project:    { icon: 'bg-purple-100 text-purple-600', IconComponent: Icons.folder },
  engagement: { icon: 'bg-orange-100 text-orange-600', IconComponent: Icons.briefcase },
  system:     { icon: 'bg-slate-100 text-slate-500',   IconComponent: Icons.zap },
};

// ── Chart data derived from health ───────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string }> = {
  DEVELOPER:         { label: 'Developer',       color: '#0b3b24' },
  CAPITAL_PARTNER:   { label: 'Capital Partner', color: '#3b82f6' },
  TECHNICAL_PARTNER: { label: 'Tech Partner',    color: '#22c55e' },
  CONSULTANT:        { label: 'Consultant',       color: '#f59e0b' },
  GRANT_PROVIDER:    { label: 'Grant Provider',  color: '#8b5cf6' },
  POWER_TRADER:      { label: 'Power Trader',    color: '#ec4899' },
  ADMIN:             { label: 'Admin',            color: '#64748b' },
};

function buildRoleData(roleBreakdown: Record<string, number>) {
  return Object.entries(roleBreakdown)
    .filter(([, v]) => v > 0)
    .map(([role, value]) => ({
      name: ROLE_META[role]?.label ?? role,
      value,
      color: ROLE_META[role]?.color ?? '#94a3b8',
    }))
    .sort((a, b) => b.value - a.value);
}

function buildActiveUsersData(health: { activeUsers: { dau: number; wau: number }; totalUsers: number }) {
  return [
    { label: 'Daily', value: health.activeUsers.dau, fill: '#0b3b24' },
    { label: 'Weekly', value: health.activeUsers.wau, fill: '#22c55e' },
    { label: 'Total', value: health.totalUsers, fill: '#e2e8f0' },
  ];
}

function buildPipelineData(health: { totalProjects: number; pendingReviewCount: number; totalEngagements: number }) {
  const active = Math.max(0, health.totalProjects - health.pendingReviewCount);
  return [
    { name: 'Active', value: active, color: '#0b3b24' },
    { name: 'In Review', value: health.pendingReviewCount, color: '#f59e0b' },
    { name: 'Engaged', value: health.totalEngagements, color: '#3b82f6' },
  ];
}

// ── Skeleton helpers ──────────────────────────────────────────────────────────

function ActivitySkeleton() {
  return (
    <div className="divide-y divide-slate-50">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-5 py-3.5 flex items-center gap-3.5">
          <Skeleton className="size-9 ounded-xl shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton({ h = 'h-48' }: { h?: string }) {
  return <div className={`${h} bg-slate-50 animate-pulse`} />;
}

// (Chart tooltip now comes from components/charts/ChartKit)

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, accent = false, href,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: boolean; href?: string;
}) {
  const inner = (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">{label}</span>
        <span className="grid size-8 place-items-center rounded-none bg-brand-soft text-brand-text">
          <Icon className="size-4" />
        </span>
      </div>
      <div className="px-4 pb-4 pt-1">
        <p className={`text-2xl font-bold tracking-tight ${accent ? 'text-blue-600' : 'text-slate-900'}`}>{value}</p>
        {sub && <p className={`text-[11px] font-semibold mt-0.5 ${accent ? 'text-blue-500' : 'text-slate-400'}`}>{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

// ── Section card wrapper ──────────────────────────────────────────────────────

function SectionCard({ title, label, action, children }: {
  title: string; label?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
        <div>
          {label && <p className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3 mb-0.5">{label}</p>}
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { data: health, isLoading: loadingHealth } = useAdminHealth();
  const { data: activities = [], isLoading: loadingAudit } = useAuditLogs();

  const growthData = health?.monthlyGrowth ?? [];
  const pipelineData = health ? buildPipelineData(health) : [];
  const roleData = health ? buildRoleData(health.roleBreakdown ?? {}) : [];
  const activeUsersData = health ? buildActiveUsersData(health) : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Admin" />

      {/* ── Header (canonical dark-green page header) ─────── */}
      <PageHero
        eyebrow="Admin Overview"
        title={`Welcome back, ${user?.full_name?.split(' ')[0] || 'Admin'}`}
        description="Platform performance and status at a glance."
        actions={
          <>
            <Button
              variant="outline"
              className="h-9 px-4 bg-white/10 border-white/15 text-white hover:bg-white/20"
              icon={<Icons.download />}
              onClick={() => window.print()}
            >
              Export
            </Button>
            <Link href="/admin/users">
              <Button className="h-9 px-4" icon={<Icons.plus />}>Provision User</Button>
            </Link>
          </>
        }
      />

      {/* ── KPI Strip ──────────────────────────────────────────── */}
      {loadingHealth ? (
        <KpiBarSkeleton />
      ) : health && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            label="Total Users"
            value={health.totalUsers}
            sub={`+${health.trends.users.pct}% vs last 30d`}
            icon={Icons.shieldCheck}
          />
          <KpiCard
            label="Active Projects"
            value={health.totalProjects}
            sub={`+${health.trends.projects.pct}% vs last 30d`}
            icon={Icons.folder}
          />
          <KpiCard
            label="Companies"
            value={health.totalCompanies}
            sub={`+${health.trends.companies.pct}% vs last 30d`}
            icon={Icons.building}
          />
          <KpiCard
            label="Capital Pipeline"
            value={formatCapital(health.totalCapital)}
            sub={`+${health.trends.capital.pct}% vs last 30d`}
            icon={Icons.dollarSign}
          />
          <KpiCard
            label="Pending Reviews"
            value={health.pendingReviewCount}
            sub={health.pendingReviewCount > 0 ? 'Action required' : 'All caught up'}
            icon={Icons.eye}
            accent={health.pendingReviewCount > 0}
            href="/admin/review"
          />
        </div>
      )}

      {/* ── Row 1: Growth Chart + Pipeline Donut ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Platform Growth — area chart */}
        <div className="lg:col-span-2">
          <SectionCard title="Platform Growth" label="6-Month Trend">
            <div className="p-5">
              {loadingHealth ? <ChartSkeleton h="h-52" /> : (
                <>
                  <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Cumulative totals · records by month end
                  </p>
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={growthData} margin={CHART_MARGIN}>
                    <defs>
                      <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0b3b24" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#0b3b24" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gProjects" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gEngagements" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="month" {...AXIS_PROPS} />
                    <YAxis
                      {...AXIS_PROPS}
                      width={36}
                      allowDecimals={false}
                      domain={[0, (dataMax: number) => Math.max(2, dataMax)]}
                    />
                    <KitTooltip />
                    <Area type="monotone" dataKey="users" name="Users (total registered)" stroke="#0b3b24" strokeWidth={2} fill="url(#gUsers)" dot={{ r: 3, strokeWidth: 2, stroke: '#fff', fill: '#0b3b24' }} activeDot={{ r: 4 }} />
                    <Area type="monotone" dataKey="projects" name="Projects (total)" stroke="#3b82f6" strokeWidth={2} fill="url(#gProjects)" dot={{ r: 3, strokeWidth: 2, stroke: '#fff', fill: '#3b82f6' }} activeDot={{ r: 4 }} />
                    <Area type="monotone" dataKey="engagements" name="Engagements (total)" stroke="#f59e0b" strokeWidth={2} fill="url(#gEngagements)" dot={{ r: 3, strokeWidth: 2, stroke: '#fff', fill: '#f59e0b' }} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
                </>
              )}
              {/* Legend */}
              <div className="flex items-center gap-5 mt-3 px-1">
                {[
                  { color: '#0b3b24', label: 'Users' },
                  { color: '#3b82f6', label: 'Projects' },
                  { color: '#f59e0b', label: 'Engagements' },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    <span className="size-2 rounded-full" style={{ background: color }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Project Pipeline — donut */}
        <SectionCard title="Project Pipeline" label="Status Breakdown">
          <div className="p-5 flex flex-col items-center">
            {loadingHealth ? <ChartSkeleton h="h-52" /> : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pipelineData}
                      cx="50%"
                      cy="50%"
                      innerRadius="62%"
                      outerRadius="88%"
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pipelineData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <KitTooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-2 mt-1">
                  {pipelineData.map(({ name, value, color }) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[12px] font-semibold text-slate-600">
                        <span className="size-2.5 rounded-full" style={{ background: color }} />
                        {name}
                      </span>
                      <span className="text-[12px] font-bold text-slate-800">{value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </SectionCard>
      </div>

      {/* ── Row 2: Profile Mix + Active Users + Queues + Activity ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

        {/* User Profile Mix — donut + vertical bar side by side */}
        <SectionCard title="User Profiles" label="Platform Composition">
          <div className="p-5 space-y-4">
            {loadingHealth ? <ChartSkeleton h="h-44" /> : (
              <>
                {/* Donut */}
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={roleData} cx="50%" cy="50%" innerRadius="62%" outerRadius="88%" paddingAngle={2} dataKey="value" strokeWidth={0}>
                      {roleData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <KitTooltip />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend rows with % */}
                <div className="space-y-1.5">
                  {roleData.map(({ name, value, color }) => {
                    const total = roleData.reduce((s, r) => s + r.value, 0);
                    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                    return (
                      <div key={name} className="flex items-center gap-2">
                        <span className="size-2 rounded-full shrink-0" style={{ background: color }} />
                        <span className="text-[11px] font-semibold text-slate-600 flex-1">{name}</span>
                        <span className="text-[11px] font-bold text-slate-800">{value}</span>
                        <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </SectionCard>

        {/* Active Users — vertical bar */}
        <SectionCard title="Active Users" label="Daily · Weekly · Total">
          <div className="p-5">
            {loadingHealth ? <ChartSkeleton h="h-44" /> : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={activeUsersData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="label" {...AXIS_PROPS} />
                    <YAxis {...AXIS_PROPS} allowDecimals={false} width={32} />
                    <KitTooltip />
                    <Bar dataKey="value" name="Users" radius={BAR_RADIUS} maxBarSize={36} fill={CHART_ACCENT.primary}>
                      {activeUsersData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* DAU / WAU callout */}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="border border-slate-100 px-3 py-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Daily Active</p>
                    <p className="text-xl font-bold text-[#0b3b24]">{health?.activeUsers.dau ?? 0}</p>
                    <p className="text-[10px] text-slate-400">Last 24 hours</p>
                  </div>
                  <div className="border border-slate-100 px-3 py-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Weekly Active</p>
                    <p className="text-xl font-bold text-[#22c55e]">{health?.activeUsers.wau ?? 0}</p>
                    <p className="text-[10px] text-slate-400">Last 7 days</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </SectionCard>

        {/* Action Queues */}
        <SectionCard title="Action Queues" label="Requires Attention">
          <div className="p-4 space-y-3">
            {loadingHealth ? (
              <ChartSkeleton h="h-36" />
            ) : health && (
              <>
                {[
                  {
                    label: 'Verification Queue',
                    count: health.pendingVerifications,
                    href: '/admin/users?pending=true',
                    color: health.pendingVerifications > 0 ? 'bg-brand-soft text-brand-text' : 'bg-slate-100 text-slate-400',
                    icon: Icons.shieldCheck,
                  },
                  {
                    label: 'Project Review Queue',
                    count: health.pendingReviewCount,
                    href: '/admin/review',
                    color: health.pendingReviewCount > 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400',
                    icon: Icons.eye,
                  },
                  {
                    label: 'Total Engagements',
                    count: health.totalEngagements,
                    href: '/admin/engagements',
                    color: 'bg-slate-100 text-slate-600',
                    icon: Icons.briefcase,
                  },
                ].map(({ label, count, href, color, icon: Icon }) => (
                  <Link key={label} href={href} className="flex items-center justify-between px-3.5 py-2.5 border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors">
                    <span className="flex items-center gap-2.5 text-[13px] font-semibold text-slate-700">
                      <Icon className="size-4 text-slate-400" />
                      {label}
                    </span>
                    <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded ${color}`}>
                      {count}
                    </span>
                  </Link>
                ))}

                {/* Capital bar */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Capital Pipeline</span>
                    <span className="text-[12px] font-bold text-[#0b3b24]">{formatCapital(health.totalCapital)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full"
                      style={{ width: `${Math.min(100, (health.totalCapital / 1_000_000_000) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">vs $1B target</p>
                </div>
              </>
            )}
          </div>
        </SectionCard>

        {/* Recent Activity */}
        <SectionCard
          title="Recent Actions"
          label="System Activity"
          action={
            <Link href="/admin/users">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white text-[11px] uppercase tracking-widest h-7 px-2.5">
                View All
              </Button>
            </Link>
          }
        >
          {loadingAudit ? (
            <ActivitySkeleton />
          ) : (activities ?? []).length > 0 ? (
            <div className="divide-y divide-slate-50">
              {(activities ?? []).slice(0, 5).map((log) => {
                const meta = getActionMeta(log);
                const style = CATEGORY_STYLES[meta.category];
                const CatIcon = style.IconComponent;
                return (
                  <div key={log.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50/60">
                    <div className={`size-8 rounded-none flex items-center justify-center shrink-0 ${style.icon}`}>
                      <CatIcon className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] leading-snug truncate">
                        <span className="font-semibold text-slate-900">{log.user?.full_name || 'System'}</span>
                        <span className="text-slate-500 ml-1">{meta.label}</span>
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {formatTime(log.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center text-[13px] text-slate-400 font-medium">No recent activity.</div>
          )}
        </SectionCard>
      </div>

      {/* ── Row 3: Quick Links ──────────────────────────────────── */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3 mb-0.5">Navigation</p>
          <h3 className="text-sm font-semibold text-ink">Quick Links</h3>
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { href: '/admin/users',      icon: Icons.shieldCheck, label: 'User Audit',         badge: null },
            { href: '/admin/review',     icon: Icons.eye,         label: 'Review Queue',       badge: health?.pendingReviewCount },
            { href: '/admin/companies',  icon: Icons.building,    label: 'Companies',          badge: null },
            { href: '/admin/projects',   icon: Icons.folder,      label: 'All Projects',       badge: null },
            { href: '/admin/ai-overview',icon: Icons.cpu,         label: 'AI Analysis',        badge: null },
            { href: '/admin/analytics',  icon: Icons.barChart2,   label: 'Analytics',          badge: null },
          ].map(({ href, icon: Icon, label, badge }) => (
            <Link key={href} href={href} className="relative flex flex-col items-center gap-2 p-3.5 border border-slate-100 hover:border-brand/30 hover:bg-brand-soft transition-colors group">
              <span className="flex items-center justify-center size-9 bg-slate-50 group-hover:bg-brand-soft transition-colors">
                <Icon className="size-4 text-slate-400 group-hover:text-[#0b3b24]" />
              </span>
              <p className="text-[12px] font-semibold text-slate-600 group-hover:text-slate-900 text-center leading-tight">{label}</p>
              {badge != null && badge > 0 && (
                <span className="absolute top-2 right-2 size-4 rounded-full bg-blue-500 text-white text-[9px] font-black flex items-center justify-center">
                  {badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
