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
    for (const e of engagements) {
      ids.add(e.counterparty_id);
    }
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
      setSentIds([...sentIds, partnerId]);
    } catch (error) {
      console.error('Error expressing interest:', error);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="dash-section-label mb-1">AI Matching Engine</p>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Matched Partners</h2>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('CAPITAL')}
            className={cn(
              "px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
              activeTab === 'CAPITAL' ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Capital
          </button>
          <button
            onClick={() => setActiveTab('TECHNICAL')}
            className={cn(
              "px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
              activeTab === 'TECHNICAL' ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Technical
          </button>
        </div>
      </div>

      {/* Match Cards */}
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

            return (
              <div key={match.id} className="dash-card p-5 flex flex-col hover:shadow-md transition-all group">
                {/* Top Row: Icon + Score */}
                <div className="flex items-start justify-between mb-4">
                  <div className="h-11 w-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                    {partner.company?.logo_url && !isAnonymized ? (
                      <img src={partner.company.logo_url} alt={partner.company.name} className="h-8 w-8 object-contain" />
                    ) : (
                      <Icons.building className="size-5 text-primary" />
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-primary leading-none">{match.compatibility_score}%</span>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Match</p>
                  </div>
                </div>

                {/* Name + Description */}
                <h4 className="text-sm font-bold text-slate-900 mb-1 group-hover:text-primary transition-colors">{displayName}</h4>
                <p className="text-xs text-slate-500 font-medium mb-4 line-clamp-2 leading-relaxed">{displayDescription}</p>

                {/* Specs */}
                <div className="space-y-2 mb-5 flex-1">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                    <div className="h-5 w-5 rounded bg-slate-50 flex items-center justify-center"><MapPin className="size-3 text-primary" /></div>
                    {activeTab === 'CAPITAL'
                      ? (partner as any).geographic_focus?.slice(0, 2).join(', ')
                      : (partner as any).regions_operated?.slice(0, 2).join(', ')}
                  </div>
                  {activeTab === 'CAPITAL' ? (
                    <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                      <div className="h-5 w-5 rounded bg-slate-50 flex items-center justify-center"><DollarSign className="size-3 text-primary" /></div>
                      K{((partner as any).min_ticket_size / 1000000).toFixed(0)}M – K{((partner as any).max_ticket_size / 1000000).toFixed(0)}M
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                      <div className="h-5 w-5 rounded bg-slate-50 flex items-center justify-center"><Zap className="size-3 text-primary" /></div>
                      {(partner as any).min_mw_capacity} – {(partner as any).max_mw_capacity} MW
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                    <div className="h-5 w-5 rounded bg-slate-50 flex items-center justify-center"><ShieldCheck className="size-3 text-primary" /></div>
                    {(partner as any).risk_tolerance || 'Track Record'} Verified
                  </div>
                </div>

                {/* Action */}
                {isOrgAdmin && (
                  <Button
                    onClick={() => !isAlreadyEngaged && handleExpressInterest(partner.id, activeTab)}
                    disabled={isAlreadyEngaged || isSent || isSending}
                    className={cn(
                      "w-full h-10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                      isAlreadyEngaged
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-50 cursor-default"
                        : isSent
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-50 cursor-default"
                        : "bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/10"
                    )}
                    title={isAlreadyEngaged ? `Engagement exists (${existingEngagement?.status})` : undefined}
                  >
                    {isSending ? (
                      <Icons.spinner className="size-3.5 animate-spin" />
                    ) : isAlreadyEngaged ? (
                      <><Check className="size-3.5 mr-1.5" /> Expressed</>
                    ) : isSent ? (
                      <><Check className="size-3.5 mr-1.5" /> Sent</>
                    ) : (
                      <><Send className="size-3.5 mr-1.5" /> Express Interest</>
                    )}
                  </Button>
                )}
                {!isOrgAdmin && (isAlreadyEngaged || isSent) && (
                  <div className="w-full h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-xs font-bold uppercase tracking-widest">
                    <Check className="size-3.5 mr-1.5" /> {isAlreadyEngaged ? 'Expressed' : 'Interest Sent'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="dash-card p-10 text-center">
          <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Icons.search className="size-6 text-slate-300" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 mb-1">No Matches Yet</h4>
          <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
            Complete your project documentation to help our matching engine find the right partners.
          </p>
        </div>
      )}
    </div>
  );
}
