'use client';

import { cn } from '@/lib/utils';

interface SectionCardProps {
  /** Small uppercase eyebrow shown above the title in the dark header. */
  eyebrow?: string;
  /** Title shown in the dark header. */
  title?: React.ReactNode;
  /** Right-aligned actions in the dark header (icon button, link, etc.). */
  headerActions?: React.ReactNode;
  /** Body content. */
  children: React.ReactNode;
  className?: string;
  /** Padding override for the body. Default `p-5` / `p-6`. */
  bodyClassName?: string;
  /** Optional counter / total shown on the right of the title row. */
  trailing?: React.ReactNode;
  /** Remove the dark header entirely (body only). */
  noHeader?: boolean;
}

/**
 * SectionCard — the canonical data-card with a dark-green header strip.
 *
 * Replaces ~15+ inline copies of the pattern used in
 * `authority/projects/[id]/page.tsx` and the project detail page:
 *
 *   <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
 *     <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
 *       <p className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.13em] text-[10.5px] font-extrabold">Eyebrow</p>
 *       <h3 className="text-[15px] font-bold text-ink mt-0.5">Title</h3>
 *     </div>
 *     <div className="p-5">...</div>
 *   </div>
 */
export function SectionCard({
  eyebrow,
  title,
  headerActions,
  children,
  className,
  bodyClassName,
  trailing,
  noHeader = false,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]',
        className,
      )}
    >
      {!noHeader && (eyebrow || title || headerActions || trailing) && (
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">
                {eyebrow}
              </p>
            )}
            {title && (
              <h3 className="mt-0.5 truncate text-[15px] font-bold text-ink">
                {title}
              </h3>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {trailing}
            {headerActions}
          </div>
        </div>
      )}
      <div className={cn(bodyClassName ?? 'p-[22px]')}>{children}</div>
    </div>
  );
}
