'use client';

import { Icons } from './icons';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  /** User-friendly message (from section-errors.ts describeError). */
  message: string | null;
  /** Called when the user clicks "Try again". */
  onRetry?: () => void;
  /** 'banner' sits inline above content; 'block' replaces the content area. */
  variant?: 'banner' | 'block';
  /** Extra callback for inline sections (e.g. re-run matching before fetching). */
  secondaryAction?: { label: string; onClick: () => void };
  className?: string;
}

/**
 * Consistent, calm error surface for failed data loads. Rendered by every
 * portal page so a network/rate-limit failure is never mistaken for an
 * empty dataset.
 */
export function ErrorState({ message, onRetry, variant = 'banner', secondaryAction, className }: ErrorStateProps) {
  if (!message) return null;

  const retryButton = onRetry && (
    <button
      onClick={onRetry}
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-none border border-rose-200 bg-white px-3 text-[11px] font-bold text-rose-700 transition-colors hover:bg-rose-50"
    >
      <Icons.refreshCw className="size-3" />
      Try again
    </button>
  );

  const secondary = secondaryAction && (
    <button
      onClick={secondaryAction.onClick}
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-none border border-rose-200 bg-white px-3 text-[11px] font-bold text-rose-700 transition-colors hover:bg-rose-50"
    >
      <Icons.zap className="size-3" />
      {secondaryAction.label}
    </button>
  );

  if (variant === 'block') {
    return (
      <div className={cn('flex flex-col items-center justify-center rounded-none border border-rose-200 bg-rose-50/60 px-6 py-10 text-center', className)}>
        <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-rose-100 bg-white">
          <Icons.alertTriangle className="size-5 text-rose-500" />
        </div>
        <h3 className="mb-1 text-sm font-bold text-rose-900">Couldn&apos;t load this section</h3>
        <p className="mx-auto mb-4 max-w-sm text-xs leading-relaxed text-rose-700/80">{message}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {retryButton}
          {secondary}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-3 rounded-none border border-rose-200 bg-rose-50/60 px-4 py-2.5', className)}>
      <Icons.alertTriangle className="size-4 shrink-0 text-rose-500" />
      <p className="min-w-0 flex-1 text-xs font-semibold leading-relaxed text-rose-900">{message}</p>
      <div className="flex items-center gap-2">
        {secondary}
        {retryButton}
      </div>
    </div>
  );
}
