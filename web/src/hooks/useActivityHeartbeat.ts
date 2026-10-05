'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';

const HEARTBEAT_INTERVAL_MS = 60_000; // 1 minute

/**
 * Posts to /api/activity/heartbeat at a fixed interval to update
 * the user's `last_active_at` timestamp, used for presence indicators.
 */
export function useActivityHeartbeat() {
  const { user } = useAuth();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;

    const beat = () => {
      fetch('/api/activity/heartbeat', { method: 'POST' }).catch(() => {});
    };

    // Fire immediately on mount
    beat();

    timerRef.current = setInterval(beat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user]);
}
