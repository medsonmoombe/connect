'use client';

import { useEffect, useMemo, useState } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { EmptyState } from '@/components/ui/empty-state';
import { DashboardSkeleton, KpiBarSkeleton } from '@/components/ui/skeleton';
import { MatchBreakdownPanel } from '@/components/ui/MatchBreakdownPanel';
import { engagementService, getStateLabel } from '@/lib/engagement';
import { Project, Engagement } from '@/types';
import { useGrantData } from '@/hooks/useGrantData';

// ── Score ring ───────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : score >= 50 ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-slate-500 bg-slate-50 border-slate-200';
  return (
    <div className={cn('flex flex-col items-center justify-center w-14 h-14 border-2 shrink-0', color)}>
      <span className="text-base font-extrabold leading-none">{score}%</span>
      <span className="text-[8px] font-bold tracking-widest uppercase mt-0.5">Match</span>
    </div>
  );
}

// ── Action drawer ────────────────────────────────────────────────────────────
type ActionType = 'interest' | 'inquiry' | 'meeting' | 'quote';

function ActionDrawer({
  project,
  score,
  grantProviderId,
  existingEngagement,
  onClose,
  onSuccess,
}: {
  project: Project;
  score: number;
  grantProviderId: string | null;
  existingEngagement?: Engagement;
  onClose: () => void;
  onSuccess: (engId: string) => void;
}) {
  const router = useRouter();
  const [action, setAction] = useState<ActionType>('interest');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const ACTION_CONFIG: Record<ActionType, { label: string; icon: React.ReactNode; placeholder: string; requestType: string }> = {
    interest: {
      label: 'Express Interest',
      icon: <Icons.handshake className="size-4" />,
      placeholder: 'Briefly describe your grant mandate and why this project fits...',
      requestType: 'introduction',
    },
    inquiry: {
      label: 'Request Information',
      icon: <Icons.info className="size-4" />,
      placeholder: 'What specific information do you need about this project?',
      requestType: 'introduction',
    },
    meeting: {
      label: 'Request Meeting',
      icon: <Icons.clock className="size-4" />,
      placeholder: 'Propose a meeting to discuss grant funding opportunities...',
      requestType: 'meeting',
    },
    quote: {
      label: 'Request Grant Proposal',
      icon: <Icons.fileText className="size-4" />,
      placeholder: 'Request a formal grant proposal from the developer...',
      requestType: 'quote',
    },
  };

  const cfg = ACTION_CONFIG[action];

  async function handleSend() {
    if (!grantProviderId) { toast.error('No grant profile found. Complete your funding profile first.'); return; }
    setSending(true);
    try {
      const lines = [
        `Grant Partner Action: ${cfg.label.toUpperCase()}`,
        `Project: ${project.name}`,
        `Stage: ${project.project_stage?.replace(/_/g, ' ')}`,
        `Technology: ${project.technology_type} | ${project.project_size_mw} MW | ${project.location_country}`,
        `Match Score: ${score}%`,
        '',
        message || cfg.placeholder,
      ];
      const eng = await engagementService.requestIntroduction(
        project.id,
        grantProviderId,
        'GRANT_PROVIDER',
        { message: lines.join('\n'), requestOrigin: 'partner', requestType: cfg.requestType as any }
      );
      toast.success(`${cfg.label} sent to developer.`);
      if (eng?.id) { onSuccess(eng.id); router.push(`/engagements/${eng.id}`); }
      else onClose();
    } catch (err: any) {
      const existingId = err?.status === 409 ? String(err?.details?.existing_id ?? '') : '';
      if (existingId) {
        toast.info('Engagement already exists. Opening it.');
        router.push(`/engagements/${existingId}`);
      } else {
        toast.error(err?.message || 'Failed to send. Please try again.');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg bg-white border border-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3.5 border-b border-slate-200 bg-[#0b3b24] px-[22px] py-[17px]">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-emerald-300/70 uppercase tracking-[0.13em] mb-0.5">Contact Developer</p>
            <h3 className="text-base font-bold text-white truncate">{project.name}</h3>
            <p className="text-[11px] text-emerald-200/70 mt-0.5">
              {project.technology_type} · {project.project_size_mw} MW · {project.location_country}
            </p>
          </div>
          <ScoreBadge score={score} />
        </div>

        {/* Action tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50">
          {(Object.keys(ACTION_CONFIG) as ActionType[]).map((a) => (
            <button
              key={a}
              onClick={() => setAction(a)}
              className={cn(
                'flex-1 py-2.5 text-[10px] font-bold tracking-widest uppercase transition-all border-b-2',
                action === a
                  ? 'border-[#0b3b24] text-[#0b3b24] bg-white'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              )}
            >
              {ACTION_CONFIG[a].label.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {existingEngagement && (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold">
              <Icons.checkCircle2 className="size-3.5 shrink-0" />
              Engagement already active — {getStateLabel(existingEngagement.status)}
              <Link href={`/engagements/${existingEngagement.id}`} className="ml-auto underline">View</Link>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
            {cfg.icon}
            <span>{cfg.label}</span>
          </div>

          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={cfg.placeholder}
            className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:border-[#0b3b24] resize-none"
          />

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-9" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1 h-9 bg-[#0b3b24] hover:bg-[#0b3b24]/90 text-white"
              loading={sending}
              onClick={handleSend}
              icon={<Icons.send className="size-3.5" />}
            >
              {cfg.label}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function GrantMarketplacePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useGrantData({ engagements: true, matches: true, autoRunMatching: true });
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [minScore, setMinScore] = useState(0);
  const [drawerProject, setDrawerProject] = useState<{ project: Project; score: number } | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'GRANT_PROVIDER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  const engagedMap = data.engagedProjectMap;

  const stages = useMemo(() => {
    const set = new Set(data.matches.map((m) => m.project?.project_stage).filter(Boolean));
    return ['ALL', ...Array.from(set)] as string[];
  }, [data.matches]);

  const filtered = useMemo(() => {
    let result = data.matches.filter((m) => m.project);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((m) =>
        m.project.name?.toLowerCase().includes(q) ||
        m.project.location_country?.toLowerCase().includes(q) ||
        m.project.technology_type?.toLowerCase().includes(q)
      );
    }
    if (stageFilter !== 'ALL') result = result.filter((m) => m.project.project_stage === stageFilter);
    if (minScore > 0) result = result.filter((m) => m.compatibility_score >= minScore);
    return result.sort((a, b) => b.compatibility_score - a.compatibility_score);
  }, [data.matches, search, stageFilter, minScore]);

  const strongCount = data.matches.filter((m) => (m.compatibility_score ?? 0) >= 75).length;

  async function handleRefresh() {
    setRefreshing(true);
    await data.forceRefresh();
    setRefreshing(false);
    toast.success('Matches refreshed');
  }

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  const hasFilters = search.trim() !== '' || stageFilter !== 'ALL' || minScore > 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Project Marketplace" />
      <PageHero
        eyebrow="Funding Marketplace"
        title="Projects matched to your grant mandate"
        description="Every live project scored against your funding profile — express interest, request documents, or open an engagement."
        actions={
          <Button
            variant="outline"
            className="h-9 px-4 bg-white/10 border-white/15 text-white hover:bg-white/20"
            icon={refreshing ? <Icons.spinner className="size-4 animate-spin" />

       : <Icons.refreshCw className="size-4" />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh matches'}
          </Button>
        }
      />

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}

      {/* Counters strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total matches', value: data.matches.length },
          { label: 'Strong fits (75%+)', value: strongCount },
          { label: 'Showing', value: filtered.length },
        ].map((c) => (
          <div key={c.label} className="rounded-none border border-line bg-white px-4 py-3 shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <p className="text-lg font-black text-slate-900">{c.value}</p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, location, or technology..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-[#0b3b24]"
            />
          </div>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="h-10 px-3 border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 focus:outline-none"
          >
            {stages.map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All Stages' : s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 tracking-widest whitespace-nowrap">Min Score</span>
            <input
              type="range" min={0} max={90} step={10} value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-20 h-1.5 accent-[#0b3b24]"
            />
            <span className="text-[10px] font-bold text-[#0b3b24] w-8">{minScore}%</span>
          </div>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setStageFilter('ALL'); setMinScore(0); }}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {data.loadingMatches ? (
        <KpiBarSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title={data.matches.length === 0 ? 'No Matches Yet' : 'No Projects Match Filters'}
          description={
            data.matches.length === 0
              ? 'The matching engine has not yet scored any projects against your funding profile. Ensure your grant profile is set up, then refresh.'
              : 'Try adjusting your filters or minimum score.'
          }
          actionLabel="Refresh"
          onAction={handleRefresh}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((match) => {
            const project: Project = match.project;
            const score: number = match.compatibility_score;
            const isEngaged = !!engagedMap[project.id];
            const existingEng = engagedMap[project.id];
            const isSent = sentIds.has(project.id);
            const readiness = project.scores?.capital_readiness_score ?? (project as any).scores?.[0]?.capital_readiness_score ?? 0;

            return (
              <div
                key={match.id}
                className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] overflow-hidden flex flex-col"
              >
                {/* Card header */}
                <div className="bg-[#0b3b24] px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold text-emerald-200/50 uppercase tracking-widest mb-0.5">
                      {project.technology_type?.replace(/_/g, ' ')} · {project.project_stage?.replace(/_/g, ' ')}
                    </p>
                    <Link href={`/projects/${project.id}`}>
                      <h4 className="text-sm font-bold text-white hover:text-emerald-200 transition-colors truncate">
                        {project.name}
                      </h4>
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <Icons.mapPin className="size-3 text-emerald-300/60 shrink-0" />
                      <span className="text-[10px] font-bold text-emerald-200/70 truncate">{project.location_country}</span>
                      {project.location_region && (
                        <span className="text-[10px] text-emerald-200/40 truncate">· {project.location_region}</span>
                      )}
                    </div>
                  </div>
                  <ScoreBadge score={score} />
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                  <div className="px-3 py-2.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Capital Req.</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      ${(project.capital_required / 1_000_000).toFixed(1)}M
                    </p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Capacity</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{project.project_size_mw} MW</p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Readiness</p>
                    <p className={cn('text-sm font-bold mt-0.5', readiness >= 60 ? 'text-emerald-600' : readiness >= 40 ? 'text-amber-600' : 'text-slate-500')}>
                      {readiness}%
                    </p>
                  </div>
                </div>

                {/* Match breakdown */}
                {match.score_breakdown && (
                  <div className="px-4 py-3 border-b border-slate-100">
                    <MatchBreakdownPanel
                      breakdown={match.score_breakdown}
                      totalScore={score}
                      variant="compact"
                    />
                  </div>
                )}

                {/* Engagement status */}
                {isEngaged && (
                  <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
                    <Icons.checkCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                    <span className="text-[11px] font-bold text-emerald-700">
                      Engaged — {getStateLabel(existingEng.status)}
                    </span>
                    <Link href={`/engagements/${existingEng.id}`} className="ml-auto text-[10px] font-bold text-emerald-700 underline">
                      View
                    </Link>
                  </div>
                )}

                {/* Actions */}
                <div className="px-4 py-3 mt-auto flex items-center gap-2">
                  <Link href={`/projects/${project.id}`} className="shrink-0">
                    <Button variant="outline" size="sm" className="h-8 px-3 text-[11px]" icon={<Icons.eye className="size-3" />}>
                      View
                    </Button>
                  </Link>

                  {isEngaged || isSent ? (
                    <Link href={`/engagements/${existingEng?.id || ''}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full h-8 text-[11px] border-emerald-200 text-emerald-700 bg-emerald-50">
                        <Icons.checkCircle2 className="size-3 mr-1" /> Engaged
                      </Button>
                    </Link>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-[11px] bg-[#0b3b24] hover:bg-[#0b3b24]/90 text-white"
                        onClick={() => setDrawerProject({ project, score })}
                        icon={<Icons.handshake className="size-3" />}
                      >
                        Express Interest
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-[11px]"
                        onClick={() => setDrawerProject({ project, score })}
                        title="More actions"
                      >
                        <Icons.moreVertical className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action drawer */}
      {drawerProject && (
        <ActionDrawer
          project={drawerProject.project}
          score={drawerProject.score}
          grantProviderId={data.grantProviderId}
          existingEngagement={engagedMap[drawerProject.project.id]}
          onClose={() => setDrawerProject(null)}
          onSuccess={() => {
            setSentIds((prev) => new Set(prev).add(drawerProject.project.id));
            setDrawerProject(null);
          }}
        />
      )}
    </div>
  );
}
