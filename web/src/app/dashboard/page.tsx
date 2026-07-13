'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';
import LeafLoader from '@/components/ui/electric-loader';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else {
        if (!user.company_id && !user.is_platform_admin) {
          router.push('/onboarding');
          return;
        }
        console.log("CURRENT USER ROLE ::", user?.role);
        switch (user.role) {
          case 'DEVELOPER':         router.push('/dashboard/developer'); break;
          case 'CAPITAL_PARTNER':   router.push('/dashboard/investor'); break;
          case 'TECHNICAL_PARTNER': router.push('/dashboard/technical'); break;
          case 'POWER_TRADER':      router.push('/dashboard/trader'); break;
          case 'GRANT_PROVIDER':    router.push('/dashboard/grant'); break;
          case 'ADMIN':             router.push('/dashboard/admin'); break;
          default:                  router.push('/dashboard/developer');
        }
      }
    }
  }, [user, loading, router]);



  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <LeafLoader size={100} />
        <p className="text-sm font-medium text-muted-foreground">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}

