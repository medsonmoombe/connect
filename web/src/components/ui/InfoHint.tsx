'use client';

import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

interface InfoHintProps {
  text: string;
  className?: string;
}

/**
 * Question-mark tooltip from the submission-wizard wireframe: a small "?"
 * circle that reveals a dark-green bubble below on hover / focus.
 */
export function InfoHint({ text, className }: InfoHintProps) {
  if (!text) return null;
  return (
    <span className={cn('group relative inline-flex align-middle', className)}>
      <span
        tabIndex={0}
        role="button"
        aria-label={text}
        className="size-4 grid place-items-center rounded-none text-[#A2B1A6] hover:text-g-700 cursor-help outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-g-600"
      >
        <Icons.info className="size-3.5" />
      </span>
      <span className="pointer-events-none absolute top-full left-[-8px] mt-[7px] z-[60] w-60 bg-[#0E2C1B] text-[#E6F1E9] text-[11.5px] font-normal leading-[1.55] px-3 py-2.5 shadow-[0_12px_26px_-8px_rgba(10,30,18,0.55)] opacity-0 translate-y-0.5 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 text-left">
        {text}
        <span className="absolute -top-1 left-3.5 size-0 border-4 border-transparent border-b-[#0E2C1B]" />
      </span>
    </span>
  );
}