'use client';

import { cn } from '@/lib/utils';
import { Icons } from '@/components/ui/icons';
import type { LucideIcon } from 'lucide-react';

type Variant = 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'analyzing';

interface StatusBannerProps {
  variant: Variant;
  /** Short uppercase eyebrow line. */
  label: string;
  /** Body copy. */
  message: React.ReactNode;
  /** Right-aligned action button(s). */
  actions?: React.ReactNode;
  /** Optional icon override (defaults to a variant-appropriate icon). */
  icon?: LucideIcon;
  className?: string;
}

const variantStyle: Record<Variant, {
  container: string;
  iconWrap: string;
  iconColor: string;
}> = {
  info: {
    container: 'border-blue-200 bg-blue-50/60 text-blue-900',
    iconWrap: 'bg-gradient-to-br from-blue-500 to-indigo-500',
    iconColor: 'text-white',
  },
  success: {
    container: 'border-emerald-200 bg-emerald-50/60 text-emerald-900',
    iconWrap: 'bg-gradient-to-br from-emerald-500 to-green-500',
    iconColor: 'text-white',
  },
  warning: {
    container: 'border-amber-300 bg-amber-50 text-amber-900',
    iconWrap: 'bg-gradient-to-br from-amber-400 to-orange-500',
    iconColor: 'text-white',
  },
  danger: {
    container: 'border-rose-300 bg-rose-50 text-rose-900',
    iconWrap: 'bg-gradient-to-br from-rose-500 to-amber-500',
    iconColor: 'text-white',
  },
  neutral: {
    container: 'border-slate-200 bg-slate-50 text-slate-900',
    iconWrap: 'bg-slate-900',
    iconColor: 'text-white',
  },
  analyzing: {
    container: 'border-blue-200 bg-blue-50/60 text-blue-900',
    iconWrap: 'bg-gradient-to-br from-blue-500 to-indigo-500',
    iconColor: 'text-white',
  },
};

const variantDefaultIcon: Record<Variant, LucideIcon> = {
  info: Icons.alertTriangle,
  success: Icons.checkCircle2,
  warning: Icons.alertTriangle,
  danger: Icons.alertTriangle,
  neutral: Icons.alertTriangle,
  analyzing: Icons.spinner,
};

/**
 * StatusBanner — single canonical status / notice strip.
 *
 * Replaces the four bespoke gradient banners in `projects/[id]/page.tsx`,
 * the developer list banners, and the onboarding notices. Variants map to
 * intent (`info | success | warning | danger | neutral | analyzing`) so the
 * colour scheme is decided once here.
 */
export function StatusBanner({
  variant,
  label,
  message,
  actions,
  icon,
  className,
}: StatusBannerProps) {
  const style = variantStyle[variant];
  const Icon = icon ?? variantDefaultIcon[variant];
  const iconSpin = variant === 'analyzing';

  return (
    <div
      className={cn(
        'relative overflow-hidden border px-6 py-4 flex items-center justify-between gap-4',
        style.container,
        className,
      )}
      role="status"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'size-10 flex items-center justify-center shrink-0 shadow-sm',
            style.iconWrap,
          )}
        >
          <Icon className={cn('size-5', style.iconColor, iconSpin && 'animate-spin')} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-90">
            {label}
          </p>
          <div className="text-sm font-medium leading-relaxed mt-0.5">
            {message}
          </div>
        </div>
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
