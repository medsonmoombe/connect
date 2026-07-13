'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'premium' | 'danger' | 'white';
  size?: 'xs' | 'sm' | 'default' | 'lg' | 'icon';
  icon?: React.ReactNode;
  bg?: string;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      icon,
      bg,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    /* ─── Variants ──────────────────────────────────────────── */
    const variants: Record<string, string> = {
      default:
        'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/20',
      premium:
        'bg-gradient-to-br from-primary to-primary/90 text-white hover:from-primary/90 hover:to-primary/80 shadow-md shadow-primary/25 border border-primary/10',
      outline:
        'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900',
      ghost:
        'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      link:
        'text-primary underline-offset-4 hover:underline px-0',
      danger:
        'bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-600/20',
      white:
        'bg-white text-slate-900 hover:bg-slate-50 shadow-sm',
    };

    /* ─── Sizes ─────────────────────────────────────────────── */
    const sizes: Record<string, string> = {
      xs: 'h-7 px-2.5 text-[11px] font-semibold rounded-lg gap-1.5',
      sm: 'h-8 px-3.5 text-xs font-semibold rounded-lg gap-2',
      default: 'h-10 px-5 text-[13px] font-semibold rounded-xl gap-2',
      lg: 'h-12 px-7 text-sm font-bold rounded-xl gap-2.5',
      icon: 'size-10 rounded-xl',
    };

    /* ─── Icon sizing for icon-only buttons ──────────────────── */
    const iconOnlySizes: Record<string, string> = {
      xs: 'size-7 rounded-lg',
      sm: 'size-8 rounded-lg',
      default: 'size-10 rounded-xl',
      lg: 'size-12 rounded-xl',
      icon: '',
    };

    const isIconOnly = !children && icon;
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          /* Base */
          'inline-flex items-center justify-center font-semibold',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:pointer-events-none',
          /* Variant */
          !bg && variants[variant],
          /* Custom bg */
          bg && `${bg} text-white`,
          /* Size (text) */
          !isIconOnly && sizes[size],
          /* Size (icon-only) */
          isIconOnly && iconOnlySizes[size],
          className,
        )}
        {...props}
      >
        {/* Loading spinner */}
        {loading && (
          <svg
            className="animate-spin shrink-0"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {/* Icon (left side, hidden when loading) */}
        {!loading && icon && (
          <span className="shrink-0 [&>svg]:size-4">{icon}</span>
        )}

        {/* Text */}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export { Button };
