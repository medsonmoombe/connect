'use client';

import { useState } from 'react';
import { CapitalMatchResult, TechnicalMatchResult } from '@/types';
import { Button } from '@/components/ui/button';
import { Icons, ShieldCheck, Zap, MapPin, DollarSign, Check, Send } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { engagementService } from '@/lib/engagement';

interface MatchingSectionProps {
  projectId: string;
  capitalMatches: CapitalMatchResult[];
  technicalMatches: TechnicalMatchResult[];
}

export function MatchingSection({ projectId, capitalMatches, technicalMatches }: MatchingSectionProps) {
  const [activeTab, setActiveTab] = useState<'CAPITAL' | 'TECHNICAL'>('CAPITAL');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<string[]>([]);

  const matches = activeTab === 'CAPITAL' ? capitalMatches : technicalMatches;

  const handleExpressInterest = async (partnerId: string, type: 'CAPITAL' | 'TECHNICAL') => {
    setSendingId(partnerId);
    try {
      await engagementService.createEngagement({
        project_id: projectId,
        counterparty_id: partnerId,
        counterparty_type: type,
        status: 'INTRO_SENT'
      });
      setSentIds([...sentIds, partnerId]);
    } catch (error) {
      console.error('Error expressing interest:', error);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-text-main tracking-tight">AI Matching Engine</h2>
          <p className="text-text-muted font-medium mt-2">Connecting you with the most compatible partners based on your project profile.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('CAPITAL')}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'CAPITAL' ? "bg-white text-primary shadow-sm" : "text-text-muted hover:text-text-main"
            )}
          >
            Capital Partners
          </button>
          <button
            onClick={() => setActiveTab('TECHNICAL')}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'TECHNICAL' ? "bg-white text-primary shadow-sm" : "text-text-muted hover:text-text-main"
            )}
          >
            Technical Partners
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {matches.map((match) => {
          const partner = activeTab === 'CAPITAL' ? match.capital_partner : (match as TechnicalMatchResult).technical_partner;
          if (!partner) return null;
          
          const isSent = sentIds.includes(partner.id);
          const isSending = sendingId === partner.id;

          return (
            <div key={match.id} className="bg-surface border border-gray-100 rounded-[32px] p-6 shadow-soft hover:shadow-medium transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-[100px] -z-10 group-hover:bg-primary/10 transition-colors"></div>
              
              <div className="flex items-start justify-between mb-6">
                <div className="h-14 w-14 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden">
                  {partner.company?.logo_url ? (
                    <img src={partner.company.logo_url} alt={partner.company.name} className="h-10 w-10 object-contain" />
                  ) : (
                    <Icons.building className="size-6 text-primary" />
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-2xl font-black text-primary leading-none">{match.compatibility_score}%</div>
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Match</div>
                </div>
              </div>

              <h3 className="text-xl font-bold text-text-main mb-1 group-hover:text-primary transition-colors">{partner.company?.name}</h3>
              <p className="text-sm text-text-muted font-medium mb-6 line-clamp-2">{partner.company?.description || 'Institutional partner focused on sustainable infrastructure across Africa.'}</p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-xs font-bold text-text-main">
                  <div className="h-6 w-6 rounded-lg bg-slate-50 flex items-center justify-center"><MapPin className="size-3 text-primary" /></div>
                  {activeTab === 'CAPITAL' 
                    ? (partner as any).geographic_focus?.slice(0, 2).join(', ') 
                    : (partner as any).regions_operated?.slice(0, 2).join(', ')}
                </div>
                {activeTab === 'CAPITAL' ? (
                  <div className="flex items-center gap-3 text-xs font-bold text-text-main">
                    <div className="h-6 w-6 rounded-lg bg-slate-50 flex items-center justify-center"><DollarSign className="size-3 text-primary" /></div>
                    ${((partner as any).min_ticket_size / 1000000).toFixed(0)}M - ${((partner as any).max_ticket_size / 1000000).toFixed(0)}M
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-xs font-bold text-text-main">
                    <div className="h-6 w-6 rounded-lg bg-slate-50 flex items-center justify-center"><Zap className="size-3 text-primary" /></div>
                    {(partner as any).min_mw_capacity} - {(partner as any).max_mw_capacity} MW
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs font-bold text-text-main">
                  <div className="h-6 w-6 rounded-lg bg-slate-50 flex items-center justify-center"><ShieldCheck className="size-3 text-primary" /></div>
                  {(partner as any).risk_tolerance || 'Track Record'} Verified
                </div>
              </div>

              <Button
                onClick={() => handleExpressInterest(partner.id, activeTab)}
                disabled={isSent || isSending}
                className={cn(
                  "w-full h-12 rounded-2xl font-bold transition-all flex items-center justify-center gap-2",
                  isSent 
                    ? "bg-green-50 text-green-600 border border-green-100 hover:bg-green-50 cursor-default" 
                    : "bg-primary text-primary-content hover:bg-primary/90 shadow-lg hover:shadow-primary/20"
                )}
              >
                {isSending ? (
                  <Icons.spinner className="size-4 animate-spin" />
                ) : isSent ? (
                  <>
                    <Check className="size-4" />
                    Interest Sent
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    Express Interest
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {matches.length === 0 && (
        <div className="bg-slate-50 rounded-[40px] p-12 text-center border-2 border-dashed border-gray-200">
          <div className="h-16 w-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-6">
            <Icons.search className="size-8 text-text-muted" />
          </div>
          <h3 className="text-xl font-bold text-text-main mb-2">No Matches Found Yet</h3>
          <p className="text-text-muted font-medium max-w-md mx-auto">Complete your project documentation to help our matching engine find the perfect partners for you.</p>
        </div>
      )}
    </div>
  );
}
