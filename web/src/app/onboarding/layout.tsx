'use client';

import { ReactNode, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import LeafLoader from '@/components/ui/electric-loader';
import { PublicNavbar } from '@/components/marketing/PublicNavbar';
import { PublicFooter } from '@/components/marketing/PublicFooter';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-[#f8fafc]">
        <LeafLoader size={100} />
      </div>
    }>
      <OnboardingLayoutContent>{children}</OnboardingLayoutContent>
    </Suspense>
  );
}

function OnboardingLayoutContent({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';

  useEffect(() => {
    if (!loading && user) {
      // Only redirect away from onboarding if the user has actually completed it.
      // Invited users may already have a company_id but still need to finish
      // onboarding (profile, preferences), so we must not bounce them to /dashboard.
      if (user.onboarding_complete && !isEditMode) {
        router.replace('/dashboard');
      }
      // Admins don't need onboarding
      else if (user.role === 'ADMIN' && !isEditMode) {
        router.replace('/dashboard');
      }
    }
  }, [user, loading, router, isEditMode]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f8fafc]">
        <LeafLoader size={100} />
      </div>
    );
  }

  // Redirecting (but not in edit mode).
  // NOTE: a non-null company_id does NOT imply onboarding is done — invited users are
  // added to a company at signup while onboarding_complete is still false, so they must
  // still flow through onboarding (profile + preferences). Only blank the page for users
  // who have actually finished (onboarding_complete) or platform admins (role === 'ADMIN').
  // The redirect above already routes those two cases to /dashboard.
  if ((user.onboarding_complete || user.role === 'ADMIN') && !isEditMode) return null;

  return (
    <div className="h-full overflow-y-auto bg-slate-50 flex flex-col">
      <PublicNavbar />

      <main className="flex-1 px-4 pb-12 pt-28 md:px-6 md:pb-16">
        {children}
      </main>

      <PublicFooter />
    </div>
  );
}

