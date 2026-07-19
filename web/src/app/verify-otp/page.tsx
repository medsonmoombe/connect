'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { MfaVerification } from '@/components/auth/MfaVerification';
import LeafLoader from '@/components/ui/electric-loader';

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

export default function VerifyOtpPage() {
  const { user, loading, mfa_verified, setMfaVerified, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // No session — send to login
    if (!user) {
      router.replace('/login');
      return;
    }
    // MFA not required for this user — skip straight to dashboard
    if (!checkMfaRequired(user)) {
      router.replace('/dashboard');
      return;
    }
    // Already verified this session — skip to dashboard
    if (mfa_verified) {
      router.replace('/dashboard');
    }
  }, [user, loading, mfa_verified, router]);

  // Show loader while redirecting (covers all redirect conditions)
  const shouldRedirect = loading || !user || !checkMfaRequired(user) || mfa_verified;
  if (shouldRedirect) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <LeafLoader size={80} />
      </div>
    );
  }

  return (
    <MfaVerification
      email={user.email}
      onVerified={() => {
        setMfaVerified(true);
        window.location.href = '/dashboard';
      }}
      onSignOut={() => signOut()}
    />
  );
}
