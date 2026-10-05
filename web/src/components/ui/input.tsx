import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Base text input — canonical app style:
 * square corners, slate-200 border on slate-50 fill, brand-green focus ring.
 * Pages may override rounding/background via className (tailwind-merge).
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-none border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900',
          'placeholder:text-slate-400 font-medium',
          'transition-colors focus:outline-none focus:bg-white focus:border-[#0b3b24] focus:ring-2 focus:ring-[#0b3b24]/10',
          'disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-slate-100 disabled:text-slate-400',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
