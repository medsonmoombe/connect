'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { AuthSplitShell } from '@/components/auth/AuthSplitShell';

const inputClass = 'h-11 w-full rounded-none border border-slate-300 bg-white px-3 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/15';
const labelClass = 'text-[11px] font-semibold uppercase tracking-widest text-slate-500';

function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      await res.json();
      if (!res.ok) {
        setError('Something went wrong. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthSplitShell
      eyebrow="Account recovery"
      title="Recover your account"
      description="Reset access securely and return to your company workspace without involving support."
      points={['Encrypted reset link', 'Work email verification', 'Session-safe recovery']}
      footerLink={{ text: 'Remembered your password?', href: '/login', label: 'Back to login' }}
    >
      <div className="p-6 md:p-8">
        {sent ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center border border-green-100 bg-green-50 text-green-800">
              <Icons.check className="size-6" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Reset link sent</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Check your email</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">If an account exists with <strong>{email}</strong>, we sent a password reset link.</p>
            </div>
            <Link href="/login" className="inline-flex h-10 items-center justify-center rounded-none border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Back to login</Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
      
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Reset password</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">Enter your work email and we will send a reset link.</p>
            </div>
            {error && <Notice message={error} />}
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Work Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" required className={inputClass} />
              </div>
              <Button type="submit" disabled={isLoading} className="h-11 w-full rounded-none bg-green-800 text-sm font-semibold text-white shadow-none hover:bg-green-700">
                {isLoading ? <Icons.spinner className="size-4 animate-spin" /> : 'Send Reset Link'}
              </Button>
            </form>
          </div>
        )}
      </div>
    </AuthSplitShell>
  );
}

function Notice({ message }: { message: string }) {
  return <div className="border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-600">{message}</div>;
}

export default function ForgotPasswordPage() {
  return <Suspense><ForgotPasswordForm /></Suspense>;
}
