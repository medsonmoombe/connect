'use client';

import { useState, FormEvent, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { AuthSplitShell } from '@/components/auth/AuthSplitShell';
import { Icons } from '@/components/ui/icons';

const inputClass = 'h-11 w-full rounded-none border border-slate-300 bg-white px-3 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/15 disabled:bg-slate-50 disabled:text-slate-500';
const labelClass = 'text-[11px] font-semibold uppercase tracking-widest text-slate-500';

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
    const tokenFromUrl = inviteToken || window.location.search.match(/[?&]token(?:%3D|=)([^&]+)/)?.[1];
    if (!tokenFromUrl) {
      setTokenValid(false);
      setTokenChecking(false);
      return;
    }

    const token = decodeURIComponent(tokenFromUrl);
    setResolvedToken(token);
    fetch(`/api/auth/verify-invite?token=${token}`)
      .then(r => r.json())
      .then(data => {
        setTokenValid(data.valid);
        if (data.email) setEmail(data.email);
      })
      .catch(() => setTokenValid(false))
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  if (tokenChecking) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Icons.spinner className="size-6 animate-spin text-green-700" />
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <AuthSplitShell
        eyebrow="Invite access"
        title="Join a verified workspace"
        description="Team accounts are created from secure invitations issued by an organisation admin."
        points={['Invite-only access', 'Verified organisation membership', 'Protected company data']}
        footerLink={{ text: 'Already have an account?', href: '/login', label: 'Login' }}
      >
        <div className="p-6 text-center md:p-8">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center border border-red-100 bg-red-50 text-red-500">
            <Icons.alertTriangle className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Invalid or expired invite</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
            This invite link is invalid or has already been used. Contact your administrator for a new invite.
          </p>
          <Link href="/login" className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-none bg-green-800 text-sm font-semibold text-white transition-colors hover:bg-green-700">
            Back to Login
          </Link>
        </div>
      </AuthSplitShell>
    );
  }

  return (
    <AuthSplitShell
      eyebrow="Invite verified"
      title="Create your account"
      description="Complete your profile to join your organisation on Afri Connect."
      points={['Verified team invitation', 'Secure workspace access', 'Shared company deal room']}
      footerLink={{ text: 'Already registered?', href: '/login', label: 'Login' }}
    >
      <div className="p-6 md:p-8">
        <div className="mb-6">
          <div className="mb-2 inline-flex items-center gap-1.5 border border-green-100 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
            <Icons.check className="size-2.5" /> Invite verified
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Create Account</h1>
          <p className="mt-1 text-sm text-slate-500">Join your organisation on the platform.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="fullName" className={labelClass}>Full Name</label>
            <input id="fullName" type="text" placeholder="Jane Doe" value={fullName} onChange={e => setFullName(e.target.value)} required disabled={isLoading} className={inputClass} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className={labelClass}>Work Email</label>
            <input id="email" type="email" placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={isLoading} className={inputClass} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className={labelClass}>Password</label>
            <div className="relative">
              <input id="password" type={showPassword ? 'text' : 'password'} placeholder="Minimum 8 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} disabled={isLoading} className={`${inputClass} pr-10`} />
              <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600">
                {showPassword ? <Icons.eyeOff className="size-4" /> : <Icons.eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-600">
              <Icons.alertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <button type="submit" disabled={isLoading} className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-none bg-green-800 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60">
            {isLoading ? <Icons.spinner className="size-4 animate-spin" /> : 'Create Account'}
          </button>
        </form>
      </div>
    </AuthSplitShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
