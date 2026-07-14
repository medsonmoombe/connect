'use client';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_CONFIG = {
  pending_verification: {
    title: 'Organization Under Review',
    description: 'Your organization has been submitted and is being reviewed by our team. You\'ll receive an email once verification is complete.',
    icon: <Icons.shieldCheck className="w-12 h-12 text-amber-500" />,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    badgeLabel: 'Pending Review',
  },
  needs_update: {
    title: 'Additional Information Required',
    description: 'Our team needs more information about your organization. Please review the feedback below and update your profile.',
    icon: <Icons.alertTriangle className="w-12 h-12 text-blue-500" />,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
    badgeLabel: 'Needs Update',
  },
  rejected: {
    title: 'Application Not Approved',
    description: 'Your organization was not approved at this time. Please review the feedback below, or contact support for more information.',
    icon: <Icons.alertTriangle className="w-12 h-12 text-red-500" />,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-600',
    badge: 'bg-red-100 text-red-600',
    badgeLabel: 'Rejected',
  },
  verified: {
    title: 'Organization Verified',
    description: 'Your organization has been verified and has full access to the platform.',
    icon: <Icons.checkCircle2 className="w-12 h-12 text-green-500" />,
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-700',
    badgeLabel: 'Verified',
  },
};

export default function VerificationStatusPage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const config = STATUS_CONFIG[user?.verification_status as keyof typeof STATUS_CONFIG]
    ?? STATUS_CONFIG.pending_verification;

  useEffect(() => {
    // If user is verified, redirect to dashboard
    if (user?.verification_status === 'verified') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleResubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${user?.company_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', status: 'pending_verification', note: 'Resubmitted by organization' }),
      });

      if (res.ok) {
        toast.success('Organization resubmitted for review', {
          description: 'Your organization has been resubmitted and is now pending verification.',
        });
        await refreshUser();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to resubmit');
      }
    } catch {
      toast.error('An error occurred while resubmitting');
    } finally {
      setLoading(false);
    }
  };

  const handleEditAndResubmit = async () => {
    setLoading(true);
    try {
      // Set status back to pending_verification so user can edit and resubmit
      const res = await fetch(`/api/admin/organizations/${user?.company_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', status: 'pending_verification', note: 'Organization requested to edit and resubmit' }),
      });

      if (res.ok) {
        toast.success('Organization status updated', {
          description: 'You can now edit your organization details and resubmit for review.',
        });
        await refreshUser();
        router.push('/onboarding');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update status');
      }
    } catch {
      toast.error('An error occurred while updating status');
    } finally {
      setLoading(false);
    }
  };

  // If user is verified, don't show this page
  if (user?.verification_status === 'verified') {
    return null;
  }

  // If user has no company, show a message
  if (!user?.company_id) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden p-8">
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Icons.building className="w-6 h-6 text-slate-400" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">No Organization Found</h1>
              <p className="text-slate-500">
                You haven&apos;t registered an organization yet. Please complete onboarding first.
              </p>
            </div>
            <div className="flex justify-center mt-6">
              <Button
                className="h-11 rounded-xl bg-green-800 hover:bg-green-700 text-white font-bold"
                onClick={() => router.push('/onboarding')}
              >
                Start Onboarding
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className={`${config.bg} border-b ${config.border} px-8 py-6 flex items-center gap-4`}>
            {config.icon}
            <div>
              <h1 className="text-xl font-black text-slate-900">{config.title}</h1>
              <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${config.badge}`}>
                {config.badgeLabel}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-8 space-y-6">
            <p className="text-slate-600 text-sm leading-relaxed">{config.description}</p>

            {/* Admin Feedback */}
            {user?.admin_note && (
              <div className={`p-4 rounded-2xl border ${user.verification_status === 'needs_update' ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
                <h4 className={`text-xs font-black uppercase tracking-widest mb-2 ${user.verification_status === 'needs_update' ? 'text-blue-600' : 'text-red-600'}`}>
                  Admin Feedback
                </h4>
                <p className={`text-sm leading-relaxed ${user.verification_status === 'needs_update' ? 'text-blue-800' : 'text-red-800'}`}>
                  {user.admin_note}
                </p>
              </div>
            )}

            {/* Org details */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Organization</span>
                <span className="text-sm font-bold text-slate-900">{user?.company_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</span>
                <span className="text-sm font-bold text-slate-900">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                <Badge variant={config.badge === 'bg-green-100 text-green-700' ? 'green' : config.badge === 'bg-blue-100 text-blue-700' ? 'blue' : config.badge === 'bg-red-100 text-red-600' ? 'red' : 'yellow'}>
                  {config.badgeLabel}
                </Badge>
              </div>
            </div>

            {/* What to expect */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">What happens next</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-3 text-sm text-slate-600">
                  <Icons.check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Our team reviews your organization profile (typically 1-2 business days)</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-600">
                  <Icons.check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <span>You&apos;ll receive an email notification once a decision is made</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-600">
                  <Icons.check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Once verified, you&apos;ll have full access to the platform</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-slate-200 text-slate-600 font-bold"
                onClick={() => router.push('/dashboard')}
              >
                Go to Dashboard
              </Button>
              {user?.verification_status === 'needs_update' ? (
                <>
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl border-blue-200 text-blue-600 font-bold"
                    onClick={handleEditAndResubmit}
                    loading={loading}
                  >
                    Edit & Resubmit
                  </Button>
                  <Button
                    className="flex-1 h-11 rounded-xl bg-green-800 hover:bg-green-700 text-white font-bold"
                    onClick={handleResubmit}
                    loading={loading}
                  >
                    Resubmit Now
                  </Button>
                </>
              ) : user?.verification_status === 'rejected' ? (
                <Button
                  className="flex-1 h-11 rounded-xl bg-green-800 hover:bg-green-700 text-white font-bold"
                  onClick={() => window.location.reload()}
                >
                  Refresh Status
                </Button>
              ) : (
                <Button
                  className="flex-1 h-11 rounded-xl bg-green-800 hover:bg-green-700 text-white font-bold"
                  onClick={() => window.location.reload()}
                >
                  Refresh Status
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
