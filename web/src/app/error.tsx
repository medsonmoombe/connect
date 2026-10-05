'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';

/**
 * Route-level error boundary. Catches render/runtime errors in any page below
 * src/app (e.g. "Cannot read properties of undefined") and shows a graceful,
 * branded recovery screen instead of the raw dev-overlay crash.
 *
 * Kept intentionally self-contained (no Zustand/React Query) so it renders
 * even when app providers are the thing that crashed.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV === 'development';
  const [details, setDetails] = useState(false);

  useEffect(() => {
    // Surface for diagnostics; wire to Sentry/equivalent here when adopted.
    console.error('[RouteError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md border border-slate-200 bg-white px-8 py-10 text-center shadow-[0_12px_32px_-8px_rgba(22,36,28,0.18)]">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-rose-100 bg-rose-50">
          <Icons.alertTriangle className="size-6 text-rose-500" />
        </div>

        <h1 className="mb-2 text-lg font-bold tracking-tight text-slate-900">
          Something went wrong
        </h1>
        <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-slate-500">
          This page hit an unexpected error. Your data is safe &mdash; retrying usually
          resolves it. If it keeps happening, contact support and include the code below.
        </p>

        {error.digest && (
          <p className="mb-6 inline-block border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-[11px] text-slate-500">
            Error code: {error.digest}
          </p>
        )}

        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} icon={<Icons.refreshCw className="size-3.5" />}>
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = '/dashboard';
            }}
          >
            Go to dashboard
          </Button>
        </div>

        {isDev && (
          <div className="mt-8 border-t border-dashed border-slate-200 pt-4 text-left">
            <button
              onClick={() => setDetails(d => !d)}
              className="text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600"
            >
              {details ? 'Hide' : 'Show'} developer details
            </button>
            {details && (
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap bg-slate-50 p-3 text-[11px] leading-relaxed text-rose-700">
                {error.message}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
