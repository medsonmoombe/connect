'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';

export default function DashboardGlobalLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // router.push('/login');
      } else {
        // Global Onboarding Check
        // Admins are exempt from the company profile requirement for initial access
        if (!user.company_id && user.role !== 'ADMIN' && !pathname.includes('/onboarding')) {
          router.push('/onboarding');
        }
      }
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
