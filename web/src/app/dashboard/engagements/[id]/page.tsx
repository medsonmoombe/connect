'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Engagement, User } from '@/types';
import { engagementService, getStateLabel, getValidNextStates } from '@/lib/engagement';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { EngagementMilestones } from '@/components/EngagementMilestones';
import { ContactCard } from '@/components/ContactCard';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { ArrowLeft, MessageSquare, Shield, FileText, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EngagementRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const engagementId = params.id as string;

  useEffect(() => {
    async function loadData() {
      try {
        const [engagementData, logsData] = await Promise.all([
          engagementService.getEngagement(engagementId),
          supabase.from('audit_logs').select('*').eq('entity_id', engagementId).order('timestamp', { ascending: false })
        ]);
        
        setEngagement(engagementData);
        setAuditLogs(logsData.data || []);
      } catch (err) {
        console.error('Error loading engagement data:', err);
        setError('Failed to load engagement details.');
      } finally {
        setLoading(false);
      }
    }

    if (engagementId) {
      loadData();
    }
  }, [engagementId]);

  const handleStatusUpdate = async (nextStatus: any) => {
    if (!engagement) return;
    
    setUpdating(true);
    try {
      await engagementService.updateStatus(engagement.id, nextStatus);
      // Reload to get full data and new logs
      const [fullUpdated, logsUpdated] = await Promise.all([
        engagementService.getEngagement(engagement.id),
        supabase.from('audit_logs').select('*').eq('entity_id', engagement.id).order('timestamp', { ascending: false })
      ]);
      setEngagement(fullUpdated);
      setAuditLogs(logsUpdated.data || []);
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading engagement room...</div>;
  if (error || !engagement) return <div className="p-8 text-center text-red-600">{error || 'Engagement not found.'}</div>;

  const isDeveloper = user?.company_id === engagement.project?.developer_id;
  const isCounterparty = user?.company_id === engagement.counterparty_id;
  const isAdmin = user?.role === 'ADMIN';
  
  // Can only update if they are a participant or admin
  const canUpdate = isDeveloper || isCounterparty || isAdmin;
  
  const nextPossibleStates = getValidNextStates(engagement.status);
  const showContactInfo = engagementService.canSeeContactInfo(engagement.status);

  // For the contact card, we need the "other" company
  const otherCompany = isDeveloper ? 
    // This is tricky because we don't have the counterparty company object directly in engagement yet
    // In a real app, the join would include it. Let's assume it's available or use a placeholder.
    (engagement as any).counterparty_company : 
    engagement.project?.developer;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => router.back()} 
          className="mb-8 hover:bg-white rounded-full px-6 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Left 2 Columns */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-10 rounded-[40px] shadow-xl shadow-slate-200/40 border border-slate-100">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">{engagement.project?.name}</h1>
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Global Transaction ID: {engagement.id.substring(0, 8)}</p>
                </div>
                <div className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                  engagement.status === 'DROPPED' ? "bg-red-50 text-red-600 border-red-100" : "bg-primary/10 text-primary border-primary/20"
                )}>
                  {getStateLabel(engagement.status)}
                </div>
              </div>

              <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
                <EngagementMilestones currentStatus={engagement.status} />
              </div>
            </div>

            <div className="bg-white p-10 rounded-[40px] shadow-xl shadow-slate-200/40 border border-slate-100">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                <div className="size-2 rounded-full bg-primary" />
                Strategic Actions
              </h2>
              
              {engagement.status === 'INTRO_SENT' && isDeveloper && (
                <div className="bg-slate-900 text-white p-8 rounded-3xl mb-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16" />
                  <div className="relative z-10">
                    <p className="text-lg font-bold mb-6 leading-relaxed">
                      A partner has requested an institutional introduction to your project. Accept to reveal contact details and proceed to NDA.
                    </p>
                    <div className="flex gap-4">
                      <Button 
                        onClick={() => handleStatusUpdate('INTRO_ACCEPTED')}
                        disabled={updating}
                        className="h-12 px-8 bg-primary text-white font-black rounded-xl hover:scale-105 transition-all shadow-lg shadow-primary/20"
                      >
                        {updating ? <Icons.spinner className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Accept Introduction
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => handleStatusUpdate('DROPPED')}
                        disabled={updating}
                        className="h-12 px-8 border-white/20 text-white hover:bg-white/10 font-bold rounded-xl"
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {canUpdate && engagement.status !== 'DROPPED' && engagement.status !== 'CLOSED' && engagement.status !== 'INTRO_SENT' && (
                <div className="space-y-6">
                  <p className="text-sm text-slate-500 font-medium">Update the engagement milestone as you progress through the offline institutional workflow:</p>
                  <div className="flex flex-wrap gap-3">
                    {nextPossibleStates.map(state => (
                      <Button
                        key={state}
                        onClick={() => handleStatusUpdate(state)}
                        disabled={updating}
                        variant={state === 'DROPPED' ? 'outline' : 'default'}
                        className={cn(
                          "h-12 px-6 rounded-xl font-bold transition-all",
                          state === 'DROPPED' ? 'text-red-600 border-red-100 hover:bg-red-50' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg'
                        )}
                      >
                        {updating ? <Icons.spinner className="size-4 animate-spin mr-2" /> : null}
                        Mark as {getStateLabel(state)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {engagement.status === 'DROPPED' && (
                <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Engagement Terminated</p>
                </div>
              )}
              
              {engagement.status === 'CLOSED' && (
                <div className="bg-green-50 border border-green-100 p-8 rounded-3xl flex flex-col items-center text-center">
                  <div className="size-16 bg-white rounded-full flex items-center justify-center text-green-600 mb-4 shadow-sm">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-green-900 mb-1">Transaction Successful</h3>
                  <p className="text-green-700 font-medium">This project has reached Financial Close.</p>
                </div>
              )}
            </div>

            <div className="bg-white p-10 rounded-[40px] shadow-xl shadow-slate-200/40 border border-slate-100">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                <div className="size-2 rounded-full bg-primary" />
                Verified Audit Trail
              </h2>
              <div className="space-y-6">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <div key={log.id} className="flex gap-4 relative">
                      <div className="size-3 rounded-full bg-primary mt-1.5 shrink-0 z-10" />
                      <div className="flex-grow pb-8 border-l-2 border-slate-50 -ml-[22px] pl-8">
                        <p className="text-sm font-black text-slate-900">Milestone: {log.action_type === 'TRANSITION' ? 'Status Change' : log.action_type}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex gap-4">
                    <div className="size-3 rounded-full bg-slate-200 mt-1.5 shrink-0" />
                    <div className="pl-4">
                      <p className="text-sm font-black text-slate-900">Introduction Requested</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{new Date(engagement.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Right Column */}
          <div className="space-y-8">
            <section>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 px-2">Counterparty Intelligence</h3>
              {otherCompany ? (
                <div className="animate-in slide-in-from-right-4 duration-700">
                  <ContactCard company={otherCompany} isVisible={showContactInfo} />
                </div>
              ) : (
                <div className="p-8 bg-white rounded-[32px] border border-slate-100 shadow-lg text-sm text-slate-400 font-bold uppercase text-center italic">
                  Awaiting Data...
                </div>
              )}
            </section>

            <section className="bg-slate-900 p-10 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/10 rounded-tl-[100px]" />
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Governance Rules</h3>
              <ul className="space-y-6">
                <RuleItem icon={<Shield className="w-4 h-4" />} text="Contact info is released only after mutual acceptance." />
                <RuleItem icon={<FileText className="w-4 h-4" />} text="Standard NDAs should be signed before sharing sensitive docs." />
                <RuleItem icon={<CheckCircle className="w-4 h-4" />} text="Keep milestones updated for accurate admin reporting." />
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function RuleItem({ icon, text }: { icon: any, text: string }) {
  return (
    <li className="flex items-start gap-4">
      <div className="size-8 rounded-xl bg-white/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
        {icon}
      </div>
      <span className="text-xs font-medium text-slate-300 leading-relaxed">{text}</span>
    </li>
  );
}
