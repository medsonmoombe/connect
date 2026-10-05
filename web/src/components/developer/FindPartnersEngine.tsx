/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Project, Engagement } from '@/types';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { engagementService, getStateLabel } from '@/lib/engagement';
import { analyzeProjectGaps } from '@/lib/gap-analysis';
import { getStageRecommendations } from '@/lib/project-stages';
import {
  toCapitalCandidate,
  toTechnicalCandidate,
  toConsultantCandidate,
  candidateMatchesPartnerType,
  isCandidateAllowedAtStage,
  type PartnerCandidate,
} from '@/lib/partner-candidates';
import { MatchBreakdownPanel } from '@/components/ui/MatchBreakdownPanel';

type PartnerFilter = 'all' | 'high' | 'medium';
type RequestType = 'quote' | 'meeting' | 'introduction';

type Candidate = PartnerCandidate;

export function FindPartnersEngine({
  projects,
  findPartnersProject,
  capMatches,
  techMatches,
  consultMatches,
  loadingMatches,
}: {
  projects: Project[];
  findPartnersProject: Project | null;
  capMatches: any[];
  techMatches: any[];
  consultMatches?: any[];
  loadingMatches: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<PartnerFilter>('all');
  const [minScore, setMinScore] = useState(0);
  const [view, setView] = useState<'matches' | 'gaps'>('gaps');
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [projectEngagements, setProjectEngagements] = useState<Engagement[]>([]);

  // Fetch existing engagements for the selected project so request buttons can
  // be disabled when an engagement is already in progress with a partner.
  const activeProjectId = findPartnersProject?.id;
  useEffect(() => {
    if (!activeProjectId) {
      setProjectEngagements([]);
      return;
    }
    let active = true;
    engagementService
      .getProjectEngagements(activeProjectId)
      .then((list) => { if (active) setProjectEngagements(list ?? []); })
      .catch(() => { if (active) setProjectEngagements([]); });
    return () => { active = false; };
  }, [activeProjectId]);

  const engagementByPartner = useMemo(() => {
    const map: Record<string, Engagement> = {};
    for (const e of projectEngagements) {
      if (e.status === 'DROPPED') continue;
      if (!map[e.counterparty_id]) map[e.counterparty_id] = e;
    }
    return map;
  }, [projectEngagements]);

  const stageRecommendations = getStageRecommendations(findPartnersProject?.project_stage);
  const gapResult = useMemo(() => {
    if (!findPartnersProject) return null;
    return analyzeProjectGaps(findPartnersProject);
  }, [findPartnersProject]);

  // ── Stage-aware filtering ──────────────────────────────────────────────────
  // Based on the meeting discussion rules: at Concept/Pre-Feasibility only
  // consultants and grant providers should be linked. This prevents showing
  // irrelevant partners at each stage.
  const stagePartnerTypes = stageRecommendations.partnerTypes;

  const filteredCap = capMatches
    .filter((m) => matchesScoreFilter(m.compatibility_score, filter, minScore))
    .filter((m) => {
      if (stagePartnerTypes.length === 0) return true;
      const partner = m.capital_partner;
      if (!partner) return false;
      const structures: string[] = partner.preferred_capital_structure || [];
      // Grant providers always pass the stage filter — they are gated by
      // isCandidateAllowedAtStage via STAGE_ALLOWED_CATEGORIES instead.
      if (structures.includes('GRANT') || m._is_grant) return true;
      const allowed = stagePartnerTypes.some((pt: string) =>
        pt.toUpperCase() === 'FINANCIAL'
      );
      return allowed;
    });

  const filteredTech = techMatches
    .filter((m) => matchesScoreFilter(m.compatibility_score, filter, minScore))
    .filter((m) => {
      if (stagePartnerTypes.length === 0) return true;
      const partner = m.technical_partner;
      if (!partner) return false;
      const hasAdvisory = (partner.service_categories ?? []).some(
        (s: string) => s.includes('ADVISORY') || s.includes('CONSULT')
      );
      const hasEPC = (partner.service_categories ?? []).some(
        (s: string) => s.includes('EPC') || s.includes('CONSTRUCTION')
      );
      const hasOandM = (partner.service_categories ?? []).some(
        (s: string) => s.includes('O_M') || s.includes('OPERATION')
      );

      if (stagePartnerTypes.includes('Consultant') && !hasAdvisory) return false;
      if (stagePartnerTypes.includes('EPC') && !hasEPC) return false;
      if (stagePartnerTypes.includes('O&M') && !hasOandM) return false;
      return true;
    });

  const filteredConsult = (consultMatches ?? [])
    .filter((m) => matchesScoreFilter(m.compatibility_score, filter, minScore))
    .filter((m) => {
      if (stagePartnerTypes.length === 0) return true;
      if (!stagePartnerTypes.includes('Consultant')) return false;
      return !!m.consultant;
    });

  const capitalCandidates = useMemo(
    () => filteredCap.map(toCapitalCandidate).filter(Boolean) as Candidate[],
    [filteredCap]
  );
  const technicalCandidates = useMemo(
    () => filteredTech.map(toTechnicalCandidate).filter(Boolean) as Candidate[],
    [filteredTech]
  );
  const consultantCandidates = useMemo(
    () => filteredConsult.map(toConsultantCandidate).filter(Boolean) as Candidate[],
    [filteredConsult]
  );

  async function sendRequest(
    candidate: Candidate,
    gapId?: string,
    service?: string,
    requestType: RequestType = 'quote'
  ) {
    if (!findPartnersProject) return;
    const key = `${candidate.type}-${candidate.id}-${gapId || 'general'}-${requestType}`;
    setSendingKey(key);
    try {
      const gap = gapResult?.gaps.find((g) => g.id === gapId);
      const message = buildRequestMessage({
        project: findPartnersProject,
        candidate,
        gap,
        requestType,
        service,
      });
      const engagement = await engagementService.requestIntroduction(
        findPartnersProject.id,
        candidate.id,
        candidate.type,
        {
          message,
          requestOrigin: 'developer',
          requestType,
          gapIds: gapId ? [gapId] : undefined,
          requestedService: service,
        }
      );
      if (engagement?.id) router.push(`/engagements/${engagement.id}`);
    } catch (err: any) {
      const existingId = err?.status === 409 ? String(err?.details?.existing_id ?? '') : '';
      if (existingId) {
        toast.info('A request was already sent to this partner for this project. Opening it.');
        router.push(`/engagements/${existingId}`);
      } else {
        toast.error(err?.message || 'Could not send request. Please try again.');
      }
    } finally {
      setSendingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Project switcher — only when multiple projects */}
      {projects.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project</span>
          <SearchableSelect
            value={findPartnersProject?.id || ''}
            onChange={(val) => router.push(`/developer/find-partners?project=${val}`)}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="Select project..."
            className="w-72"
          />
        </div>
      )}

      {findPartnersProject && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-4">
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
              Recommended Partners
            </p>
            <p className="text-sm font-bold text-slate-900 mt-1">
              {stageRecommendations.partnerTypes.length
                ? stageRecommendations.partnerTypes.join(', ')
                : 'Run analysis'}
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Based on {findPartnersProject.project_stage?.replace(/_/g, ' ')} stage
            </p>
          </div>
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-4">
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Open Gaps</p>
            <p className="text-sm font-bold text-slate-900 mt-1">{gapResult?.gaps.length ?? 0} items</p>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {gapResult?.summary || 'Run gap analysis to diagnose blockers.'}
            </p>
          </div>
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-4">
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Request Paths</p>
            <p className="text-sm font-bold text-slate-900 mt-1">Quote, Meeting, Introduction</p>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Requests include a project and gap summary automatically.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-0.5 bg-slate-100 rounded-none p-1">
        {(['gaps', 'matches'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'px-4 py-1.5 rounded-none text-[10px] font-bold tracking-widest transition-all capitalize',
              view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            )}
          >
            {v === 'gaps' ? 'Gap-Based Matching' : 'Score-Based Matches'}
          </button>
        ))}
      </div>

      {!findPartnersProject ? (
        <EmptyState
          icon="search"
          title="No Project Selected"
          description="Create or select a project to begin matching."
        />
      ) : view === 'gaps' ? (
        <GapMatchingView
          loading={loadingMatches}
          stage={findPartnersProject.project_stage}
          gapResult={gapResult}
          capitalCandidates={capitalCandidates}
          technicalCandidates={technicalCandidates}
          consultantCandidates={consultantCandidates}
          sendingKey={sendingKey}
          engagementByPartner={engagementByPartner}
          onSendRequest={sendRequest}
        />
      ) : (
        <ScoreMatchingView
          loading={loadingMatches}
          stage={findPartnersProject.project_stage}
          filter={filter}
          minScore={minScore}
          onFilter={setFilter}
          onMinScore={setMinScore}
          capitalCandidates={capitalCandidates}
          technicalCandidates={technicalCandidates}
          consultantCandidates={consultantCandidates}
          sendingKey={sendingKey}
          engagementByPartner={engagementByPartner}
          onSendRequest={sendRequest}
          projectId={findPartnersProject.id}
        />
      )}
    </div>
  );
}

const PARTNER_TYPE_CONFIG: Record<
  string,
  { label: string; description: string; icon: ReactNode; category: 'CAPITAL' | 'TECHNICAL' }
> = {
  Consultant: {
    label: 'Consultant',
    description:
      'Technical, financial, environmental and legal advisors who help you complete feasibility studies, secure approvals and strengthen project readiness.',
    icon: <Icons.briefcase className="size-4" />,
    category: 'TECHNICAL',
  },
  'Grant Provider': {
    label: 'Grant Provider',
    description:
      'Development partners and grant funders who support early-stage project preparation and studies.',
    icon: <Icons.handshake className="size-4" />,
    category: 'CAPITAL',
  },
  Financial: {
    label: 'Financial',
    description:
      'Banks, DFIs, funds and investors providing debt, equity and structured financing for your project.',
    icon: <Icons.dollarSign className="size-4" />,
    category: 'CAPITAL',
  },
  EPC: {
    label: 'EPC Contractor',
    description:
      'Engineering, procurement and construction contractors who design and build the plant.',
    icon: <Icons.hardHat className="size-4" />,
    category: 'TECHNICAL',
  },
  OAM: {
    label: 'O&M Partner',
    description:
      'Operations and maintenance specialists who run and optimise the plant once built.',
    icon: <Icons.wrench className="size-4" />,
    category: 'TECHNICAL',
  },
};

function GapMatchingView({
  loading,
  stage,
  gapResult,
  capitalCandidates,
  technicalCandidates,
  consultantCandidates,
  sendingKey,
  engagementByPartner,
  onSendRequest,
}: {
  loading: boolean;
  stage?: string | null;
  gapResult: ReturnType<typeof analyzeProjectGaps> | null;
  capitalCandidates: Candidate[];
  technicalCandidates: Candidate[];
  consultantCandidates: Candidate[];
  sendingKey: string | null;
  engagementByPartner: Record<string, Engagement>;
  onSendRequest: (
    candidate: Candidate,
    gapId?: string,
    service?: string,
    requestType?: RequestType
  ) => void;
}) {
  if (loading) return <LoadingPanel label="Finding partners who can close project gaps..." />;

  const stageRecs = getStageRecommendations(stage);
  const recommendedTypes = stageRecs.partnerTypes.length
    ? stageRecs.partnerTypes
    : ['Consultant', 'Grant Provider'];

  const priorityGaps = (gapResult?.gaps ?? []).filter((g) => g.status !== 'complete');
  const openGapCount = priorityGaps.length;
  const gapSummary = priorityGaps.map((g) => g.label).slice(0, 4);

  const sections = recommendedTypes.map((type) => {
    const config = PARTNER_TYPE_CONFIG[type];
    if (!config) return null;
    const pool =
      type === 'Consultant'
        ? consultantCandidates
        : config.category === 'CAPITAL'
          ? capitalCandidates
          : technicalCandidates;
    const counterpartyType = type === 'Consultant' ? 'CONSULTANT' : config.category;
    const candidates = pool
      .filter((c) => candidateMatchesPartnerType(c, counterpartyType, type))
      .filter((c) => isCandidateAllowedAtStage(stage, c, counterpartyType))
      .slice(0, 3);
    return { type, config, candidates };
  }).filter(Boolean) as { type: string; config: typeof PARTNER_TYPE_CONFIG[string]; candidates: Candidate[] }[];

  if (sections.every((s) => s.candidates.length === 0) && openGapCount === 0) {
    return (
      <EmptyState
        icon="check"
        title="No Open Gaps"
        description="This project currently has no open gaps. Continue monitoring readiness as documents change."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Recommended partner types for this project stage */}
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
        <div className="flex items-center gap-2 mb-1">
          <Icons.lightbulb className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-900">Recommended Partner Types</h3>
        </div>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Based on this project&apos;s current stage
          {stage ? ` (${stage.replace(/_/g, ' ')})` : ''}
          {openGapCount > 0 && (
            <> — {openGapCount} open gap{openGapCount !== 1 ? 's' : ''}
              {gapSummary.length > 0 && <>: {gapSummary.join(', ')}</>}
            </>
          )}
          . Profiles below are matched to the capabilities you need now.
        </p>
      </div>

      {sections.map(({ type, config, candidates }) => (
        <div key={type} className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <div className="p-5 border-b border-slate-100 bg-slate-50/30">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="size-9 bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                  <span className="text-green-800">{config.icon}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">{config.label}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1 max-w-3xl">
                    {config.description}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 tracking-widest shrink-0">
                {candidates.length} matched profile{candidates.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {candidates.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {candidates.map((candidate) => (
                <PartnerCandidateRow
                  key={`${type}-${candidate.type}-${candidate.id}`}
                  candidate={candidate}
                  sendingKey={sendingKey}
                  requestKey={`${candidate.type}-${candidate.id}-general`}
                  engagement={engagementByPartner[candidate.id]}
                  onSendRequest={(requestType) =>
                    onSendRequest(candidate, undefined, undefined, requestType)
                  }
                />
              ))}
            </div>
          ) : (
            <div className="p-5 text-center">
              <Icons.search className="size-7 text-slate-200 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">No matched profiles yet for {config.label.toLowerCase()}s</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ScoreMatchingView({
  loading,
  stage,
  filter,
  minScore,
  onFilter,
  onMinScore,
  capitalCandidates,
  technicalCandidates,
  consultantCandidates,
  sendingKey,
  engagementByPartner,
  onSendRequest,
  projectId,
}: {
  loading: boolean;
  stage?: string | null;
  filter: PartnerFilter;
  minScore: number;
  onFilter: (filter: PartnerFilter) => void;
  onMinScore: (score: number) => void;
  capitalCandidates: Candidate[];
  technicalCandidates: Candidate[];
  consultantCandidates: Candidate[];
  sendingKey: string | null;
  engagementByPartner: Record<string, Engagement>;
  onSendRequest: (
    candidate: Candidate,
    gapId?: string,
    service?: string,
    requestType?: RequestType
  ) => void;
  projectId: string;
}) {
  if (loading) return <LoadingPanel label="Analyzing partner criteria..." />;

  const allowedCapital = capitalCandidates.filter((c) =>
    isCandidateAllowedAtStage(stage, c, 'CAPITAL')
  );
  const allowedTechnical = technicalCandidates.filter((c) =>
    isCandidateAllowedAtStage(stage, c, 'TECHNICAL')
  );
  const allowedConsultant = consultantCandidates.filter((c) =>
    isCandidateAllowedAtStage(stage, c, 'CONSULTANT')
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 bg-slate-100 rounded-none p-1">
          {(['all', 'high', 'medium'] as PartnerFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => onFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-none text-[10px] font-bold tracking-widest transition-all capitalize',
                filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              {f === 'all' ? 'All Matches' : f === 'high' ? 'High (80%+)' : 'Medium (50-79%)'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10px] font-bold text-slate-400 tracking-widest">Min Score</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minScore}
            onChange={(e) => onMinScore(Number(e.target.value))}
            className="w-20 h-1.5 accent-primary"
          />
          <span className="text-[10px] font-bold text-primary w-8">{minScore}%</span>
        </div>
      </div>

      <CandidateSection
        title="Institutional Capital"
        subtitle="Debt, equity, grant and fund managers"
        icon={<Icons.dollarSign className="size-4 text-blue-600" />}
        candidates={allowedCapital}
        sendingKey={sendingKey}
        engagementByPartner={engagementByPartner}
        onSendRequest={onSendRequest}
        emptyHref={`/projects/${projectId}`}
      />
      <CandidateSection
        title="Consultants & Advisors"
        subtitle="Feasibility, financial, environmental and legal advisory"
        icon={<Icons.briefcase className="size-4 text-primary" />}
        candidates={allowedConsultant}
        sendingKey={sendingKey}
        engagementByPartner={engagementByPartner}
        onSendRequest={onSendRequest}
        emptyHref={`/projects/${projectId}`}
      />
      <CandidateSection
        title="Technical, EPC & Advisory"
        subtitle="Consultants, EPC, O&M and specialist services"
        icon={<Icons.wrench className="size-4 text-primary" />}
        candidates={allowedTechnical}
        sendingKey={sendingKey}
        engagementByPartner={engagementByPartner}
        onSendRequest={onSendRequest}
        emptyHref={`/projects/${projectId}`}
      />
    </div>
  );
}

function CandidateSection({
  title,
  subtitle,
  icon,
  candidates,
  sendingKey,
  engagementByPartner,
  onSendRequest,
  emptyHref,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  candidates: Candidate[];
  sendingKey: string | null;
  engagementByPartner: Record<string, Engagement>;
  onSendRequest: (
    candidate: Candidate,
    gapId?: string,
    service?: string,
    requestType?: RequestType
  ) => void;
  emptyHref: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 bg-slate-50 border border-slate-100 flex items-center justify-center">{icon}</div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-[10px] font-bold text-slate-400 tracking-wider">{subtitle}</p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-slate-400 tracking-widest">
          {candidates.length} matches
        </span>
      </div>
      {candidates.length > 0 ? (
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] divide-y divide-slate-100 overflow-hidden">
          {candidates.map((candidate) => (
            <PartnerCandidateRow
              key={`${candidate.type}-${candidate.id}`}
              candidate={candidate}
              sendingKey={sendingKey}
              requestKey={`${candidate.type}-${candidate.id}-general`}
              engagement={engagementByPartner[candidate.id]}
              onSendRequest={(requestType) =>
                onSendRequest(candidate, undefined, undefined, requestType)
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="search"
          title={`No ${title} Matches`}
          description="Try improving project readiness or adjusting partner criteria."
          actionLabel="View Project"
          actionHref={emptyHref}
        />
      )}
    </div>
  );
}

function PartnerCandidateRow({
  candidate,
  sendingKey,
  requestKey,
  engagement,
  onSendRequest,
}: {
  candidate: Candidate;
  sendingKey: string | null;
  requestKey: string;
  engagement?: Engagement;
  onSendRequest: (requestType: RequestType) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const scoreColor =
    candidate.score >= 80 ? 'text-green-600' : candidate.score >= 50 ? 'text-amber-600' : 'text-red-500';
  const scoreBg =
    candidate.score >= 80
      ? 'bg-green-50 border-green-100'
      : candidate.score >= 50
        ? 'bg-amber-50 border-amber-100'
        : 'bg-red-50 border-red-100';
  const quoteLoading = sendingKey === `${requestKey}-quote`;
  const meetingLoading = sendingKey === `${requestKey}-meeting`;
  const introLoading = sendingKey === `${requestKey}-introduction`;
  const breakdown = candidate.raw?.score_breakdown;

  return (
    <div className="hover:bg-slate-50/50 transition-colors">
      <div className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          <div className="size-12 bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
            <span className="text-sm font-black text-slate-700">
              {candidate.companyName.substring(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 truncate">{candidate.companyName}</h4>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider flex items-center gap-1">
                    <Icons.layers className="size-3" />
                    {candidate.capabilityLine}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider flex items-center gap-1">
                    <Icons.mapPin className="size-3" />
                    {candidate.regionLine}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2 shrink-0">
                <div className={cn('px-3 py-1.5 border text-center', scoreBg)}>
                  <p className={cn('text-lg font-extrabold leading-none', scoreColor)}>{candidate.score}%</p>
                  <p className="text-[8px] font-bold text-slate-400 tracking-widest mt-0.5">MATCH</p>
                </div>
                {breakdown && (
                  <button
                    onClick={() => setExpanded((v) => !v)}
                    className="h-8 w-8 flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 transition-colors shrink-0"
                    title={expanded ? 'Hide breakdown' : 'Show breakdown'}
                  >
                    <Icons.chevronDown className={cn('size-3.5 text-slate-400 transition-transform', expanded && 'rotate-180')} />
                  </button>
                )}
              </div>
            </div>

            {engagement ? (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-100 text-[11px] font-bold">
                  <Icons.checkCircle2 className="size-3.5" />
                  Engaged — {getStateLabel(engagement.status)}
                </span>
                <Link href={`/engagements/${engagement.id}`}>
                  <Button size="sm" variant="outline" icon={<Icons.arrowRight />}>
                    View Engagement
                  </Button>
                </Link>
                <Link
                  href={(() => {
                    if (candidate.type === 'CONSULTANT') {
                      return `/developer/consultant/${candidate.raw.consultant?.company_id ?? candidate.raw.company_id ?? ''}`;
                    }
                    const companyId =
                      candidate.raw.company_id ??
                      candidate.raw.capital_partner?.company_id ??
                      candidate.raw.technical_partner?.company_id ?? '';
                    return companyId ? `/developer/request-intro/${companyId}` : '#';
                  })()}
                  className="text-[10px] font-bold text-primary hover:underline tracking-widest ml-1"
                >
                  View Full Profile →
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Button size="sm" loading={quoteLoading} onClick={() => onSendRequest('quote')} icon={<Icons.send />}>
                  Request Quote
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  loading={meetingLoading}
                  onClick={() => onSendRequest('meeting')}
                  icon={<Icons.clock />}
                >
                  Request Meeting
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={introLoading}
                  onClick={() => onSendRequest('introduction')}
                  icon={<Icons.users />}
                >
                  Introduction
                </Button>
                <Link
                  href={(() => {
                    if (candidate.type === 'CONSULTANT') {
                      return `/developer/consultant/${candidate.raw.consultant?.company_id ?? candidate.raw.company_id ?? ''}`;
                    }
                    const companyId =
                      candidate.raw.company_id ??
                      candidate.raw.capital_partner?.company_id ??
                      candidate.raw.technical_partner?.company_id ?? '';
                    return companyId ? `/developer/request-intro/${companyId}` : '#';
                  })()}
                  className="text-[10px] font-bold text-primary hover:underline tracking-widest ml-1"
                >
                  View Full Profile →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expandable breakdown */}
      {expanded && breakdown && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4">
          <MatchBreakdownPanel
            breakdown={breakdown}
            totalScore={candidate.score}
            variant="full"
          />
        </div>
      )}
    </div>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="py-8 text-center bg-white border border-slate-200 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <Icons.spinner className="size-5 animate-spin mx-auto text-primary mb-2" />
      <p className="text-[11px] font-bold text-slate-400">{label}</p>
    </div>
  );
}

function matchesScoreFilter(score: number, filter: PartnerFilter, minScore: number) {
  if (filter === 'high' && score < 80) return false;
  if (filter === 'medium' && (score < 50 || score >= 80)) return false;
  return score >= minScore;
}

function buildRequestMessage({
  project,
  candidate,
  gap,
  requestType,
  service,
}: {
  project: Project;
  candidate: Candidate;
  gap?: any;
  requestType: RequestType;
  service?: string;
}) {
  const requestLabel =
    requestType === 'quote' ? 'quote' : requestType === 'meeting' ? 'meeting' : 'introduction';
  const lines = [
    `Developer request: ${requestLabel.toUpperCase()}`,
    `Project: ${project.name}`,
    `Stage: ${project.project_stage?.replace(/_/g, ' ') || 'Not determined'}`,
    `Technology: ${project.technology_type || 'Not specified'} | Capacity: ${
      project.project_size_mw || 0
    } MW | Location: ${project.location_country || 'Not specified'}`,
  ];
  if (gap) {
    lines.push(`Gap: ${gap.label}`);
    lines.push(`Required service: ${(service || gap.recommendation?.service || '').replace(/_/g, ' ')}`);
    lines.push(`Why this matters: ${gap.detail}`);
  }
  lines.push(`Requested partner: ${candidate.companyName}`);
  lines.push(
    'Please review the project summary and respond with availability, next steps, and any information needed to scope the work.'
  );
  return lines.join('\n');
}
