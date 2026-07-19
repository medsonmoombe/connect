'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import LeafLoader from '@/components/ui/electric-loader';
import { DashboardShell } from '@/components/dashboard/Shell';
import { OrgReviewGate } from '@/components/dashboard/OrgReviewGate';
import { UnreadMessagesProvider } from '@/hooks/useUnreadMessages';

function checkMfaRequired(user: any): boolean {
  if (!user) return false;
  if (user.is_platform_admin) return true;
  if (user.org_member_role === 'OWNER') return true;
  if (user.org_member_role === 'ADMIN') return true;
  if (user.role === 'ADMIN') return true;
  if (user.org_mfa_enforced) return true;
  if (user.mfa_enabled) return true;
  return false;
}

export default function DashboardGlobalLayout({ children }: { children: ReactNode }) {
  const { user, loading, refreshUser, mfa_verified } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (!user.company_id && !user.is_platform_admin) {
        router.replace('/onboarding');
      } else if (user.company_id && !user.onboarding_complete) {
        router.replace('/onboarding');
      } else if (checkMfaRequired(user) && !mfa_verified) {
        // MFA required but not verified — full logout, not verify-otp
        fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
          window.location.href = '/login';
        });
      }
    }
  }, [user, loading, mfa_verified, router, pathname]);

  // Still loading session — show spinner
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <LeafLoader size={100} />
      </div>
    );
  }

  // Loading done but no user — show nothing (useEffect will redirect to /login)
  if (!user) return null;

  // Loading done and user exists but needs onboarding — show nothing (useEffect will redirect)
  if (!user.company_id && !user.is_platform_admin) return null;

  // If user is not verified and on the verification page, show the verification page directly
  if (user.verification_status !== 'verified' && !user.is_platform_admin && (pathname === '/dashboard/verification' || pathname === '/dashboard/profile' || pathname === '/dashboard/settings')) {
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
