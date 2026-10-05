'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { AuthSplitShell } from '@/components/auth/AuthSplitShell';

const inputClass = 'h-11 w-full rounded-none border border-slate-300 bg-white px-3 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/15';
const labelClass = 'text-[11px] font-semibold uppercase tracking-widest text-slate-500';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const pwErrors: string[] = [];
    if (password.length < 8) pwErrors.push('at least 8 characters');
    if (!/[A-Z]/.test(password)) pwErrors.push('an uppercase letter');
    if (!/[a-z]/.test(password)) pwErrors.push('a lowercase letter');
    if (!/[0-9]/.test(password)) pwErrors.push('a number');
    if (!/[^A-Za-z0-9]/.test(password)) pwErrors.push('a special character');
    if (pwErrors.length > 0) {
      setError('Password must contain ' + pwErrors.join(', '));
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'This reset link is invalid or has expired.');
        return;
      }
      window.location.href = '/login?notice=password-reset';
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthSplitShell
      eyebrow="Account recovery"
      title="Set a secure password"
      description="Create a fresh password for your Afri Connect account and continue with protected access."
      points={['Password policy checks', 'Secure reset token', 'Protected sign-in flow']}
      footerLink={{ text: 'Need another link?', href: '/forgot-password', label: 'Request reset' }}
    >
      <div className="p-6 md:p-8">
        {!token ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center border border-red-100 bg-red-50 text-red-600">
              <Icons.x className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Invalid reset link</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">This password reset link is invalid or missing a token.</p>
            </div>
            <Link href="/forgot-password" className="inline-flex h-10 items-center justify-center rounded-none bg-green-800 px-4 text-sm font-semibold text-white hover:bg-green-700">Request a New Link</Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Set new password</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">Choose a strong password for your Afri Connect account.</p>
            </div>
            {error && <div className="border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-600">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className={labelClass}>New Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 characters" required minLength={8} className={`${inputClass} pr-10`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                    {showPassword ? <Icons.eyeOff className="size-4" /> : <Icons.eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Confirm Password</label>
                <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" required minLength={8} className={inputClass} />
              </div>
              <Button type="submit" disabled={isLoading} className="h-11 w-full rounded-none bg-green-800 text-sm font-semibold text-white shadow-none hover:bg-green-700">
                {isLoading ? <Icons.spinner className="size-4 animate-spin" /> : 'Reset Password'}
              </Button>
            </form>
            <p className="text-center text-sm text-slate-500"><Link href="/login" className="font-semibold text-green-700 hover:underline">Back to login</Link></p>
          </div>
        )}
      </div>
    </AuthSplitShell>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm /></Suspense>;
}
