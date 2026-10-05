'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSkeleton } from '@/components/ui/skeleton';

/**
 * Former per-portal Messages page - merged into the shared Engagements hub
 * (/engagements?view=messages). Keeps old links and notifications working.
 */
export default function TraderMessagesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/engagements?view=messages');
  }, [router]);

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <DashboardSkeleton />
    </div>
  );
}
