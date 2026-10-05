'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LeafLoader from '@/components/ui/electric-loader';

export default function AuthoritySettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings?tab=profile');
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center">
      <LeafLoader size={60} />
    </div>
  );
}
