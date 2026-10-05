'use client';

import { useEffect } from 'react';
import { APP_NAME } from '@/lib/branding';

/**
 * Sets the browser tab / document title for client-component pages, e.g.
 * `PageTitle title="My Projects"` renders "My Projects | AfriConnect".
 *
 * Server Components should use the Metadata API (`export const metadata`)
 * instead, which resolves server-side before render.
 */
export default function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} | ${APP_NAME}`;
    return () => {
      document.title = APP_NAME;
    };
  }, [title]);
  return null;
}
