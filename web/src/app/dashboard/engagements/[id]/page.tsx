'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Engagement, User } from '@/types';
import { engagementService, getStateLabel, getValidNextStates, canSeeContactInfo } from '@/lib/engagement';
import { useAuth } from '@/hooks/useAuth';
import { EngagementMilestones } from '@/components/EngagementMilestones';
import { ContactCard } from '@/components/ContactCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquare, Shield, FileText, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EngagementRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const engagementId = params.id as string;

  useEffect(() => {
    async function loadEngagement() {
      try {
        const data = await engagementService.getEngagement(engagementId);
        setEngagement(data);
      } catch (err) {
        console.error('Error loading engagement:', err);
        setError('Failed to load engagement details.');
      } finally {
        setLoading(false);
      }
    }

    if (engagementId) {
      loadEngagement();
    }
  }, [engagementId]);

  const handleStatusUpdate = async (nextStatus: any) => {
    if (!engagement) return;
    
    setUpdating(true);
    try {
      const updated = await engagementService.updateStatus(engagement.id, nextStatus);
      // Reload to get full data with joins
      const fullUpdated = await engagementService.getEngagement(engagement.id);
      setEngagement(fullUpdated);
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
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <Button 
        variant="ghost" 
        onClick={() => router.back()} 
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content - Left 2 Columns */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{engagement.project?.name}</h1>
                <p className="text-gray-500 text-sm">Engagement ID: {engagement.id.substring(0, 8)}</p>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-xs font-bold uppercase",
                engagement.status === 'DROPPED' ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
              )}>
                {getStateLabel(engagement.status)}
              </div>
            </div>

            <EngagementMilestones currentStatus={engagement.status} />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-blue-600" />
              Engagement Actions
            </h2>
            
            {engagement.status === 'INTRO_SENT' && isDeveloper && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
                <p className="text-sm text-yellow-800 mb-4">
                  A partner has requested an introduction to your project. Accept to reveal contact details and proceed to NDA.
                </p>
                <div className="flex gap-3">
                  <Button 
                    onClick={() => handleStatusUpdate('INTRO_ACCEPTED')}
                    disabled={updating}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Accept Introduction
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => handleStatusUpdate('DROPPED')}
                    disabled={updating}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Decline
                  </Button>
                </div>
              </div>
            )}

            {canUpdate && engagement.status !== 'DROPPED' && engagement.status !== 'CLOSED' && engagement.status !== 'INTRO_SENT' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Update the engagement milestone as you progress through the offline workflow:</p>
                <div className="flex flex-wrap gap-3">
                  {nextPossibleStates.map(state => (
                    <Button
                      key={state}
                      onClick={() => handleStatusUpdate(state)}
                      disabled={updating}
                      variant={state === 'DROPPED' ? 'outline' : 'default'}
                      className={state === 'DROPPED' ? 'text-red-600 border-red-200 hover:bg-red-50' : ''}
                    >
                      Mark as {getStateLabel(state)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {engagement.status === 'DROPPED' && (
              <p className="text-gray-500 italic text-sm">This engagement has been closed/dropped.</p>
            )}
            
            {engagement.status === 'CLOSED' && (
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-center text-green-800">
                <CheckCircle className="w-5 h-5 mr-2" />
                <span className="font-semibold">Project Successfully Closed!</span>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold mb-4 flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-blue-600" />
              Activity Log
            </h2>
            <div className="space-y-4">
              <div className="border-l-2 border-blue-200 pl-4 py-1">
                <p className="text-sm font-semibold">Introduction Requested</p>
                <p className="text-xs text-gray-500">{new Date(engagement.created_at).toLocaleDateString()}</p>
              </div>
              {engagement.status !== 'INTRO_SENT' && (
                <div className="border-l-2 border-blue-600 pl-4 py-1">
                  <p className="text-sm font-semibold">Milestone Reached: {getStateLabel(engagement.status)}</p>
                  <p className="text-xs text-gray-500">{new Date(engagement.updated_at).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Right Column */}
        <div className="space-y-8">
          <section>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Partner Details</h3>
            {otherCompany ? (
              <ContactCard company={otherCompany} isVisible={showContactInfo} />
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-500 italic">
                Company details loading...
              </div>
            )}
          </section>

          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Engagement Rules</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <Shield className="w-4 h-4 mr-2 text-blue-600 mt-0.5" />
                <span className="text-xs text-gray-600">Contact info is released only after mutual acceptance.</span>
              </li>
              <li className="flex items-start">
                <FileText className="w-4 h-4 mr-2 text-blue-600 mt-0.5" />
                <span className="text-xs text-gray-600">Standard NDAs should be signed before sharing sensitive docs.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-4 h-4 mr-2 text-blue-600 mt-0.5" />
                <span className="text-xs text-gray-600">Keep milestones updated for accurate admin reporting.</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
