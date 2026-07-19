'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';
import LeafLoader from '@/components/ui/electric-loader';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';

  useEffect(() => {
    if (!loading && user) {
      // Allow users with an org to access onboarding in edit mode
      if (user.company_id && !isEditMode) {
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

  // Redirecting (but not in edit mode)
  if ((user.company_id || user.role === 'ADMIN') && !isEditMode) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <header className="border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#166534] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">ECM</span>
            </div>
            <span className="font-bold text-slate-900">Energy Capital Match</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-500 font-medium">
              Onboarding: <span className="text-slate-900">{user.email}</span>
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-2xl">
          {children}
        </div>
      </main>
      
      <footer className="py-6 border-t bg-white/50 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-slate-400">
          &copy; {new Date().getFullYear()} Energy Capital Match. Professional Infrastructure Intelligence.
        </div>
      </footer>
    </div>
  );
}
