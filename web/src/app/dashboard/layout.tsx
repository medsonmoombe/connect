'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';
import LeafLoader from '@/components/ui/electric-loader';
import { DashboardShell } from '@/components/dashboard/Shell';
import { OrgReviewGate } from '@/components/dashboard/OrgReviewGate';

export default function DashboardGlobalLayout({ children }: { children: ReactNode }) {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (!user.company_id && !user.is_platform_admin) {
        router.replace('/onboarding');
      } else if (user.company_id && !user.onboarding_complete) {
        fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'complete_onboarding' }),
        }).then(() => refreshUser());
      }
    }
  }, [user, loading, router, pathname]);

  // Still loading session — show spinner
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <LeafLoader size={100} />
      </div>
    );
  }

  // Loading done but no user — show nothing (useEffect will redirect)
  if (!user) return null;

  // Loading done and user exists but needs onboarding — show nothing (useEffect will redirect)
  if (!user.company_id && !user.is_platform_admin) return null;

  return (
    <OrgReviewGate>
      <DashboardShell>{children}</DashboardShell>
    </OrgReviewGate>
  );
}
