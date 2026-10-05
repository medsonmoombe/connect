'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import LeafLoader from '@/components/ui/electric-loader';

export default function DashboardRedirectPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else {
        switch (user.role) {
          case 'DEVELOPER':         router.replace('/developer'); break;
          case 'CAPITAL_PARTNER':   router.replace('/investor'); break;
          case 'TECHNICAL_PARTNER': router.replace('/technical'); break;
          case 'CONSULTANT':        router.replace('/consultant'); break;
          case 'POWER_TRADER':      router.replace('/trader'); break;
          case 'GRANT_PROVIDER':    router.replace('/grant'); break;
          case 'ADMIN':             router.replace('/admin'); break;
          case 'AUTHORITY_ADMIN':   router.replace('/authority/projects'); break;
          case 'AUTHORITY_REVIEWER': router.replace('/authority/projects'); break;
          case 'AUTHORITY_VIEWER':  router.replace('/authority/projects'); break;
          default:                  router.replace('/developer');
        }
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <LeafLoader size={100} />
        <p className="text-sm font-medium text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
