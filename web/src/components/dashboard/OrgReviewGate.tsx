'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getRoleLabel } from '@/lib/role-labels';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';

const STATUS_CONFIG = {
  pending_verification: {
    title: 'Organization Under Review',
    description: 'Your organization has been submitted and is being reviewed by our team. You will receive an email once verification is complete.',
    badgeLabel: 'Pending Review',
    icon: Icons.shieldCheck,
    tone: 'amber',
  },
  needs_update: {
    title: 'Additional Information Required',
    description: 'Our team needs more information about your organization. Review the feedback and update your profile.',
    badgeLabel: 'Needs Update',
    icon: Icons.alertTriangle,
    tone: 'blue',
  },
  rejected: {
    title: 'Application Not Approved',
    description: 'Your organization was not approved at this time. Review the feedback below or contact support for more information.',
    badgeLabel: 'Rejected',
    icon: Icons.alertTriangle,
    tone: 'red',
  },
};

const TONE_CLASS = {
  amber: {
    icon: 'border-amber-100 bg-amber-50 text-amber-700',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    feedback: 'border-amber-100 bg-amber-50 text-amber-800',
  },
  blue: {
    icon: 'border-blue-100 bg-blue-50 text-blue-700',
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    feedback: 'border-blue-100 bg-blue-50 text-blue-800',
  },
  red: {
    icon: 'border-red-100 bg-red-50 text-red-600',
    badge: 'border-red-200 bg-red-50 text-red-600',
    feedback: 'border-red-100 bg-red-50 text-red-700',
  },
};

type StatusKey = keyof typeof STATUS_CONFIG;

export function OrgReviewGate({ children }: { children: React.ReactNode }) {
  const { user, signOut, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (user?.role === 'ADMIN' || user?.verification_status === 'verified' || !user?.company_id) {
    return <>{children}</>;
  }

  const config = STATUS_CONFIG[user?.verification_status as StatusKey] ?? STATUS_CONFIG.pending_verification;
  const tone = TONE_CLASS[config.tone as keyof typeof TONE_CLASS];
  const StatusIcon = config.icon;

  const handleResubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resubmit_company' }),
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

  return (
    <div className="h-full overflow-y-auto bg-[#f7f8f5] flex items-center justify-center  md:p-6 pt-8">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[0.85fr_1.15fr] pt-10">
        <aside className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] overflow-hidden">
          <div className="bg-[#0b3b24] px-6 py-5 text-white md:px-8">
            <div className="inline-flex items-center gap-3">
              <span className="flex size-10 items-center justify-center bg-white text-[#0b3b24]">
                <Icons.logo className="size-8" />
              </span>
              <span className="text-base font-semibold tracking-tight">Afri <span className="text-emerald-200">Connect</span></span>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-green-700">Organization gate</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Access is being prepared</h1>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Your workspace opens once organization verification is complete. This protects deal rooms, project records, and counterparty access.
            </p>

            <div className="mt-8 space-y-3 border-t border-slate-200 pt-6">
              {['Company profile review', 'Admin verification', 'Dashboard access release'].map(item => (
                <div key={item} className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center border border-green-100 bg-green-50 text-green-800">
                    <Icons.check className="size-3.5" />
                  </span>
                  <span className="text-sm font-medium text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] ">
          <div className="border-b border-slate-200 p-6 md:p-8">
            <div className="flex items-start gap-4">
              <span className={`flex size-12 shrink-0 items-center justify-center border ${tone.icon}`}>
                <StatusIcon className="size-6" />
              </span>
              <div className="min-w-0">
                <span className={`inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest ${tone.badge}`}>
                  {config.badgeLabel}
                </span>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{config.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{config.description}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6 md:p-8">
            {user?.admin_note && (
              <div className={`border p-4 ${tone.feedback}`}>
                <h3 className="text-[10px] font-semibold uppercase tracking-widest">Admin Feedback</h3>
                <p className="mt-2 text-sm leading-6">{user.admin_note}</p>
              </div>
            )}

            <div className="border border-slate-200 bg-slate-50 p-4">
              <dl className="space-y-3">
                <InfoRow label="Organization" value={user?.verification_status === 'needs_update' ? 'Action Required' : 'In Queue'} />
                <InfoRow label="Email" value={user?.email} />
                <InfoRow label="Role" value={user?.role ? getRoleLabel(user.role) : 'Member'} />
              </dl>
            </div>

            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">What happens next</h3>
              <ul className="mt-3 space-y-2">
                {[
                  'Our team reviews your organization profile, typically within 1-2 business days.',
                  'You will receive an email notification once a decision is made.',
                  'Once verified, you will have full access to the platform.',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-600">
                    <Icons.check className="mt-1 size-4 shrink-0 text-green-700" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button variant="outline" className="h-11 flex-1 rounded-none border-slate-300 text-sm font-semibold text-slate-700 shadow-none" onClick={() => signOut()}>
                Sign Out
              </Button>
              {user?.verification_status === 'needs_update' ? (
                <>
                  <Button variant="outline" className="h-11 flex-1 rounded-none border-slate-300 text-sm font-semibold text-slate-700 shadow-none" onClick={() => router.push('/onboarding?edit=true')} loading={loading}>
                    Edit & Resubmit
                  </Button>
                  <Button className="h-11 flex-1 rounded-none bg-green-800 text-sm font-semibold text-white shadow-none hover:bg-green-700" onClick={handleResubmit} loading={loading}>
                    Resubmit Now
                  </Button>
                </>
              ) : (
                <Button className="h-11 flex-1 rounded-none bg-green-800 text-sm font-semibold text-white shadow-none hover:bg-green-700" onClick={() => window.location.reload()}>
                  Refresh Status
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className="truncate text-right text-sm font-semibold text-slate-950">{value || 'Not available'}</dd>
    </div>
  );
}
