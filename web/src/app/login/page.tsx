'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { useAuth } from '@/hooks/useAuth';
import PageTitle from '@/components/PageTitle';
import { AuthSplitShell } from '@/components/auth/AuthSplitShell';

function checkMfaRequired(user: { is_platform_admin?: boolean; is_authority_user?: boolean; org_member_role?: 'OWNER' | 'ADMIN' | 'MEMBER' | null; role?: string; org_mfa_enforced?: boolean; mfa_enabled?: boolean } | null | undefined): boolean {
  if (!user) return false;
  if (process.env.NEXT_PUBLIC_DISABLE_MFA === 'true') return false;
  if (user.is_platform_admin) return true;
  if (user.is_authority_user) return true;
  if (user.org_member_role === 'OWNER') return true;
  if (user.org_member_role === 'ADMIN') return true;
  if (user.role === 'ADMIN') return true;
  if (user.org_mfa_enforced) return true;
  if (user.mfa_enabled) return true;
  return false;
}

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
      const builtUser = await signIn(email, password);
      const disableMfa = process.env.NEXT_PUBLIC_DISABLE_MFA === 'true';
      window.location.href = builtUser && !disableMfa && checkMfaRequired(builtUser) ? '/verify-otp' : '/dashboard';
    } catch (err: unknown) {
      const authErr = err as { code?: string; lockedUntil?: string; attemptsRemaining?: number; message?: string };
      if (authErr.code === 'ACCOUNT_LOCKED') {
        setError(authErr.lockedUntil ? `Account locked until ${new Date(authErr.lockedUntil).toLocaleTimeString()}. Please contact support.` : 'Account temporarily locked due to too many failed attempts.');
      } else if (authErr.attemptsRemaining !== undefined && authErr.attemptsRemaining !== null) {
        setError(`Invalid credentials. ${authErr.attemptsRemaining} attempt${authErr.attemptsRemaining !== 1 ? 's' : ''} remaining before lockout.`);
      } else {
        const msg = authErr.message || 'Invalid email or password.';
        setError(msg.includes('rate') || msg.includes('429') || msg.includes('Too many') ? 'Too many attempts. Please wait a few minutes.' : msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const banner = error
    ? { icon: 'alertTriangle' as const, color: 'red' as const, text: error }
    : verified === '1'
      ? { icon: 'shieldCheck' as const, color: 'green' as const, text: 'Email verified â€” you can now sign in.' }
      : authError
        ? { icon: 'alertTriangle' as const, color: 'red' as const, text: 'Verification link invalid or expired.' }
        : notice === 'verify-email'
          ? { icon: 'mail' as const, color: 'blue' as const, text: 'Check your email for a verification link.' }
          : notice === 'invite-success'
            ? { icon: 'check' as const, color: 'green' as const, text: 'Account created â€” sign in below.' }
            : notice === 'password-reset'
              ? { icon: 'check' as const, color: 'green' as const, text: 'Password updated. Sign in below.' }
              : notice === 'suspended'
                ? { icon: 'alertTriangle' as const, color: 'red' as const, text: 'Your account has been deactivated. Contact support.' }
                : notice === 'org-deactivated'
                  ? { icon: 'alertTriangle' as const, color: 'red' as const, text: 'Your organisation has been deactivated. Contact your administrator.' }
                  : notice === 'locked'
                    ? { icon: 'lock' as const, color: 'red' as const, text: 'Account temporarily locked. Contact support.' }
                    : notice === 'session_expired'
                      ? { icon: 'clock' as const, color: 'yellow' as const, text: 'Your session expired. Please sign in again.' }
                      : null;

  const bannerStyles = {
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-600',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    yellow: 'bg-amber-50 border-amber-200 text-amber-700',
  };

  return (
    <AuthSplitShell
      eyebrow="Secure access"
      title="Welcome back"
      description="Sign in to manage your firm profile, projects, matches, messages, and verification workflow."
      points={['Secure account access', 'Verified project workspace', 'Matching dashboard']}
      footerLink={{ text: 'New to the platform?', href: '/register', label: 'Register your firm' }}
    >
      <div className="p-8 md:p-10 h-full flex flex-col justify-center">
        {/* Heading */}
        <div className="mb-8">

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-1.5 text-sm text-slate-400 font-normal">Access your energy infrastructure dashboard.</p>
        </div>

        {/* Banner */}
        {banner && (
          <div className={`mb-6 border px-4 py-3 text-xs font-medium ${bannerStyles[banner.color]}`}>
            <div className="flex items-start gap-2.5">
              {(() => { const Icon = Icons[banner.icon]; return <Icon className="mt-0.5 size-3.5 shrink-0" />; })()}
              <p>{banner.text}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              className="h-11 w-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-300 transition-colors duration-150 focus:border-[#052e1a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e1a]/8 rounded-none"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Password
              </label>
              <Link href="/forgot-password" className="text-[11px] font-semibold text-green-700 hover:text-green-600 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="h-11 w-full border border-slate-200 bg-slate-50 px-4 pr-11 text-sm text-slate-900 placeholder:text-slate-300 transition-colors duration-150 focus:border-[#052e1a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e1a]/8 rounded-none"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
              >
                {showPassword ? <Icons.eyeOff className="size-4" /> : <Icons.eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 bg-[#052e1a] hover:bg-green-800 text-white text-sm font-semibold rounded-none shadow-none transition-colors duration-200"
          >
            {isLoading
              ? <Icons.spinner className="size-4 animate-spin" />
              : <><span>Sign In</span><Icons.arrowRight className="ml-2 size-4" /></>
            }
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 text-center leading-relaxed">
            Protected by enterprise-grade encryption and KYC/KYB verification.
          </p>
        </div>
      </div>
    </AuthSplitShell>
  );
}

export default function LoginPage() {
  return <Suspense><PageTitle title="Sign In" /><LoginForm /></Suspense>;
}
