'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';
import LeafLoader from '@/components/ui/electric-loader';
import { DashboardShell } from '@/components/dashboard/Shell';
import { OrgReviewGate } from '@/components/dashboard/OrgReviewGate';
import { MfaVerification } from '@/components/auth/MfaVerification';

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
  const { user, loading, refreshUser, mfa_verified, setMfaVerified, signOut } = useAuth();
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

  // User needs MFA verification (platform admins, org admins, org-enforced, or self-enabled)
  if (checkMfaRequired(user) && !mfa_verified && pathname !== '/dashboard/admin') {
    return (
      <MfaVerification
        email={user.email}
        onVerified={() => setMfaVerified(true)}
        onSignOut={() => signOut()}
      />
    );
  }

  // If user is not verified and on the verification page, show the verification page directly
  if (user.verification_status !== 'verified' && !user.is_platform_admin && (pathname === '/dashboard/verification' || pathname === '/dashboard/profile' || pathname === '/dashboard/settings')) {
    return <DashboardShell>{children}</DashboardShell>;
  }

  return (
    <OrgReviewGate>
      <DashboardShell>{children}</DashboardShell>
    </OrgReviewGate>
  );
}
