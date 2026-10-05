'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { CapitalMatchResult, TechnicalMatchResult, Engagement } from '@/types';
import { Button } from '@/components/ui/button';
import { Icons, ShieldCheck, Zap, MapPin, DollarSign, Check, Send } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { engagementService, getStateLabel } from '@/lib/engagement';

interface MatchingSectionProps {
  projectId: string;
  projectTechnology?: string;
  capitalMatches: CapitalMatchResult[];
  technicalMatches: TechnicalMatchResult[];
  engagements?: Engagement[];
  isOrgAdmin?: boolean;
}

export function MatchingSection({ projectId, projectTechnology, capitalMatches, technicalMatches, engagements = [], isOrgAdmin }: MatchingSectionProps) {
  const [activeTab, setActiveTab] = useState<'CAPITAL' | 'TECHNICAL'>('CAPITAL');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<string[]>([]);

  const engagedPartnerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of engagements) ids.add(e.counterparty_id);
    return ids;
  }, [engagements]);

  const engagedMap = useMemo(() => {
    const map: Record<string, Engagement> = {};
    for (const e of engagements) {
      if (!map[e.counterparty_id]) map[e.counterparty_id] = e;
    }
    return map;
  }, [engagements]);

  const matches = activeTab === 'CAPITAL' ? capitalMatches : technicalMatches;

  const handleExpressInterest = async (partnerId: string, type: 'CAPITAL' | 'TECHNICAL') => {
    if (engagedPartnerIds.has(partnerId)) return;
    setSendingId(partnerId);
    try {
      await engagementService.requestIntroduction(projectId, partnerId, type);
      setSentIds(prev => [...prev, partnerId]);
    } catch (error) {
      console.error('Error expressing interest:', error);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">

      {/* Dark-green header — matches SectionCard pattern */}
      <div className="bg-[#0b3b24] px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold text-emerald-200/50 uppercase tracking-widest mb-0.5">AI Matching Engine</p>
          <h2 className="text-sm font-bold text-white">Matched Partners</h2>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-white/10 p-1 rounded-none">
          {(['CAPITAL', 'TECHNICAL'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-1.5 rounded-none text-[10px] font-bold uppercase tracking-widest transition-all',
                activeTab === tab
                  ? 'bg-white text-green-900 shadow-sm'
                  : 'text-emerald-200/70 hover:text-white',
              )}
            >
              {tab === 'CAPITAL' ? 'Capital' : 'Technical'}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        {matches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches.map((match) => {
              const partner = activeTab === 'CAPITAL'
                ? (match as CapitalMatchResult).capital_partner
                : (match as TechnicalMatchResult).technical_partner;
              if (!partner) return null;

              const isSent = sentIds.includes(partner.id);
              const isSending = sendingId === partner.id;
              const isAlreadyEngaged = engagedPartnerIds.has(partner.id);
              const existingEngagement = engagedMap[partner.id];
              const isAnonymized = activeTab === 'CAPITAL';

              const displayName = isAnonymized
                ? `${(partner as any).preferred_capital_structure?.[0] || 'Institutional'} Partner`
                : partner.company?.name;

              const displayDescription = isAnonymized
                ? `Verified ${(partner as any).risk_tolerance?.toLowerCase() || 'institutional'} scale investor targeting ${projectTechnology || 'renewable'} infrastructure projects.`
                : partner.company?.description || 'Institutional partner focused on sustainable infrastructure across Africa.';

              const score: number = match.compatibility_score;
              const scoreColor = score >= 70 ? 'text-emerald-600' : score >= 45 ? 'text-amber-600' : 'text-slate-500';
              const scoreBg   = score >= 70 ? 'bg-emerald-50 border-emerald-200' : score >= 45 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200';

              return (
                <div key={match.id} className="border border-slate-200 bg-white hover:border-green-300 hover:shadow-md transition-all group flex flex-col">

                  {/* Card header */}
                  <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                        {partner.company?.logo_url && !isAnonymized ? (
                          <img src={partner.company.logo_url} alt={partner.company.name} className="h-6 w-6 object-contain" />
                        ) : (
                          <Icons.building className="size-4 text-green-800" />
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-900 truncate group-hover:text-green-800 transition-colors">
                        {displayName}
                      </p>
                    </div>
                    <div className={cn('shrink-0 px-2 py-1 border text-center ml-2', scoreBg)}>
                      <span className={cn('text-sm font-black leading-none', scoreColor)}>{score}%</span>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Match</p>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="px-4 py-3 flex-1 space-y-2">
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed line-clamp-2">{displayDescription}</p>

                    <div className="pt-1 space-y-1.5">
                      <SpecRow icon={<MapPin className="size-3 text-green-800" />}>
                        {activeTab === 'CAPITAL'
                          ? (partner as any).geographic_focus?.slice(0, 2).join(', ') || '—'
                          : (partner as any).regions_operated?.slice(0, 2).join(', ') || '—'}
                      </SpecRow>

                      {activeTab === 'CAPITAL' ? (
                        <SpecRow icon={<DollarSign className="size-3 text-green-800" />}>
                          K{((partner as any).min_ticket_size / 1_000_000).toFixed(0)}M – K{((partner as any).max_ticket_size / 1_000_000).toFixed(0)}M
                        </SpecRow>
                      ) : (
                        <SpecRow icon={<Zap className="size-3 text-green-800" />}>
                          {(partner as any).min_mw_capacity} – {(partner as any).max_mw_capacity} MW
                        </SpecRow>
                      )}

                      <SpecRow icon={<ShieldCheck className="size-3 text-green-800" />}>
                        {(partner as any).risk_tolerance || 'Track Record'} Verified
                      </SpecRow>
                    </div>
                  </div>

                  {/* Card footer — action */}
                  {(isOrgAdmin || isAlreadyEngaged || isSent) && (
                    <div className="px-4 pb-4">
                      {isOrgAdmin ? (
                        <Button
                          onClick={() => !isAlreadyEngaged && !isSent && handleExpressInterest(partner.id, activeTab)}
                          disabled={isAlreadyEngaged || isSent || isSending}
                          className={cn(
                            'w-full h-9 text-[10px] font-bold uppercase tracking-widest transition-all',
                            isAlreadyEngaged || isSent
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 cursor-default shadow-none'
                              : 'bg-[#0b3b24] text-white hover:bg-[#0d4a2e]',
                          )}
                          title={isAlreadyEngaged ? `Engagement: ${getStateLabel(existingEngagement?.status)}` : undefined}
                        >
                          {isSending ? (
                            <Icons.spinner className="size-3.5 animate-spin" />
                          ) : isAlreadyEngaged ? (
                            <><Check className="size-3.5 mr-1.5" /> Engaged</>
                          ) : isSent ? (
                            <><Check className="size-3.5 mr-1.5" /> Interest Sent</>
                          ) : (
                            <><Send className="size-3.5 mr-1.5" /> Express Interest</>
                          )}
                        </Button>
                      ) : (isAlreadyEngaged || isSent) ? (
                        <div className="w-full h-9 bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest">
                          <Check className="size-3.5 mr-1.5" /> {isAlreadyEngaged ? 'Engaged' : 'Interest Sent'}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center border border-dashed border-slate-200">
            <div className="size-12 bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-4">
              <Icons.search className="size-5 text-slate-300" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">No Matches Yet</h4>
            <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
              Complete your project documentation to help our matching engine find the right partners.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SpecRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
      <div className="size-5 bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="truncate">{children}</span>
    </div>
  );
}
