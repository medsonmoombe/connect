'use client';

import { forwardRef, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ── Design tokens (matches PageHero / SectionCard dark-green brand) ── */

const INPUT_CLASS =
  'h-11 w-full rounded-none border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/10 focus:border-[#0b3b24]';

const TEXTAREA_CLASS =
  'w-full rounded-none border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/10 focus:border-[#0b3b24] resize-none';

const SELECT_CLASS =
  'h-11 w-full rounded-none border border-slate-200 bg-slate-50 px-4 pr-9 text-sm font-medium text-slate-900 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/10 focus:border-[#0b3b24] appearance-none cursor-pointer';

const LABEL_CLASS =
  'text-[10px] font-bold uppercase tracking-widest text-slate-400';

const HINT_CLASS =
  'text-[10px] text-slate-400 mt-1';

/* ── Components ── */

export interface FormFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

export function FormLabel({ label, required, className }: { label?: string; required?: boolean; className?: string }) {
  if (!label) return null;
  return (
    <label className={cn(LABEL_CLASS, className)}>
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

export function FormHint({ hint }: { hint?: string }) {
  if (!hint) return null;
  return <p className={HINT_CLASS}>{hint}</p>;
}

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="text-[11px] font-semibold text-red-600 mt-1.5 flex items-center gap-1">
      <svg className="size-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      {error}
    </p>
  );
}

export const FormInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FormFieldProps>(
  ({ label, hint, error, required, className, ...props }, ref) => {
    const wrapperCls = cn('space-y-2', className);
    return (
      <div className={wrapperCls}>
        <FormLabel label={label} required={required} />
        <input
          ref={ref}
          className={cn(INPUT_CLASS, error && 'border-red-300 focus:border-red-500 focus:ring-red-200')}
          {...props}
        />
        <FormError error={error} />
        <FormHint hint={hint} />
      </div>
    );
  }
);
FormInput.displayName = 'FormInput';

export const FormTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FormFieldProps>(
  ({ label, hint, error, required, className, ...props }, ref) => {
    const wrapperCls = cn('space-y-2', className);
    return (
      <div className={wrapperCls}>
        <FormLabel label={label} required={required} />
        <textarea
          ref={ref}
          className={cn(TEXTAREA_CLASS, error && 'border-red-300 focus:border-red-500 focus:ring-red-200')}
          rows={3}
          {...props}
        />
        <FormError error={error} />
        <FormHint hint={hint} />
      </div>
    );
  }
);
FormTextarea.displayName = 'FormTextarea';

export const FormSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FormFieldProps>(
  ({ label, hint, error, required, className, children, ...props }, ref) => {
    const wrapperCls = cn('space-y-2', className);
    return (
      <div className={wrapperCls}>
        <FormLabel label={label} required={required} />
        <div className="relative">
          <select
            ref={ref}
            className={cn(SELECT_CLASS, error && 'border-red-300 focus:border-red-500 focus:ring-red-200')}
            {...props}
          >
            {children}
          </select>
          <svg
            className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <FormError error={error} />
        <FormHint hint={hint} />
      </div>
    );
  }
);
FormSelect.displayName = 'FormSelect';

/* ── Number input with unit suffix ── */

export interface FormNumberProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  unit?: string;
  className?: string;
}

export const FormNumber = forwardRef<HTMLInputElement, FormNumberProps>(
  ({ label, hint, error, required, unit, className, ...props }, ref) => {
    const wrapperCls = cn('space-y-2', className);
    return (
      <div className={wrapperCls}>
        <FormLabel label={label} required={required} />
        <div className="relative">
          <input
            ref={ref}
            type="number"
            className={cn(INPUT_CLASS, 'pr-12', error && 'border-red-300 focus:border-red-500 focus:ring-red-200')}
            {...props}
          />
          {unit && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">
              {unit}
            </span>
          )}
        </div>
        <FormError error={error} />
        <FormHint hint={hint} />
      </div>
    );
  }
);
FormNumber.displayName = 'FormNumber';
