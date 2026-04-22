'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else {
        // Check for profile completeness (Onboarding)
        // Admins don't need to complete a company profile to access the dashboard
        if (!user.company_id && user.role !== 'ADMIN') {
          console.log('Redirecting to onboarding: Profile incomplete (missing company_id)');
          router.push('/onboarding');
          return;
        }

        // Redirect based on role
        switch (user.role) {
          case 'DEVELOPER':
            router.push('/dashboard/developer');
            break;
          case 'CAPITAL_PARTNER':
            router.push('/dashboard/investor');
            break;
          case 'TECHNICAL_PARTNER':
            router.push('/dashboard/technical');
            break;
          case 'ADMIN':
            router.push('/dashboard/admin');
            break;
          default:
            router.push('/login');
        }
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}
