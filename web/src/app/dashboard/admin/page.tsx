'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { KpiBarSkeleton, Skeleton } from '@/components/ui/skeleton';
import { useAdminHealth, useAuditLogs } from '@/hooks/queries';
import { AuditLog } from '@/types';

function formatCapital(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return '$0';
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

function getActionMeta(log: AuditLog): { label: string; category: 'user' | 'org' | 'project' | 'engagement' | 'system' } {
  const entityName = log.after_state?.name
    || log.after_state?.full_name
    || log.after_state?.file_name
    || null;

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
    case 'ORG_VERIFIED':          return { label: `Verified company "${log.after_state?.name || log.after_state?.status || 'Unknown'}"`, category: 'org' };
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
  user:        { bg: 'bg-blue-50',    icon: 'bg-blue-100 text-blue-600',    IconComponent: Icons.shieldCheck },
  org:         { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', IconComponent: Icons.building },
  project:     { bg: 'bg-purple-50',  icon: 'bg-purple-100 text-purple-600', IconComponent: Icons.folder },
  engagement:  { bg: 'bg-orange-50',  icon: 'bg-orange-100 text-orange-600', IconComponent: Icons.briefcase },
  system:      { bg: 'bg-slate-50',   icon: 'bg-slate-100 text-slate-500',   IconComponent: Icons.zap },
};

function TrendBadge({ pct, positive }: { pct: number; positive: boolean }) {
  if (pct === 0) return null;
  return (
    <span className={`text-[10px] font-semibold ${
      positive ? 'text-green-600' : 'text-red-500'
    }`}>
      {positive ? '+' : '-'}{pct}% vs last 30d
    </span>
  );
}

function ActivitySkeleton() {
  return (
    <div className="divide-y divide-slate-50">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-5 py-3.5 flex items-center gap-3.5">
          <Skeleton className="size-9 rounded-xl shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CommandCenterSkeleton() {
  return (
    <div className="rounded-2xl p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      <div className="space-y-5 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-white/10" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32 bg-white/20" />
            <Skeleton className="h-2.5 w-24 bg-white/10" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between"><Skeleton className="h-2.5 w-20 bg-white/10" /><Skeleton className="h-2.5 w-10 bg-white/10" /></div>
            <Skeleton className="h-1 w-full bg-white/10 rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><Skeleton className="h-2.5 w-16 bg-white/10" /><Skeleton className="h-2.5 w-8 bg-white/10" /></div>
            <Skeleton className="h-1 w-full bg-white/10 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full bg-white/5 rounded-xl" />
        </div>
        <Skeleton className="h-9 w-full bg-white/10 rounded-xl" />
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { data: health, isLoading: loadingHealth } = useAdminHealth();
  const { data: activities = [], isLoading: loadingAudit } = useAuditLogs();



  const loading = loadingHealth || loadingAudit;

  return (
    <div className="space-y-8">
      {/* ── Welcome Section ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="dash-section-label mb-1">Admin Overview</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Admin'}
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Platform performance and status at a glance.
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button
            variant="outline"
            className="h-9 px-4 rounded-xl"
            icon={<Icons.download />}
            onClick={() => window.print()}
          >
            Export
          </Button>
          <Link href="/dashboard/admin/users">
            <Button
              className="h-9 px-4 rounded-xl"
              icon={<Icons.plus />}
            >
              Provision User
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Stats Grid ───────────────────────────────────── */}
      {loadingHealth ? (
        <KpiBarSkeleton />
      ) : health && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Users"
            value={health.totalUsers}
            icon={Icons.shieldCheck}
            trend={{ label: `${health.trends.users.pct > 0 ? '+' : ''}${health.trends.users.pct}% vs last 30d`, positive: health.trends.users.positive }}
          />
          <StatCard
            label="Active Projects"
            value={health.totalProjects}
            icon={Icons.folder}
            trend={{ label: `${health.trends.projects.pct > 0 ? '+' : ''}${health.trends.projects.pct}% vs last 30d`, positive: health.trends.projects.positive }}
          />
          <StatCard
            label="Platform Companies"
            value={health.totalCompanies}
            icon={Icons.building}
            trend={{ label: `${health.trends.companies.pct > 0 ? '+' : ''}${health.trends.companies.pct}% vs last 30d`, positive: health.trends.companies.positive }}
          />
          <StatCard
            label="Capital Pipeline"
            value={formatCapital(health.totalCapital)}
            icon={Icons.dollarSign}
            trend={{ label: `${health.trends.capital.pct > 0 ? '+' : ''}${health.trends.capital.pct}% vs last 30d`, positive: health.trends.capital.positive }}
          />
        </div>
      )}

      {/* ── Main Grid ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Recent Activity ──────────────────────────────── */}
        <div className="lg:col-span-2 dash-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
            <div>
              <p className="dash-section-label mb-0.5">System Activity</p>
              <h3 className="text-sm font-semibold text-slate-900">Recent Actions</h3>
            </div>
            <Link href="/dashboard/admin/users">
              <Button variant="ghost" size="sm" className="text-primary font-semibold text-[11px] uppercase tracking-[0.1em] h-8 px-3">
                View All
              </Button>
            </Link>
          </div>
          {loadingAudit ? (
            <ActivitySkeleton />
          ) : (activities ?? []).length > 0 ? (
            <div className="divide-y divide-slate-50">
              {(activities ?? []).slice(0, 5).map((log) => {
                const meta = getActionMeta(log);
                const style = CATEGORY_STYLES[meta.category];
                const CatIcon = style.IconComponent;
                return (
                  <div key={log.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/60">
                    <div className="flex items-center gap-3.5">
                      <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${style.icon}`}>
                        <CatIcon className="size-4" />
                      </div>
                      <div>
                        <p className="text-[13px] leading-snug">
                          <span className="font-semibold text-slate-900">{log.user?.full_name || 'System'}</span>
                          <span className="text-slate-500 mx-1">{meta.label}</span>
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-0.5">
                          {formatTime(log.timestamp)}
                        </p>
                      </div>
                    </div>
                    <div className="size-1.5 rounded-full bg-primary/40 shrink-0" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-[13px] text-slate-400 font-medium">
              No recent activity.
            </div>
          )}
        </div>

        {/* ── Right Column ─────────────────────────────────── */}
        <div className="space-y-5">

          {/* Command Center */}
          {loadingHealth ? (
            <CommandCenterSkeleton />
          ) : health && (
            <div className="rounded-2xl p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
              <div className="absolute top-0 right-0 w-28 h-28 bg-primary/10 rounded-full blur-3xl -mr-14 -mt-14" />

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 rounded-xl bg-primary/20 text-primary-light border border-primary/20">
                    <Icons.zap className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-none">Command Center</p>
                    <p className="dash-section-label mt-1 text-slate-500">Live Intelligence</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="dash-section-label text-slate-500">Total Engagements</span>
                      <span className="text-xs font-bold text-green-400 font-mono">{health.totalEngagements}</span>
                    </div>
                    <div className="dash-progress">
                      <div className="dash-progress-fill" style={{ width: `${Math.min(100, (health.totalEngagements / Math.max(health.totalProjects, 1)) * 100)}%` }} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="dash-section-label text-slate-500">Projects Active</span>
                      <span className="text-xs font-bold text-green-400 font-mono">{health.totalProjects}</span>
                    </div>
                    <div className="dash-progress">
                      <div className="dash-progress-fill" style={{ width: `${Math.min(100, health.totalProjects)}%` }} />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    <Link href="/dashboard/admin/users?pending=true" className="flex justify-between items-center bg-white/5 px-3.5 py-2.5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                      <span className="dash-section-label text-slate-500">Verification Queue</span>
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg ${health.pendingVerifications > 0 ? 'bg-primary text-white' : 'bg-white/10 text-slate-400'}`}>
                        {health.pendingVerifications} PENDING
                      </span>
                    </Link>
                  </div>
                </div>
              </div>

              <Link href="/dashboard/admin/users">
                <Button variant="white" className="w-full mt-6 h-9 font-semibold text-[13px]">
                  Manage Users
                </Button>
              </Link>
            </div>
          )}

          {/* Quick Links */}
          <div className="dash-card p-5">
            <p className="dash-section-label mb-3">Quick Links</p>
            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/dashboard/admin/users" className="dash-quick-link group">
                <span className="flex items-center justify-center size-8 rounded-lg bg-slate-100 mb-2.5 group-hover:bg-primary/10">
                  <Icons.shieldCheck className="size-4 text-slate-400 group-hover:text-primary" />
                </span>
                <p className="text-[12px] font-semibold text-slate-700 group-hover:text-slate-900">User Audit</p>
              </Link>
              <Link href="/dashboard/admin/projects" className="dash-quick-link group">
                <span className="flex items-center justify-center size-8 rounded-lg bg-slate-100 mb-2.5 group-hover:bg-primary/10">
                  <Icons.folder className="size-4 text-slate-400 group-hover:text-primary" />
                </span>
                <p className="text-[12px] font-semibold text-slate-700 group-hover:text-slate-900">All Projects</p>
              </Link>
              <Link href="/dashboard/admin/companies" className="dash-quick-link group">
                <span className="flex items-center justify-center size-8 rounded-lg bg-slate-100 mb-2.5 group-hover:bg-primary/10">
                  <Icons.building className="size-4 text-slate-400 group-hover:text-primary" />
                </span>
                <p className="text-[12px] font-semibold text-slate-700 group-hover:text-slate-900">Companies</p>
              </Link>
              <Link href="/dashboard/admin/ai-overview" className="dash-quick-link group">
                <span className="flex items-center justify-center size-8 rounded-lg bg-slate-100 mb-2.5 group-hover:bg-primary/10">
                  <Icons.cpu className="size-4 text-slate-400 group-hover:text-primary" />
                </span>
                <p className="text-[12px] font-semibold text-slate-700 group-hover:text-slate-900">AI Analysis</p>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
