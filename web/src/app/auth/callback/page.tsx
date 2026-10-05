'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Icons } from '@/components/ui/icons';
import LeafLoader from '@/components/ui/electric-loader';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Parse the hash fragment — Supabase puts tokens here in implicit flow
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    const error_description = params.get('error_description');
    const type = params.get('type'); // 'signup' for email verification

    if (error_description) {
      setErrorMsg(error_description);
      setStatus('error');
      return;
    }

    if (!access_token || !refresh_token) {
      setErrorMsg('Invalid or missing tokens in the link.');
      setStatus('error');
      return;
    }

    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) {
        setErrorMsg(error.message);
        setStatus('error');
        return;
      }
      // Hard redirect so the browser sends the new session cookies on the next request
      window.location.href = '/login?verified=1';
    });
  }, [router]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-slate-50">
        <div className="p-6 bg-white rounded-none border border-red-100 shadow-lg max-w-md w-full text-center space-y-4">
          <Icons.alertTriangle className="size-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Verification Failed</h2>
          <p className="text-sm text-slate-500">{errorMsg}</p>
          <a href="/login" className="block mt-4 text-sm font-bold text-green-700 hover:underline">
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
      <LeafLoader size={80} />
      <p className="text-sm font-medium text-slate-500">Verifying your email...</p>
    </div>
  );
}
