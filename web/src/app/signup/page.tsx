'use client';

import { useState, FormEvent, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/icons';

function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenChecking, setTokenChecking] = useState(true);
  const [resolvedToken, setResolvedToken] = useState('');

  const { signUp } = useAuth();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('token') ?? '';

  useEffect(() => {
    if (!inviteToken) {
      const match = window.location.search.match(/[?&]token(?:%3D|=)([^&]+)/);
      if (!match) {
        setTokenValid(false);
        setTokenChecking(false);
        return;
      }
      const token = decodeURIComponent(match[1]);
      setResolvedToken(token);
      fetch(`/api/auth/verify-invite?token=${token}`)
        .then(r => r.json())
        .then(data => {
          setTokenValid(data.valid);
          if (data.email) setEmail(data.email);
        })
        .finally(() => setTokenChecking(false));
      return;
    }
    setResolvedToken(inviteToken);
    fetch(`/api/auth/verify-invite?token=${inviteToken}`)
      .then(r => r.json())
      .then(data => {
        setTokenValid(data.valid);
        if (data.email) setEmail(data.email);
      })
      .finally(() => setTokenChecking(false));
  }, [inviteToken]);

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (!tokenValid) return;
    setIsLoading(true);
    setError(null);
    try {
      await signUp(email, password, fullName, resolvedToken);
      window.location.href = '/login?notice=invite-success';
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  if (tokenChecking) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Icons.spinner className="size-6 animate-spin text-green-700" />
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="h-screen grid lg:grid-cols-2 overflow-hidden">
        {/* Visual Side */}
        <div className="relative hidden lg:flex flex-col bg-slate-950 p-16 text-white overflow-hidden">
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-green-800/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
          <div className="relative z-10 flex flex-col h-full">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-green-800 flex items-center justify-center shadow-md shadow-green-900/20">
                <Icons.logo className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-white">Afri <span className="text-green-400">Connect</span></span>
                <p className="text-[10px] text-slate-400 -mt-0.5">Partner Portal</p>
              </div>
            </Link>
            <div className="mt-auto max-w-lg space-y-6">
              <h2 className="text-5xl font-extrabold tracking-tight leading-[1.1]">Built for the next generation of Energy</h2>
              <p className="text-xl text-slate-300 leading-relaxed opacity-80">Verified partners, AI matching, and secure deal infrastructure for the energy transition.</p>
              <div className="space-y-4 pt-4">
                {['Verified Institutional Partners', 'AI-Powered Readiness Scoring', 'Secure Virtual Data Rooms'].map(t => (
                  <div key={t} className="flex items-center gap-3">
                    <div className="size-6 rounded-full bg-green-800/30 flex items-center justify-center">
                      <Icons.check className="size-3.5 text-green-400" />
                    </div>
                    <p className="text-sm font-bold uppercase tracking-widest text-slate-300">{t}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Error Side */}
        <div className="flex items-center justify-center bg-white">
          <div className="w-full max-w-[400px] px-8 text-center">
            <div className="w-14 h-14 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-5">
              <Icons.alertTriangle className="size-6 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid or Expired Invite</h1>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              This invite link is invalid or has already been used. Contact your administrator for a new invite.
            </p>
            <Link href="/login"
              className="inline-flex items-center justify-center w-full h-11 bg-green-800 hover:bg-green-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm shadow-md shadow-green-900/20 transition-all">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen grid lg:grid-cols-2 overflow-hidden font-sans">
      {/* Visual Side */}
      <div className="relative hidden lg:flex flex-col bg-slate-950 p-16 text-white overflow-hidden">
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-green-800/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10 flex flex-col h-full">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-green-800 flex items-center justify-center shadow-md shadow-green-900/20">
              <Icons.logo className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">Afri <span className="text-green-400">Connect</span></span>
              <p className="text-[10px] text-slate-400 -mt-0.5">Partner Portal</p>
            </div>
          </Link>
          <div className="mt-auto max-w-lg space-y-6">
            <h2 className="text-5xl font-extrabold tracking-tight leading-[1.1]">Built for the next generation of Energy</h2>
            <p className="text-xl text-slate-300 leading-relaxed opacity-80">Verified partners, AI matching, and secure deal infrastructure for the energy transition.</p>
            <div className="space-y-4 pt-4">
              {['Verified Institutional Partners', 'AI-Powered Readiness Scoring', 'Secure Virtual Data Rooms'].map(t => (
                <div key={t} className="flex items-center gap-3">
                  <div className="size-6 rounded-full bg-green-800/30 flex items-center justify-center">
                    <Icons.check className="size-3.5 text-green-400" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-widest text-slate-300">{t}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex items-center justify-center bg-white overflow-y-auto">
        <div className="w-full max-w-[400px] px-8">

          {/* Logo (mobile) */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="w-11 h-11 rounded-xl bg-green-800 flex items-center justify-center shadow-md shadow-green-900/20 mb-3">
              <Icons.logo className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              Afri <span className="text-green-700">Connect</span>
            </span>
            <span className="text-xs text-slate-400 mt-0.5">Partner Portal</span>
          </div>

          <div className="space-y-1 mb-6">
            <div className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200 mb-2">
              <Icons.check className="size-2.5" /> Invite verified
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-0.5">Create Account</h1>
            <p className="text-sm text-slate-500">Join your organisation on the platform</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                placeholder="Jane Doe"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                disabled={isLoading}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Work Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={isLoading}
                  className="w-full h-11 px-4 pr-11 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <Icons.eyeOff className="w-4 h-4" /> : <Icons.eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">Minimum 8 characters</p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2.5 text-xs font-medium text-red-600">
                <Icons.alertTriangle className="size-3.5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-green-800 hover:bg-green-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm shadow-md shadow-green-900/20 flex items-center justify-center gap-2 transition-all mt-1"
            >
              {isLoading
                ? <Icons.spinner className="w-4 h-4 animate-spin" />
                : <><span>Create Account</span><Icons.arrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-[10px] text-slate-400 mt-5">
            &copy; 2026 Energy Capital Match &nbsp;&middot;&nbsp; AES-256 Encrypted
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
