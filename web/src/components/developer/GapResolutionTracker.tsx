'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Project, Engagement } from '@/types';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { GapAnalysisResult } from '@/lib/gap-analysis';
import { matchCandidatesForGap, type PartnerCandidate } from '@/lib/partner-candidates';
import { engagementService, getStateLabel } from '@/lib/engagement';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const DOCUMENT_TYPE_MAP: Record<string, string> = {
  'feasibility_study': 'FEASIBILITY',
  'financial_model': 'FINANCIAL',
  'environmental_assessment': 'ENVIRONMENTAL',
};

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-100' },
  high:     { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' },
  medium:   { bg: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-100' },
  low:      { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-100' },
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  'Project Form': <Icons.building className="size-4" />,
  'Studies & Advisory': <Icons.fileText className="size-4" />,
  'Technical': <Icons.wrench className="size-4" />,
  'Financing': <Icons.dollarSign className="size-4" />,
  'Commercial': <Icons.trendingUp className="size-4" />,
  'Regulatory': <Icons.shield className="size-4" />,
};

export function GapResolutionTracker({
  projects,
  selectedGapProject,
}: {
  projects: Project[];
  selectedGapProject: string | null;
}) {
  const router = useRouter();
  const [gapResult, setGapResult] = useState<GapAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [capitalMatches, setCapitalMatches] = useState<any[]>([]);
  const [technicalMatches, setTechnicalMatches] = useState<any[]>([]);
  const [consultantMatches, setConsultantMatches] = useState<any[]>([]);
  const [projectEngagements, setProjectEngagements] = useState<Engagement[]>([]);
  const [sendingKey, setSendingKey] = useState<string | null>(null);

  const targetId = selectedGapProject || projects[0]?.id;
  const targetProject = projects.find((p) => p.id === targetId);

  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    fetch(`/api/projects/${targetId}/gap-analysis`)
      .then((r) => (r.ok ? r.json() : Promise.reject('Failed')))
      .then((json) => setGapResult(json.data ?? json))
      .catch(() => setGapResult(null))
      .finally(() => setLoading(false));
  }, [targetId]);

  // Fetch matching results so each gap can show the recommended partner profiles.
  useEffect(() => {
    if (!targetId) {
      setCapitalMatches([]);
      setTechnicalMatches([]);
      setConsultantMatches([]);
      return;
    }
    fetch(`/api/projects/${targetId}?resource=matches`)
      .then((r) => (r.ok ? r.json() : Promise.reject('Failed')))
      .then((json) => {
        setCapitalMatches(json.capital ?? []);
        setTechnicalMatches(json.technical ?? []);
        setConsultantMatches(json.consultant ?? []);
      })
      .catch(() => {
        setCapitalMatches([]);
        setTechnicalMatches([]);
        setConsultantMatches([]);
      });
  }, [targetId]);

  // Fetch existing engagements so request buttons are disabled once a request
  // is already in progress with a partner.
  useEffect(() => {
    if (!targetId) {
      setProjectEngagements([]);
      return;
    }
    let active = true;
    engagementService
      .getProjectEngagements(targetId)
      .then((list) => { if (active) setProjectEngagements(list ?? []); })
      .catch(() => { if (active) setProjectEngagements([]); });
    return () => { active = false; };
  }, [targetId]);

  const engagementByPartner = useMemo(() => {
    const map: Record<string, Engagement> = {};
    for (const e of projectEngagements) {
      if (e.status === 'DROPPED') continue;
      if (!map[e.counterparty_id]) map[e.counterparty_id] = e;
    }
    return map;
  }, [projectEngagements]);

  async function sendRequest(
    candidate: PartnerCandidate,
    gap: any,
    requestType: 'quote' | 'meeting' | 'introduction'
  ) {
    if (!targetProject) return;
    const key = `${candidate.type}-${candidate.id}-${gap.id}-${requestType}`;
    setSendingKey(key);
    try {
      const engagement = await engagementService.requestIntroduction(
        targetProject.id,
        candidate.id,
        candidate.type,
        {
          requestOrigin: 'developer',
          requestType,
          gapIds: [gap.id],
          requestedService: gap.recommendation?.service,
        }
      );
      if (engagement?.id) {
        toast.success('Request sent successfully.');
        router.push(`/engagements/${engagement.id}`);
      }
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

  const formGaps = useMemo(() => {
    if (!gapResult?.gaps) return [];
    return gapResult.gaps.filter((g) => g.category === 'Project Form');
  }, [gapResult]);

  const docGaps = useMemo(() => {
    if (!gapResult?.gaps) return [];
    return gapResult.gaps.filter((g) => DOCUMENT_TYPE_MAP[g.id]);
  }, [gapResult]);

  const otherGaps = useMemo(() => {
    if (!gapResult?.gaps) return [];
    return gapResult.gaps.filter((g) => g.category !== 'Project Form' && !DOCUMENT_TYPE_MAP[g.id]);
  }, [gapResult]);

  // Recommended / matched partner profiles, computed per gap but rendered in a
  // dedicated section below so they are never confused with the gaps themselves.
  // Each partner organisation appears ONCE, along with every gap it is matched to.
  const matchedPartners = useMemo(() => {
    const byCompany = new Map<string, { companyId: string; matches: { gap: any; candidate: PartnerCandidate }[] }>();
    for (const gap of otherGaps) {
      const candidates = matchCandidatesForGap(
        gap,
        capitalMatches,
        technicalMatches,
        targetProject?.project_stage,
        3,
        consultantMatches
      );
      for (const candidate of candidates) {
        const companyId =
          candidate.raw.company_id ??
          candidate.raw.capital_partner?.company_id ??
          candidate.raw.technical_partner?.company_id ??
          candidate.raw.consultant?.company_id ??
          candidate.id;
        const entry = byCompany.get(companyId) ?? { companyId, matches: [] as { gap: any; candidate: PartnerCandidate }[] };
        entry.matches.push({ gap, candidate });
        byCompany.set(companyId, entry);
      }
    }
    return Array.from(byCompany.values())
      .map((entry) => ({
        ...entry,
        matches: entry.matches.sort((a, b) => b.candidate.score - a.candidate.score),
      }))
      .sort((a, b) => b.matches[0].candidate.score - a.matches[0].candidate.score);
  }, [otherGaps, capitalMatches, technicalMatches, consultantMatches, targetProject?.project_stage]);

  // Distinct partner count per gap, used by the gap cards' jump links.
  const gapPartnerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const company of matchedPartners) {
      const gapIds = new Set(company.matches.map((m) => m.gap.id));
      for (const gapId of gapIds) counts.set(gapId, (counts.get(gapId) ?? 0) + 1);
    }
    return counts;
  }, [matchedPartners]);

  const totalGaps = gapResult?.gaps?.length ?? 0;
  const progress = gapResult ? Math.round(gapResult.overallReadiness) : 0;

  if (loading) {
    return (
      <div className="py-8 text-center bg-white border border-slate-100">
        <Icons.spinner className="size-5 animate-spin mx-auto text-primary mb-2" />
        <p className="text-[11px] font-bold text-slate-400">Running gap analysis...</p>
      </div>
    );
  }

  if (!gapResult || totalGaps === 0) {
    return (
      <div className="py-12 text-center bg-white border border-dashed border-slate-200">
        <Icons.checkCircle2 className="size-8 text-green-300 mx-auto mb-3" />
        <h4 className="text-sm font-bold text-slate-700 mb-1">No Gaps Identified</h4>
        <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
          Your project documentation appears complete. Run analysis on a specific project to check for gaps.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] px-6 py-5">
        <p className="dash-section-label mb-1">Gap Resolution</p>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">Gap Resolution Tracker</h2>
        <p className="text-sm text-slate-500 font-medium mt-1">
          {targetProject ? (
            <>Tracking gaps for <span className="font-bold text-slate-700">{targetProject.name}</span></>
          ) : (
            'Track and resolve each gap to complete your documentation.'
          )}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border border-slate-100 shadow-soft p-5">
        <div className="flex items-center justify-between mb-2">
          {/* Same metric as GapMatrix: requirement coverage, not the readiness score. */}
          <span className="text-xs font-bold text-slate-600">Documentation Completeness</span>
          <span className="text-xs font-bold text-primary">{progress}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-400 font-medium mt-2">
          {gapResult.summary}
        </p>
      </div>

      {/* ── Form Fields Grouped Card ─────────────────────────────────── */}
      {formGaps.length > 0 && (
        <div className="bg-white border border-slate-100 shadow-soft overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-50 bg-slate-50/50">
            <div className="size-9 rounded-none bg-red-50 flex items-center justify-center shrink-0">
              <Icons.building className="size-4 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900">Complete Project Form</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {formGaps.length} field{formGaps.length !== 1 ? 's' : ''} missing — {formGaps.map((g) => g.label).join(', ')}
              </p>
            </div>
            <Link href={`/developer/submit?edit=${targetId}`}>
              <Button size="sm" icon={<Icons.pencil />}>
                Complete Form
              </Button>
            </Link>
          </div>
          <div className="px-5 py-3 bg-white">
            <div className="flex flex-wrap gap-2">
              {formGaps.map((gap) => (
                <span
                  key={gap.id}
                  className="px-2.5 py-1 rounded-none bg-red-50 text-red-600 text-[10px] font-bold tracking-wider border border-red-100"
                >
                  {gap.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Document Upload Cards ────────────────────────────────────── */}
      {docGaps.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 tracking-widest uppercase px-1">Missing Documents</h3>
          {docGaps.map((gap) => {
            const docType = DOCUMENT_TYPE_MAP[gap.id] || '';
            const sev = SEVERITY_CONFIG[gap.severity] || SEVERITY_CONFIG.medium;
            return (
              <div key={gap.id} className="bg-white border border-slate-100 shadow-soft p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={cn('size-9 rounded-none flex items-center justify-center shrink-0', sev.bg)}>
                    <Icons.fileText className={cn('size-4', sev.text)} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900">{gap.label}</h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">{gap.detail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('px-2 py-0.5 rounded-none text-[9px] font-bold tracking-wider border', sev.bg, sev.text, sev.border)}>
                    {gap.severity.toUpperCase()}
                  </span>
                  <Link href={`/developer/data-room?project=${targetId}&requirement=${docType}`}>
                    <Button size="sm" variant="outline" icon={<Icons.upload />}>
                      Upload
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Other Gaps (Studies, Financing, Regulatory, etc.) ──────── */}
      {otherGaps.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 tracking-widest uppercase px-1">Partner Opportunities</h3>
          {otherGaps.map((gap) => {
            const sev = SEVERITY_CONFIG[gap.severity] || SEVERITY_CONFIG.medium;
            const catIcon = CATEGORY_ICON[gap.category] || <Icons.layers className="size-4" />;
            const matchedCount = gapPartnerCounts.get(gap.id) ?? 0;
            return (
              <div key={gap.id} id={`gap-${gap.id}`} className="bg-white border border-slate-100 shadow-soft p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn('size-9 flex items-center justify-center shrink-0', sev.bg)}>
                      <span className={sev.text}>{catIcon}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="text-sm font-bold text-slate-900">{gap.label}</h4>
                        <span className={cn('px-2 py-0.5 text-[9px] font-bold tracking-wider border', sev.bg, sev.text, sev.border)}>
                          {gap.severity.toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 text-[9px] font-bold tracking-wider border bg-slate-50 text-slate-500 border-slate-200">
                          {gap.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">{gap.detail}</p>
                      {gap.recommendation.partnerType && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Icons.users className="size-3 text-primary" />
                          <span className="text-[10px] font-bold text-primary tracking-wider">
                            Find: {gap.recommendation.partnerType}
                          </span>
                          {gap.recommendation.service && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              — {gap.recommendation.service.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {matchedCount > 0 && (
                      <Link href="#matched-partners">
                        <Button size="sm" variant="outline" icon={<Icons.users />}>
                          {matchedCount} Matched Partner{matchedCount !== 1 ? 's' : ''}
                        </Button>
                      </Link>
                    )}
                    <Link href={`/developer/find-partners?project=${targetId}`}>
                      <Button size="sm" variant="outline" icon={<Icons.search />}>
                        Find Partner
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Matched Partners (dedicated section, one block per organisation) ── */}
      {matchedPartners.length > 0 && (
        <div id="matched-partners" className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] ">
          {/* Dark header bar */}
          <div className="bg-[#0b3b24] px-6 py-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold mb-1">Matched Partners</p>
              <h3 className="text-base font-bold text-white tracking-tight">Recommended Partners for Your Gaps</h3>
              <p className="text-xs text-emerald-100/70 font-medium mt-1">
                Each partner below is matched to one or more of your project gaps. Request a quote or view their profile to get started.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[9px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Partner{matchedPartners.length !== 1 ? 's' : ''}</p>
              <p className="text-2xl font-extrabold text-amber-300">{matchedPartners.length}</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {matchedPartners.map(({ companyId, matches }) => {
              const top = matches[0].candidate;
              const engagement = engagementByPartner[top.id];
              const isSending = sendingKey === `${top.type}-${top.id}-${matches[0].gap.id}-quote`;
              const gaps = Array.from(new Map(matches.map((m) => [m.gap.id, m.gap])).values());
              return (
                <div key={companyId} className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 text-[8px] font-black tracking-widest uppercase bg-green-50 border border-green-100 text-green-700 shrink-0">
                      Matched
                    </span>
                    <div className="size-10 bg-white border border-slate-100 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-black text-slate-600">
                        {top.companyName.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-800 truncate">{top.companyName}</p>
                        <span className="px-2 py-0.5 bg-green-50 border border-green-100 text-[10px] font-bold text-green-700 shrink-0">
                          {top.score}% match
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium truncate">
                        {top.capabilityLine}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {engagement ? (
                        <Link href={`/engagements/${engagement.id}`}>
                          <Button size="xs" variant="outline" icon={<Icons.arrowRight />}>
                            {getStateLabel(engagement.status)}
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          size="xs"
                          loading={isSending}
                          onClick={() => sendRequest(top, matches[0].gap, 'quote')}
                          icon={<Icons.send />}
                        >
                          Request Quote
                        </Button>
                      )}
                      <Link
                        href={top.type === 'CONSULTANT'
                          ? `/developer/consultant/${companyId}`
                          : `/developer/request-intro/${companyId}`}
                        className="text-[10px] font-bold text-primary hover:underline tracking-widest shrink-0"
                      >
                        Profile →
                      </Link>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Matched for:
                    </span>
                    {gaps.map((gap: any) => (
                      <span
                        key={gap.id}
                        className="px-2 py-0.5 text-[9px] font-bold border bg-violet-50 text-violet-600 border-violet-100"
                      >
                        {gap.label}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
