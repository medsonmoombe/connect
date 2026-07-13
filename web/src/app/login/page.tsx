'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { useAuth } from '@/hooks/useAuth';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const searchParams = useSearchParams();
  const notice = searchParams.get('notice');
  const verified = searchParams.get('verified');
  const authError = searchParams.get('error');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      window.location.href = '/dashboard';
    } catch (err: any) {
      const msg = err.message || 'Invalid email or password.';
      setError(
        msg.includes('rate') || msg.includes('429') || msg.includes('Too many')
          ? 'Too many attempts. Please wait a few minutes.'
          : msg
      );
    } finally {
      setIsLoading(false);
    }
  };

  const banner = error
    ? { icon: 'alertTriangle' as const, color: 'red' as const, text: error, animate: true }
    : verified === '1'
    ? { icon: 'shieldCheck' as const, color: 'green' as const, text: 'Email verified! You can now sign in.' }
    : authError
    ? { icon: 'alertTriangle' as const, color: 'red' as const, text: 'Verification link invalid or expired.' }
    : notice === 'verify-email'
    ? { icon: 'mail' as const, color: 'blue' as const, text: 'Check your email for a verification link.' }
    : notice === 'invite-success'
    ? { icon: 'check' as const, color: 'green' as const, text: 'Account created! You can now sign in.' }
    : notice === 'password-reset'
    ? { icon: 'check' as const, color: 'green' as const, text: 'Password updated. Sign in below.' }
    : notice === 'suspended'
    ? { icon: 'alertTriangle' as const, color: 'red' as const, text: 'Your account has been deactivated. Please contact support.' }
    : notice === 'org-deactivated'
    ? { icon: 'alertTriangle' as const, color: 'red' as const, text: 'Your organisation has been deactivated. Please contact your administrator.' }
    : null;

  const bannerStyles = {
    green: 'bg-green-50 border-green-100 text-green-700',
    red: 'bg-red-50 border-red-100 text-red-600',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col items-center justify-center bg-slate-50">

      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-green-800 via-green-500 to-green-800" />

      <div className="w-full max-w-[400px] px-4">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 rounded-xl bg-green-800 flex items-center justify-center shadow-md shadow-green-900/20 mb-3">
            <Icons.logo className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">
            Afri <span className="text-green-700">Connect</span>
          </span>
          <span className="text-xs text-slate-400 mt-0.5">Partner Portal</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-100 p-7">

          <h1 className="text-lg font-bold text-slate-900 mb-1">Sign in</h1>
          <p className="text-sm text-slate-500 mb-5">Access your energy infrastructure dashboard</p>

          {/* Single banner slot */}
          {banner && (
            <div className={`mb-4 p-3 rounded-xl border flex items-start gap-2.5 text-xs font-medium ${bannerStyles[banner.color]} ${banner.animate ? 'animate-in fade-in slide-in-from-top-2' : ''}`}>
              {(() => { const Icon = Icons[banner.icon]; return <Icon className="size-3.5 shrink-0 mt-0.5" />; })()}
              <p>{banner.text}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Email
              </label>
              <input
                id="email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com" required
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Password
                </label>
                <Link href="/forgot-password" className="text-[11px] font-semibold text-green-700 hover:text-green-600 transition-colors">
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password" type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full h-11 px-4 pr-11 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 focus:bg-white transition-all"
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPassword ? <Icons.eyeOff className="w-4 h-4" /> : <Icons.eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={isLoading}
              className="w-full h-11 bg-green-800 hover:bg-green-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm shadow-md shadow-green-900/20 flex items-center justify-center gap-2 transition-all">
              {isLoading
                ? <Icons.spinner className="w-4 h-4 animate-spin" />
                : <><span>Sign In</span><Icons.arrowRight className="w-4 h-4" /></>}
            </Button>
          </form>

          {/* <p className="text-sm text-slate-500 text-center mt-5">
            No account?{' '}
            <Link href="/signup" className="font-semibold text-green-700 hover:text-green-600 hover:underline underline-offset-4 transition-colors">
              Register your firm
            </Link>
          </p> */}
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-5">
          © 2026 Energy Capital Match &nbsp;·&nbsp; AES-256 Encrypted
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
