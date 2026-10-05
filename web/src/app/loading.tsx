import { DashboardSkeleton } from '@/components/ui/skeleton';

/**
 * Instant per-segment loading skeleton while a route's code/data streams in,
 * so route changes never flash an empty browser page.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <DashboardSkeleton />
    </div>
  );
}
