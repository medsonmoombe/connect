'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="min-h-screen bg-mesh flex flex-col items-center justify-center p-6">
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
          <div className="premium-card p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
              <Icons.x className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-3">Invalid Reset Link</h1>
            <p className="text-slate-500 mb-8">This password reset link is invalid or missing a token.</p>
            <Link href="/forgot-password" className="inline-flex items-center justify-center h-10 px-6 rounded-xl bg-green-800 hover:bg-green-700 text-white font-bold text-sm shadow-lg transition-colors">
              Request a New Link
            </Link>
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">
            <Link href="/login" className="text-green-700 font-bold hover:underline">Back to login</Link>
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
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
          <h1 className="text-2xl font-bold text-slate-900 mb-3 text-center">Set New Password</h1>
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                required
                minLength={8}
                className="w-full h-9 px-4 pr-10 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <Icons.eyeOff className="w-4 h-4" /> : <Icons.eye className="w-4 h-4" />}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              minLength={8}
              className="w-full h-9 px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium text-sm"
            />
            <Button type="submit" disabled={isLoading} className="w-full h-10 bg-green-800 hover:bg-green-700 text-white rounded-xl shadow-lg font-bold text-sm">
              {isLoading ? <Icons.spinner className="w-4 h-4 animate-spin" /> : 'Reset Password'}
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
