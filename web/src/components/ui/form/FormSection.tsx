'use client';

import { cn } from '@/lib/utils';

interface FormSectionProps {
  number: string;
  title: string;
  note?: string;
  className?: string;
}

/**
 * Numbered section header of the submission-wizard wireframe: a mono number
 * chip ("01"), an uppercase title, a hairline rule and an optional mono note
 * on the right.
 */
export function FormSection({ number, title, note, className }: FormSectionProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="font-mono text-[10.5px] font-semibold tracking-[0.08em] text-g-800 bg-g-soft border border-g-line px-1.5 py-0.5 shrink-0">
        {number}
      </span>
      <h2 className="text-[12.5px] font-bold uppercase tracking-[0.1em] text-[#17251C] whitespace-nowrap">
        {title}
      </h2>
      <span className="h-px flex-1 bg-line" />
      {note && (
        <span className="font-mono text-[10px] font-medium tracking-[0.12em] uppercase text-[#8B998F] whitespace-nowrap">
          {note}
        </span>
      )}
    </div>
  );
}