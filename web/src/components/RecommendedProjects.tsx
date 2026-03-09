'use client';

import { useState } from 'react';
import { CapitalMatchResult, TechnicalMatchResult, Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Icons, Zap, MapPin, DollarSign, Check, Send, ArrowRight } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { engagementService } from '@/lib/engagement';
import Link from 'next/link';

interface RecommendedProjectsProps {
  partnerId: string;
  partnerType: 'CAPITAL' | 'TECHNICAL';
  matches: (CapitalMatchResult | TechnicalMatchResult)[];
}

export function RecommendedProjects({ partnerId, partnerType, matches }: RecommendedProjectsProps) {
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<string[]>([]);

  const handleExpressInterest = async (projectId: string) => {
    setSendingId(projectId);
    try {
      await engagementService.createEngagement({
        project_id: projectId,
        counterparty_id: partnerId,
        counterparty_type: partnerType,
        status: 'INTRO_SENT'
      });
      setSentIds([...sentIds, projectId]);
    } catch (error) {
      console.error('Error expressing interest:', error);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text-main tracking-tight">Top Project Matches</h2>
        <Link href="/marketplace" className="text-sm font-bold text-primary hover:underline flex items-center gap-2">
          View All Marketplace <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {matches.map((match) => {
          const project = (match as any).project as Project;
          if (!project) return null;
          
          const isSent = sentIds.includes(project.id);
          const isSending = sendingId === project.id;

          return (
            <div key={match.id} className="bg-surface border border-gray-100 rounded-[32px] p-8 shadow-soft hover:shadow-medium transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[150px] -z-10 group-hover:bg-primary/10 transition-colors"></div>
              
              <div className="flex items-start justify-between mb-8">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/10 mb-4">
                    <Icons.star className="size-3 fill-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{match.compatibility_score}% Compatibility</span>
                  </div>
                  <h3 className="text-2xl font-black text-text-main group-hover:text-primary transition-colors">{project.name}</h3>
                  <p className="text-sm text-text-muted font-bold uppercase tracking-widest mt-1">{project.developer?.name || 'Energy Developer'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-xs font-bold text-text-main">
                    <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center"><Zap className="size-4 text-primary" /></div>
                    {project.project_size_mw} MW
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-text-main">
                    <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center"><MapPin className="size-4 text-primary" /></div>
                    {project.location_country}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-xs font-bold text-text-main">
                    <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center"><DollarSign className="size-4 text-primary" /></div>
                    ${(project.capital_required / 1000000).toFixed(1)}M Required
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-text-main">
                    <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center"><Icons.fileText className="size-4 text-primary" /></div>
                    {project.project_stage}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Link href={`/projects/${project.id}`} className="flex-1">
                  <Button variant="outline" className="w-full h-14 rounded-2xl font-bold border-gray-200 text-text-main hover:bg-slate-50">
                    View Details
                  </Button>
                </Link>
                <Button
                  onClick={() => handleExpressInterest(project.id)}
                  disabled={isSent || isSending}
                  className={cn(
                    "flex-[1.5] h-14 rounded-2xl font-bold transition-all flex items-center justify-center gap-2",
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
            </div>
          );
        })}
      </div>

      {matches.length === 0 && (
        <div className="bg-slate-50 rounded-[40px] p-16 text-center border-2 border-dashed border-gray-200">
          <div className="h-20 w-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-8">
            <Icons.search className="size-10 text-text-muted" />
          </div>
          <h3 className="text-2xl font-bold text-text-main mb-3">Searching for Opportunities...</h3>
          <p className="text-text-muted font-medium max-w-md mx-auto mb-8 text-lg">Our AI matching engine is analyzing the marketplace to find projects that align with your criteria.</p>
          <Button variant="outline" className="h-12 px-8 rounded-xl border-gray-200 font-bold text-text-main hover:bg-white">
            Update Your Preferences
          </Button>
        </div>
      )}
    </div>
  );
}
