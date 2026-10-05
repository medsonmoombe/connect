'use client';

import { cn } from '@/lib/utils';

interface PageHeroProps {
  /** Small uppercase eyebrow line above the title (e.g. "Governance"). */
  eyebrow?: string;
  /** Main heading. */
  title: React.ReactNode;
  /** Subtitle / description line under the title. */
  description?: React.ReactNode;
  /** Right-aligned action area (typically Approve/Return buttons). */
  actions?: React.ReactNode;
  /** Optional element rendered above the eyebrow (e.g. a back link). */
  topLeft?: React.ReactNode;
  /** Compact variant — smaller padding, used inside wizard steps etc. */
  compact?: boolean;
  className?: string;
}

/**
 * PageHero — the canonical dark-green page header.
 *
 * Replaces the ~30+ inline copies of:
 *
 *   <div className="space-y-6 animate-in fade-in duration-500">
 *     <div className="bg-[#0b3b24] px-6 py-5 relative overflow-hidden">
 *       <div className="absolute -top-16 -right-16 size-32 bg-white/[0.03] rounded-full" />
 *       <div className="absolute -bottom-8 -left-8 size-24 bg-white/[0.02] rounded-full" />
 *       <p className="text-[10px] font-bold text-emerald-200/50 uppercase tracking-widest mb-1">Eyebrow</p>
 *       <h1 className="text-xl font-bold text-white tracking-tight">Title</h1>
 *       <p className="text-[11px] text-emerald-200/60 mt-1">Subtitle</p>
 *     </div>
 *
 * Default size matches the dashboard family (px-6 py-5). Set `compact` for
 * the smaller variant used inside multi-step wizards.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  topLeft,
  compact = false,
  className,
}: PageHeroProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-none text-[#dff0e4] shadow-[0_14px_34px_-14px_rgba(12,43,27,0.5)]',
        compact ? 'px-6 py-5' : 'px-8 py-[30px]',
        className,
      )}
      style={{
        background:
          'radial-gradient(900px 340px at 88% -30%, rgba(96,220,140,0.16), transparent 60%),' +
          'radial-gradient(520px 240px at -8% 115%, rgba(96,220,140,0.10), transparent 60%),' +
          'linear-gradient(118deg, #0c2b1b, #14532d 55%, #176239)',
      }}
    >
      {/* Subtle decorative orbs — same as the inline originals */}
      <div className="pointer-events-none absolute -bottom-[58px] -right-9 size-[300px] rounded-full bg-white/[0.04]" />
      <div className="pointer-events-none absolute -left-8 -top-16 size-32 rounded-full bg-white/[0.03]" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {topLeft && <div className="mb-2">{topLeft}</div>}
          {eyebrow && (
            <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#93d0a9]">
              {eyebrow}
            </p>
          )}
          <h1 className="text-[23px] font-bold tracking-[-0.02em] text-white">{title}</h1>
          {description && (
            <p className={cn('mt-1 text-[#b7d6c2]', compact ? 'text-[11px]' : 'text-[13px]')}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 gap-2.5">{actions}</div>}
      </div>
    </div>
  );
}
