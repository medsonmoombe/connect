'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Icons } from '@/components/ui/icons';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.company_id && user.role !== 'ADMIN') {
        // If they already have a company, send them to dashboard
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f8fafc]">
        <Icons.spinner className="h-8 w-8 animate-spin text-[#166534]" />
      </div>
    );
  }

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
