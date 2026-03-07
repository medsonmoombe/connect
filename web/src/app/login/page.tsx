'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      await signIn(email, password);
      // Redirect to the main dashboard logic which handles role-based routing
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mesh flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Texture Overlay */}
      <div className="fixed inset-0 texture-overlay opacity-[0.03] pointer-events-none z-[100]"></div>
      
      {/* Abstract Background Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-100/40 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-green-100/20 rounded-full blur-[120px] -z-10 -translate-x-1/2 translate-y-1/2"></div>

      <div className="w-full max-w-[480px] z-10">
        <div className="flex justify-center mb-12">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 flex items-center justify-center group-hover:scale-105 transition-transform text-green-800">
              <Icons.logo className="w-full h-full" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              Afri <span className="text-green-700">Connect</span>
            </span>
          </Link>
        </div>

        <div className="premium-card p-10 md:p-12">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold text-slate-900 mb-3">Partner Portal</h1>
            <p className="text-slate-500 font-medium">Access your energy infrastructure projects and capital matching dashboard.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 text-sm font-medium animate-in fade-in slide-in-from-top-2">
              <Icons.alertTriangle className="size-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full h-14 px-5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest" htmlFor="password">
                  Password
                </label>
                <Link href="#" className="text-[11px] font-bold text-green-700 uppercase tracking-widest hover:text-green-600">
                  Forgot?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full h-14 px-5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-16 bg-green-800 hover:bg-green-700 text-white rounded-2xl shadow-xl shadow-green-900/20 flex gap-3 text-base font-bold"
            >
              {isLoading ? (
                <Icons.spinner className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign In to Dashboard
                  <Icons.arrowRight className="w-5 h-5" />
                </>
              )}
            </Button>
          </form>

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-100"></span>
            </div>
            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              <span className="bg-white px-4">Institutional SSO</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-14 rounded-2xl border-slate-200 text-slate-600 font-bold hover:bg-slate-50 flex gap-3"
          >
            <Icons.google className="w-5 h-5" />
            Continue with Google
          </Button>
        </div>

        <p className="mt-10 text-center text-sm font-medium text-slate-500">
          Don't have an account?{' '}
          <Link href="/signup" className="text-green-700 font-bold hover:underline underline-offset-4">
            Register your firm
          </Link>
        </p>
      </div>

      <footer className="mt-12 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        © 2026 Energy Capital Match • Secured by AES-256
      </footer>
    </div>
  );
}
