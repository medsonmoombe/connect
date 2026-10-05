'use client';

import { InfoHint } from '@/components/ui/InfoHint';
import { cn } from '@/lib/utils';

interface FieldLabelProps {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
}

/**
 * Mono-cased field label matching the submission-wizard wireframe: small
 * Inter uppercase label with a required asterisk and an optional hover
 * tooltip ("?" question mark) described by `hint`.
 */
export function FieldLabel({ label, required, hint, className }: FieldLabelProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <label className={cn(
        'text-[11px] font-semibold uppercase tracking-[0.09em] text-[#5C6B61] cursor-default',
        required && 'pr-0',
      )}>
        {label}
        {required && <span className="text-[#C63A2B] font-bold"> *</span>}
      </label>
      {hint && <InfoHint text={hint} />}
    </span>
  );
}