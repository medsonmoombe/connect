'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import LeafLoader from '@/components/ui/electric-loader';
import { DashboardShell } from '@/components/dashboard/Shell';
import { OrgReviewGate } from '@/components/dashboard/OrgReviewGate';
import { UnreadMessagesProvider } from '@/hooks/useUnreadMessages';
import { useActivityHeartbeat } from '@/hooks/useActivityHeartbeat';

function checkMfaRequired(user: any): boolean {
  if (!user) return false;
  if (user.is_platform_admin) return true;
  if (user.is_authority_user) return true;
  if (user.org_member_role === 'OWNER') return true;
  if (user.org_member_role === 'ADMIN') return true;
  if (user.role === 'ADMIN') return true;
  if (user.org_mfa_enforced) return true;
  if (user.mfa_enabled) return true;
  return false;
}

export function PortalShell({ children }: { children: ReactNode }) {
  const { user, loading, mfa_verified } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useActivityHeartbeat();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (user.is_authority_user && pathname.startsWith('/developer')) {
        router.replace('/authority');
      } else if (!user.company_id && !user.is_platform_admin && !user.onboarding_complete) {
        router.replace('/onboarding');
      } else if (user.company_id && !user.onboarding_complete) {
        router.replace('/onboarding');
      } else if (checkMfaRequired(user) && !mfa_verified) {
        fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
          window.location.href = '/login';
        });
      }
    }
  }, [user, loading, mfa_verified, router, pathname]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <LeafLoader size={100} />
      </div>
    );
  }

  if (!user) return null;
  if (!user.company_id && !user.is_platform_admin) return null;

  const isPortalPage = ['/verification', '/profile', '/settings'].some(p => pathname.startsWith(p));
  if (user.verification_status !== 'verified' && !user.is_platform_admin && isPortalPage) {
    return <DashboardShell>{children}</DashboardShell>;
  }

  return (
    <OrgReviewGate>
      <UnreadMessagesProvider>
        <DashboardShell>{children}</DashboardShell>
      </UnreadMessagesProvider>
    </OrgReviewGate>
  );
}
