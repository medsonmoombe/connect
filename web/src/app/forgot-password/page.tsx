'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';

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
      const data = await res.json();

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

  // Success state
  if (sent) {
    return (
      <div className="min-h-screen bg-mesh flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-[480px] z-10 text-center">
          <div className="premium-card p-10">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
              <Icons.check className="w-8 h-8 text-green-700" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-3">Check your email</h1>
            <p className="text-slate-500">
              If an account exists with <strong>{email}</strong>, we&apos;ve sent a password reset link.
            </p>
          </div>
          <p className="mt-8 text-sm text-slate-500">
            <Link href="/login" className="text-green-700 font-bold hover:underline">Back to login</Link>
          </p>
        </div>
      </div>
    );
  }

  // Request form
  return (
    <div className="min-h-screen bg-mesh flex flex-col items-center justify-center p-6">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-100/40 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-green-100/20 rounded-full blur-[120px] -z-10 -translate-x-1/2 translate-y-1/2" />

      <div className="w-full max-w-[480px] z-10">
        <div className="flex justify-center mb-12">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center text-green-800">
              <Icons.logo className="w-full h-full" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              Afri <span className="text-green-700">Connect</span>
            </span>
          </Link>
        </div>
        <div className="premium-card p-10">
          <h1 className="text-2xl font-bold text-slate-900 mb-3 text-center">Reset Password</h1>
          <p className="text-slate-500 text-center mb-8">Enter your email and we&apos;ll send you a reset link.</p>
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}
          <form onSubmit={handleRequestReset} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              className="w-full h-9 px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium text-sm"
            />
            <Button type="submit" disabled={isLoading} className="w-full h-10 bg-green-800 hover:bg-green-700 text-white rounded-xl shadow-lg font-bold text-sm">
              {isLoading ? <Icons.spinner className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
            </Button>
          </form>
        </div>
        <p className="mt-8 text-center text-sm text-slate-500">
          <Link href="/login" className="text-green-700 font-bold hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
