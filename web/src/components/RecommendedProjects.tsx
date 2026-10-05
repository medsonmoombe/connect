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
      await engagementService.requestIntroduction(
        projectId,
        partnerId,
        partnerType
      );
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
        <h2 className="text-base font-bold text-text-main tracking-tight">Top Project Matches</h2>
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
            <div key={match.id} className="bg-surface border border-gray-100 rounded-none p-5 shadow-soft hover:shadow-medium transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-[120px] -z-10 group-hover:bg-primary/10 transition-colors"></div>
              
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/10 mb-2">
                    <Icons.star className="size-2.5 fill-primary" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">{match.compatibility_score}% Compatibility</span>
                  </div>
                  <h3 className="text-base font-bold text-text-main group-hover:text-primary transition-colors">{project.name}</h3>
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-0.5">{project.developer?.name || 'Energy Developer'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-text-main">
                    <div className="h-6 w-6 rounded-none bg-slate-50 flex items-center justify-center"><Zap className="size-3 text-primary" /></div>
                    {project.project_size_mw} MW
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-text-main">
                    <div className="h-6 w-6 rounded-none bg-slate-50 flex items-center justify-center"><MapPin className="size-3 text-primary" /></div>
                    {project.location_country}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-text-main">
                    <div className="h-6 w-6 rounded-none bg-slate-50 flex items-center justify-center"><DollarSign className="size-3 text-primary" /></div>
                    ${(project.capital_required / 1000000).toFixed(1)}M Required
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-text-main">
                    <div className="h-6 w-6 rounded-none bg-slate-50 flex items-center justify-center"><Icons.fileText className="size-3 text-primary" /></div>
                    {project.project_stage}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Link href={`/projects/${project.id}`} className="flex-1">
                  <Button variant="outline" className="w-full h-9 rounded-none font-bold text-xs border-gray-200 text-text-main hover:bg-slate-50">
                    View Details
                  </Button>
                </Link>
                <Button
                  onClick={() => handleExpressInterest(project.id)}
                  disabled={isSent || isSending}
                  className={cn(
                    "flex-[1.5] h-9 rounded-none font-bold text-xs transition-all flex items-center justify-center gap-1.5",
                    isSent 
                      ? "bg-green-50 text-green-600 border border-green-100 hover:bg-green-50 cursor-default" 
                      : "bg-primary text-primary-content hover:bg-primary/90 shadow-lg hover:shadow-primary/20"
                  )}
                >
                  {isSending ? (
                    <Icons.spinner className="size-3 animate-spin" />
                  ) : isSent ? (
                    <>
                      <Check className="size-3" />
                      Interest Sent
                    </>
                  ) : (
                    <>
                      <Send className="size-3" />
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
        <div className="bg-slate-50 rounded-none p-8 text-center border border-dashed border-gray-200">
          <div className="h-12 w-12 bg-white rounded-none shadow-sm flex items-center justify-center mx-auto mb-3">
            <Icons.search className="size-5 text-text-muted" />
          </div>
          <h3 className="text-sm font-bold text-text-main mb-1">Searching for Opportunities...</h3>
          <p className="text-text-muted font-medium max-w-sm mx-auto mb-5 text-xs">Our AI matching engine is analyzing the marketplace to find projects that align with your criteria.</p>
          <Button variant="outline" className="h-8 px-4 rounded-none text-xs border-gray-200 font-bold text-text-main hover:bg-white">
            Update Your Preferences
          </Button>
        </div>
      )}
    </div>
  );
}
