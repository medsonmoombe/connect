'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PortalShell } from '@/components/dashboard/PortalShell';

const PORTAL_PREFIXES = [
  '/developer', '/admin', '/investor', '/consultant', '/trader',
  '/grant', '/technical', '/engagements', '/inbound', '/profile',
  '/settings', '/audit-logs', '/verification',
];

export function PortalLayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPortal = PORTAL_PREFIXES.some(p => pathname.startsWith(p));

  if (isPortal) {
    return <PortalShell>{children}</PortalShell>;
  }

  return <>{children}</>;
}
