'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DonutStat, KitTooltip, CHART_MARGIN } from '@/components/charts/ChartKit';
import {
  STAGE_COLORS as STAGE_COLOR_MAP,
  ENGAGEMENT_STATUS_COLORS,
  GRID_PROPS,
  AXIS_PROPS,
  BAR_RADIUS,
} from '@/lib/chart-theme';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  project_stage: string;
  project_size_mw: number | null;
  capital_required: number | null;
  technology_type: string | null;
  location_country: string | null;
  created_at: string;
  updated_at: string;
  developer?: { name: string } | null;
  scores?: { capital_readiness_score: number | null } | null;
  documents?: { id: string }[] | null;
};

type EngagementRow = {
  id: string;
  status: string;
  counterparty_type: string;
  created_at: string;
  updated_at: string;
  project?: { name: string; developer?: { name: string } | null } | null;
};

type OrgRow = {
  id: string;
  name: string;
  status: string;
  primary_role: string;
  country: string | null;
  company_members?: { role: string }[] | null;
};

// ── Design tokens (from the AfriConnect UI mock) ───────────────────────────
// brand #1f9d55 · brand-text #166b3b · brand-soft #e9f6ee · copper #9a4b0e /
// #faf0e2 · border #e3e9e5 / strong #cfdad3 · text #16241c / 2 #4a5c52 /
// 3 #7c8b82 · surface-2 #f0f4f1 · badge palette blue/green/amber/slate/red.

const STAGE_COLORS: Record<string, string> = STAGE_COLOR_MAP;

const STAGE_LABELS: Record<string, string> = {
  CONCEPT: 'Concept', PRE_FEASIBILITY: 'Pre-Feasibility', FULL_FEASIBILITY: 'Full Feasibility',
  REGULATORY_APPROVAL: 'Regulatory', PPA_READY: 'PPA Ready', FINANCIAL_CLOSE: 'Fin. Close',
  CONSTRUCTION: 'Construction', OPERATION: 'Operation',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function money(n: number) {
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
  return days < 7 ? `${days}d ago` : new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AuthorityDashboardPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [engagements, setEngagements] = useState<EngagementRow[]>([]);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [projRes, engRes, orgRes] = await Promise.all([
          fetch('/api/authority/projects?status=ALL&pageSize=200'),
          fetch('/api/authority/engagements?status=ALL&pageSize=200'),
          fetch('/api/authority/organizations?status=ALL&pageSize=200'),
        ]);
        const [projJson, engJson, orgJson] = await Promise.all([
          projRes.json(), engRes.json(), orgRes.json(),
        ]);
        setProjects(projJson.data ?? []);
        setEngagements(engJson.data ?? []);
        setOrgs(orgJson.data ?? []);
      } catch {
        toast.error('Could not load dashboard data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────

  const pendingProjects = useMemo(() => projects.filter(p => p.status === 'under_review'), [projects]);
  const liveProjects = useMemo(() => projects.filter(p => p.status === 'live'), [projects]);
  const activeEngagements = useMemo(() => engagements.filter(e => !['CLOSED', 'DROPPED'].includes(e.status)), [engagements]);
  const verifiedOrgs = useMemo(() => orgs.filter(o => o.status === 'verified'), [orgs]);
  const pendingOrgs = useMemo(() => orgs.filter(o => o.status === 'pending_verification'), [orgs]);
  const totalCapacity = useMemo(() => projects.reduce((s, p) => s + (p.project_size_mw ?? 0), 0), [projects]);
  const totalCapital = useMemo(() => projects.reduce((s, p) => s + (p.capital_required ?? 0), 0), [projects]);
  const avgScore = useMemo(() => {
    const scored = projects.filter(p => (p.scores?.capital_readiness_score ?? 0) > 0);
    if (scored.length === 0) return 0;
    return Math.round(scored.reduce((s, p) => s + (p.scores?.capital_readiness_score ?? 0), 0) / scored.length);
  }, [projects]);

  // ── Stage distribution ────────────────────────────────────────────────

  const stageBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => { const s = p.project_stage || 'CONCEPT'; counts[s] = (counts[s] || 0) + 1; });
    return ['CONCEPT', 'PRE_FEASIBILITY', 'FULL_FEASIBILITY', 'REGULATORY_APPROVAL', 'PPA_READY', 'FINANCIAL_CLOSE', 'CONSTRUCTION', 'OPERATION']
      .filter(s => counts[s] > 0)
      .map(s => ({ stage: s, label: STAGE_LABELS[s], count: counts[s], color: STAGE_COLORS[s] }));
  }, [projects]);

  // ── Status distribution for engagements ────────────────────────────────

  const engagementStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    engagements.forEach(e => { counts[e.status] = (counts[e.status] || 0) + 1; });
    const labels = Object.keys(counts);
    const data = Object.values(counts);
    const colors = labels.map(l => ENGAGEMENT_STATUS_COLORS[l] || '#94a3b8');
    return { labels, data, colors };
  }, [engagements]);

  // ── Action items ──────────────────────────────────────────────────────

  const actionItems = useMemo(() => {
    const items: { id: string; title: string; description: string; severity: 'critical' | 'warning' | 'info'; href: string; icon: keyof typeof Icons }[] = [];

    if (pendingProjects.length > 0) {
      items.push({
        id: 'pending-review', title: `${pendingProjects.length} project${pendingProjects.length > 1 ? 's' : ''} awaiting review`,
        description: 'Projects submitted for regulatory review need your assessment.',
        severity: 'critical', href: '/authority/projects', icon: 'clock',
      });
    }

    pendingProjects.slice(0, 3).forEach(p => {
      items.push({
        id: `review-${p.id}`, title: `Review "${p.name}"`,
        description: `${p.technology_type ?? '—'} · ${p.project_size_mw ?? '—'} MW · ${money(p.capital_required ?? 0)}`,
        severity: 'warning', href: `/authority/projects?search=${encodeURIComponent(p.name)}`, icon: 'folder',
      });
    });

    if (pendingOrgs.length > 0) {
      items.push({
        id: 'pending-orgs', title: `${pendingOrgs.length} organisation${pendingOrgs.length > 1 ? 's' : ''} pending verification`,
        description: 'New organisations waiting for profile verification.',
        severity: 'info', href: '/authority/organizations', icon: 'building',
      });
    }

    return items.slice(0, 5);
  }, [pendingProjects, pendingOrgs]);

  // ── Recent activity ───────────────────────────────────────────────────

  const recentActivity = useMemo(() => {
    return engagements
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5)
      .map(e => ({
        id: e.id,
        text: `${e.project?.developer?.name || 'Developer'} — ${e.project?.name || 'project'}`,
        detail: `${e.counterparty_type.replace(/_/g, ' ')} · ${e.status.replace(/_/g, ' ')}`,
        time: fmtRelative(e.updated_at),
      }));
  }, [engagements]);

  // ── Technology breakdown ──────────────────────────────────────────────

  const techData = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => { const t = p.technology_type || 'Solar'; counts[t] = (counts[t] || 0) + 1; });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const techColors: Record<string, string> = { Solar: '#f59e0b', Wind: '#3b82f6', Hydro: '#06b6d4', Biomass: '#22c55e', Storage: '#8b5cf6' };
    return {
      labels: entries.map(([k]) => k),
      data: entries.map(([, v]) => v),
      colors: entries.map(([k]) => techColors[k] || '#94a3b8'),
    };
  }, [projects]);

  const heroStats: { value: React.ReactNode; label: string }[] = [
    { value: pendingProjects.length, label: 'Pending review' },
    { value: liveProjects.length, label: 'Approved live' },
    { value: `${totalCapacity.toLocaleString()} MW`, label: 'Total capacity' },
    { value: money(totalCapital), label: 'Capital tracked' },
    { value: activeEngagements.length, label: 'Active engagements' },
    { value: `${avgScore}%`, label: 'Avg. readiness' },
  ];

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-500">

      {/* ══ HERO — gradient banner with actions + stats strip (mock .hero) ══ */}
      <section
        className="relative overflow-hidden rounded-none px-8 py-[30px] text-[#dff0e4] shadow-[0_14px_34px_-14px_rgba(12,43,27,0.5)]"
        style={{
          background:
            'radial-gradient(900px 340px at 88% -30%, rgba(96,220,140,0.16), transparent 60%),' +
            'radial-gradient(520px 240px at -8% 115%, rgba(96,220,140,0.10), transparent 60%),' +
            'linear-gradient(118deg, #0c2b1b, #14532d 55%, #176239)',
        }}
      >
        <Icons.zap className="pointer-events-none absolute -bottom-[58px] -right-9 size-[300px] text-white opacity-[0.05]" strokeWidth={1.4} />

        <div className="relative flex flex-wrap items-start justify-between gap-[22px]">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#93d0a9]">
              <Icons.shield className="size-3.5" />
              Regulator Portal · Zambia Energy Market
            </span>
            <h1 className="mt-2.5 text-[27px] font-bold leading-tight tracking-[-0.02em] text-white">Regulatory Dashboard</h1>
            <p className="mt-1.5 max-w-[60ch] text-sm text-[#b7d6c2]">
              Oversee <strong className="font-semibold text-[#e9f7ee]">{projects.length} project{projects.length !== 1 ? 's' : ''}</strong> and{' '}
              <strong className="font-semibold text-[#e9f7ee]">{orgs.length} organisation{orgs.length !== 1 ? 's' : ''}</strong> — reviews,
              approvals and engagement activity at a glance.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/authority/projects"
              className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-none border border-white/20 bg-white/[0.12] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/[0.22]"
            >
              <Icons.clock className="size-4" />
              Review queue
              {pendingProjects.length > 0 && (
                <span className="rounded-full bg-white/[0.22] px-2 py-0.5 text-[11.5px] font-extrabold">{pendingProjects.length}</span>
              )}
            </Link>
            <Link
              href="/authority/organizations"
              className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-none bg-white px-4 text-[13.5px] font-semibold text-[#123a26] transition-colors hover:bg-[#e9f6ee]"
            >
              <Icons.building className="size-4" />
              Organisations
            </Link>
          </div>
        </div>

        <div className="relative mt-[26px] flex flex-wrap border-t border-white/[0.14] pt-[18px]">
          {heroStats.map((s, i) => (
            <div key={s.label} className={cn('py-1', i === 0 ? 'pr-[30px]' : 'border-l border-white/[0.14] px-[30px]')}>
              <div className="text-[22px] font-extrabold tracking-[-0.01em] text-white">
                {loading ? <span className="inline-block h-6 w-12 animate-pulse rounded bg-white/20" /> : s.value}
              </div>
              <div className="mt-0.5 text-[11.5px] text-[#9cc6ab]">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ Main grid ═══════════════════════════════════════════════════ */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* ── Left: Action Center + charts ──────────────────────────── */}
        <div className="space-y-5 lg:col-span-2">

          {/* Action Center (mock .card + .row pattern) */}
          {actionItems.length > 0 && (
            <section className="overflow-hidden rounded-none border border-[#e3e9e5] bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
              <div className="flex flex-wrap items-center gap-3.5 border-b border-[#e3e9e5] px-[22px] py-[17px]">
                <span className="grid size-10 shrink-0 place-items-center rounded-none bg-[#e9f6ee] text-[#166b3b]">
                  <Icons.bell className="size-[18px]" />
                </span>
                <div>
                  <div className="text-[15px] font-bold text-[#16241c]">Action Center</div>
                  <div className="text-[12.5px] text-[#7c8b82]">Projects and organisations needing your attention</div>
                </div>
              </div>
              <div>
                {actionItems.map((item, idx) => {
                  const ActionIcon = Icons[item.icon];
                  const tone = {
                    critical: { bg: 'bg-[#fee2e2]', fg: 'text-[#b91c1c]' },
                    warning: { bg: 'bg-[#fdf0d2]', fg: 'text-[#92400e]' },
                    info: { bg: 'bg-[#dbeafe]', fg: 'text-[#1d4ed8]' },
                  }[item.severity];
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={cn(
                        'group flex items-center gap-3.5 px-[22px] py-3.5 transition-colors hover:bg-[#f0f4f1]',
                        idx > 0 && 'border-t border-[#e3e9e5]'
                      )}
                    >
                      <span className={cn('grid size-9 shrink-0 place-items-center rounded-none', tone.bg, tone.fg)}>
                        <ActionIcon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-[#16241c]">{item.title}</span>
                        <span className="mt-0.5 block text-xs text-[#7c8b82]">{item.description}</span>
                      </span>
                      <Icons.chevronRight className="size-4 shrink-0 text-[#cfdad3] transition-colors group-hover:text-[#166b3b]" />
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Projects by Stage */}
          {projects.length > 0 && (
            <section className="overflow-hidden rounded-none border border-[#e3e9e5] bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
              <div className="flex flex-wrap items-center gap-3.5 border-b border-[#e3e9e5] px-[22px] py-[17px]">
                <span className="grid size-10 shrink-0 place-items-center rounded-none bg-[#e9f6ee] text-[#166b3b]">
                  <Icons.folder className="size-[18px]" />
                </span>
                <div>
                  <div className="text-[15px] font-bold text-[#16241c]">Projects by stage <span className="rounded-full border border-[#e3e9e5] bg-[#f0f4f1] px-[9px] py-px align-[2px] text-[11px] font-bold text-[#4a5c52]">{projects.length}</span></div>
                  <div className="text-[12.5px] text-[#7c8b82]">Portfolio spread across the development lifecycle</div>
                </div>
                <Link href="/authority/projects" className="ml-auto text-[13px] font-semibold text-[#166b3b] hover:underline">View all</Link>
              </div>
              <div className="p-[22px]">
                <DonutStat
                  slices={stageBreakdown.map(s => ({ label: s.label, value: s.count, color: s.color }))}
                  centerValue={projects.length}
                  centerLabel="projects"
                />
              </div>
            </section>
          )}

          {/* Engagement status */}
          {engagements.length > 0 && (
            <section className="overflow-hidden rounded-none border border-[#e3e9e5] bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
              <div className="flex flex-wrap items-center gap-3.5 border-b border-[#e3e9e5] px-[22px] py-[17px]">
                <span className="grid size-10 shrink-0 place-items-center rounded-none bg-[#faf0e2] text-[#9a4b0e]">
                  <Icons.messageSquare className="size-[18px]" />
                </span>
                <div>
                  <div className="text-[15px] font-bold text-[#16241c]">Engagement status <span className="rounded-full border border-[#e3e9e5] bg-[#f0f4f1] px-[9px] py-px align-[2px] text-[11px] font-bold text-[#4a5c52]">{engagements.length}</span></div>
                  <div className="text-[12.5px] text-[#7c8b82]">Live deal-flow across every pipeline state</div>
                </div>
                <Link href="/authority/engagements" className="ml-auto text-[13px] font-semibold text-[#166b3b] hover:underline">View all</Link>
              </div>
              <div className="h-52 p-[22px] pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={engagementStatusData.labels.map((label, i) => ({
                      name: label.replace(/_/g, ' ').toLowerCase(),
                      value: engagementStatusData.data[i],
                      color: engagementStatusData.colors[i],
                    }))}
                    margin={CHART_MARGIN}
                  >
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis
                      dataKey="name"
                      {...AXIS_PROPS}
                      tick={{ ...AXIS_PROPS.tick, fontSize: 9 }}
                      interval={0}
                      tickFormatter={(v: string) => (v.length > 10 ? `${v.slice(0, 10)}…` : v)}
                    />
                    <YAxis allowDecimals={false} {...AXIS_PROPS} width={32} />
                    <KitTooltip />
                    <Bar dataKey="value" radius={BAR_RADIUS} maxBarSize={28}>
                      {engagementStatusData.labels.map((label, i) => (
                        <Cell key={label} fill={engagementStatusData.colors[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </div>

        {/* ── Right rail ────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Org summary */}
          <section className="overflow-hidden rounded-none border border-[#e3e9e5] bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className="flex flex-wrap items-center gap-3.5 border-b border-[#e3e9e5] px-[22px] py-[17px]">
              <span className="grid size-10 shrink-0 place-items-center rounded-none bg-[#e9f6ee] text-[#166b3b]">
                <Icons.building className="size-[18px]" />
              </span>
              <div>
                <div className="text-[15px] font-bold text-[#16241c]">Organisations</div>
                <div className="text-[12.5px] text-[#7c8b82]">Market participation at a glance</div>
              </div>
            </div>
            <div className="space-y-3 p-[22px]">
              {[
                { label: 'Total organisations', value: orgs.length, cls: 'text-[#16241c]' },
                { label: 'Verified', value: verifiedOrgs.length, cls: 'text-[#15803d]' },
                { label: 'Pending verification', value: pendingOrgs.length, cls: 'text-[#92400e]' },
                { label: 'Total members', value: orgs.reduce((s, o) => s + (o.company_members?.length ?? 0), 0), cls: 'text-[#16241c]' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-[13px] text-[#4a5c52]">{row.label}</span>
                  <span className={cn('text-[13px] font-bold', row.cls)}>{loading ? '…' : row.value}</span>
                </div>
              ))}
              <Link
                href="/authority/organizations"
                className="mt-1 flex h-9 items-center justify-center gap-1.5 rounded-none border border-[#cfdad3] bg-white text-xs font-semibold text-[#4a5c52] transition-colors hover:bg-[#f0f4f1] hover:text-[#16241c]"
              >
                <Icons.building className="size-3.5" />
                Browse organisations
              </Link>
            </div>
          </section>

          {/* Technology mix */}
          {techData.data.length > 0 && (
            <section className="overflow-hidden rounded-none border border-[#e3e9e5] bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
              <div className="flex flex-wrap items-center gap-3.5 border-b border-[#e3e9e5] px-[22px] py-[17px]">
                <span className="grid size-10 shrink-0 place-items-center rounded-none bg-[#faf0e2] text-[#9a4b0e]">
                  <Icons.cpu className="size-[18px]" />
                </span>
                <div>
                  <div className="text-[15px] font-bold text-[#16241c]">Technology mix</div>
                  <div className="text-[12.5px] text-[#7c8b82]">Generation technologies in the pipeline</div>
                </div>
              </div>
              <div className="space-y-2.5 p-[22px]">
                {techData.labels.map((label, i) => {
                  const pct = Math.round((techData.data[i] / projects.length) * 100);
                  return (
                    <div key={label}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-2 text-[13px] font-medium text-[#16241c]">
                          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: techData.colors[i] }} />
                          {label}
                        </span>
                        <span className="text-[11px] font-bold text-[#7c8b82]">{techData.data[i]} · {pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f0f4f1]">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: techData.colors[i] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Recent activity (mock .row list) */}
          {recentActivity.length > 0 && (
            <section className="overflow-hidden rounded-none border border-[#e3e9e5] bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
              <div className="flex flex-wrap items-center gap-3.5 border-b border-[#e3e9e5] px-[22px] py-[17px]">
                <span className="grid size-10 shrink-0 place-items-center rounded-none bg-[#e9f6ee] text-[#166b3b]">
                  <Icons.activity className="size-[18px]" />
                </span>
                <div>
                  <div className="text-[15px] font-bold text-[#16241c]">Recent activity</div>
                  <div className="text-[12.5px] text-[#7c8b82]">Latest engagement movement</div>
                </div>
              </div>
              <div>
                {recentActivity.map((item, idx) => (
                  <div key={item.id} className={cn('px-[22px] py-3', idx > 0 && 'border-t border-[#e3e9e5]')}>
                    <p className="truncate text-[13px] font-semibold text-[#16241c]">{item.text}</p>
                    <p className="mt-0.5 text-xs capitalize text-[#7c8b82]">{item.detail}</p>
                    <p className="mt-0.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#7c8b82]">{item.time}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Quick actions (mock .menu-item rhythm) */}
          <section className="overflow-hidden rounded-none border border-[#e3e9e5] bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className="flex flex-wrap items-center gap-3.5 border-b border-[#e3e9e5] px-[22px] py-[17px]">
              <span className="grid size-10 shrink-0 place-items-center rounded-none bg-[#faf0e2] text-[#9a4b0e]">
                <Icons.zap className="size-[18px]" />
              </span>
              <div>
                <div className="text-[15px] font-bold text-[#16241c]">Quick actions</div>
                <div className="text-[12.5px] text-[#7c8b82]">Jump straight into your workflow</div>
              </div>
            </div>
            <div className="space-y-1 p-[14px]">
              {[
                { href: '/authority/projects', icon: 'folder' as keyof typeof Icons, label: 'Review queue', tone: 'bg-[#fdf0d2] text-[#92400e]', badge: pendingProjects.length || undefined },
                { href: '/authority/organizations', icon: 'building' as keyof typeof Icons, label: 'Organisations', tone: 'bg-[#dbeafe] text-[#1d4ed8]' },
                { href: '/authority/engagements', icon: 'messageSquare' as keyof typeof Icons, label: 'Engagements', tone: 'bg-[#faf0e2] text-[#9a4b0e]' },
                { href: '/settings/team', icon: 'users' as keyof typeof Icons, label: 'Team management', tone: 'bg-[#dcfce7] text-[#15803d]' },
                { href: '/settings?tab=profile', icon: 'settings' as keyof typeof Icons, label: 'Settings', tone: 'bg-[#eaefec] text-[#4a5c52]' },
              ].map(action => {
                const ActionIcon = Icons[action.icon];
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-center gap-3 rounded-none p-2.5 transition-colors hover:bg-[#f0f4f1]"
                  >
                    <span className={cn('grid size-8 shrink-0 place-items-center rounded-none', action.tone)}>
                      <ActionIcon className="size-4" />
                    </span>
                    <span className="text-[13px] font-semibold text-[#4a5c52] transition-colors group-hover:text-[#16241c]">{action.label}</span>
                    {action.badge ? (
                      <span className="ml-auto grid size-5 place-items-center rounded-none bg-[#fdf0d2] text-[10px] font-extrabold text-[#92400e]">{action.badge}</span>
                    ) : (
                      <Icons.chevronRight className="ml-auto size-3.5 text-[#cfdad3] transition-colors group-hover:text-[#166b3b]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
