'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

const NAV_LINKS = [
  { href: '/#platform', label: 'Platform' },
  { href: '/#marketplace', label: 'Marketplace' },
  { href: '/#intelligence', label: 'Intelligence' },
];

export function PublicNavbar() {
  const pathname = usePathname();
  const isRegister = pathname === '/register';
  const { user, loading: authLoading, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut(); // POSTs /api/auth/logout then hard-redirects to /login
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-2xl border-b border-slate-200/50 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group cursor-pointer">
          <div className="w-9 h-9 flex items-center justify-center text-green-700 group-hover:scale-105 transition-transform duration-200">
            <Icons.logo className="w-full h-full" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900">
            Afri <span className="text-green-700 font-extrabold">Connect</span>
          </span>
        </Link>

        {/* Marketing links (desktop, anonymous visitors) */}
        {!user && !authLoading && (
          <div className="hidden md:flex items-center gap-8 text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em]">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-slate-900 transition-colors duration-150">
                {link.label}
              </Link>
            ))}
            <div className="h-3.5 w-px bg-slate-200" />
            <Link href="/login" className="hover:text-slate-900 transition-colors duration-150">
              Login
            </Link>
            {isRegister ? (
              <span className="inline-flex items-center h-8 bg-[#052e1a] px-6 text-[11px] font-semibold text-white tracking-normal">
                Get Started
              </span>
            ) : (
              <Link href="/register">
                <Button size="sm" className="bg-[#052e1a] hover:bg-green-800 text-white px-6 h-8 rounded-none text-[11px] font-semibold tracking-normal shadow-none transition-colors duration-200">
                  Get Started
                </Button>
              </Link>
            )}
          </div>
        )}

        {/* Signed-in but pre-dashboard (terms acceptance / onboarding): allow logout */}
        {user && !authLoading && (
          <div className="flex items-center gap-4">
            <span className="hidden md:inline text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em]">
              Setting up your account
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-2 h-9 px-4 border border-slate-200 bg-white text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Sign out of this account"
            >
              {signingOut ? (
                <Icons.spinner className="size-3.5 animate-spin" />
              ) : (
                <Icons.logOut className="size-3.5" />
              )}
              <span className="hidden sm:inline">{signingOut ? 'Signing out…' : 'Log out'}</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
