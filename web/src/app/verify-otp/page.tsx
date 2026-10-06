'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { AuthSplitShell } from '@/components/auth/AuthSplitShell';
import { MfaVerification } from '@/components/auth/MfaVerification';
import LeafLoader from '@/components/ui/electric-loader';

interface MfaUser {
  is_platform_admin?: boolean;
  is_authority_user?: boolean;
  org_member_role?: string | null;
  role?: string | null;
  org_mfa_enforced?: boolean;
  mfa_enabled?: boolean;
}

function checkMfaRequired(user: MfaUser | null | undefined): boolean {
  if (!user) return false;
  if (process.env.NEXT_PUBLIC_DISABLE_MFA === 'true') return false;
  if (user.is_platform_admin) return true;
  if (user.is_authority_user) return true;
  if (user.org_member_role === 'OWNER') return true;
  if (user.org_member_role === 'ADMIN') return true;
  if (user.role === 'ADMIN') return true;
  if (user.org_mfa_enforced) return true;
  if (user.mfa_enabled) return true;
  return false;
}

export default function VerifyOtpPage() {
  const { user, loading, mfa_verified, setMfaVerified, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Where to send the user after a successful verification — the page they
  // were on (passed by the admin/authority layouts), else the dashboard.
  const nextPath = searchParams.get('next');
  const safeNext =
    nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//')
      ? nextPath
      : '/dashboard';

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!checkMfaRequired(user)) {
      router.replace(safeNext);
      return;
    }
    if (mfa_verified) router.replace(safeNext);
  }, [user, loading, mfa_verified, router, safeNext]);

  const shouldRedirect = loading || !user || !checkMfaRequired(user) || mfa_verified;
  if (shouldRedirect) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <LeafLoader size={80} />
      </div>
    );
  }

  return (
    <AuthSplitShell
      eyebrow="Session protection"
      title="Confirm access"
      description="Sensitive dashboards use an extra verification step before opening your workspace."
      points={['One-time email code', 'Protected company workspace', 'Admin-grade session control']}
      footerLink={{ text: 'Signed in with the wrong account?', href: '/login', label: 'Return to login' }}
    >
      <MfaVerification
        email={user.email}
        onVerified={() => {
          setMfaVerified(true);
          // Full navigation so the freshly-set MFA cookie is picked up
          // server-side by the middleware on the next page load.
          window.location.href = safeNext;
        }}
        onSignOut={() => signOut()}
      />
    </AuthSplitShell>
  );
}
