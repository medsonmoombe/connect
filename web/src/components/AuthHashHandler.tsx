'use client';

import { useEffect } from 'react';

export function AuthHashHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      // Use window.location.href to preserve the hash — router.replace strips it
      window.location.href = '/auth/callback' + hash;
    }
  }, []);

  return null;
}
