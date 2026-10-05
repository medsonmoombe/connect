'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardSkeleton } from '@/components/ui/skeleton';

/**
 * Former Matches page — merged into the Marketplace (which now carries the
 * score-band filters and best-fit-first ordering). Keeps old links working.
 */
export default function ConsultantMatchesRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    const band = searchParams.get('band');
    if (band) params.set('band', band);
    const qs = params.toString();
    router.replace(`/consultant/marketplace${qs ? `?${qs}` : ''}`);
  }, [router, searchParams]);

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <DashboardSkeleton />
    </div>
  );
}
