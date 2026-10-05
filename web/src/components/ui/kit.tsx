'use client';

/**
 * UI Kit — the canonical AfriConnect design language (from the approved UI mock).
 *
 * Every surface should be assembled from these primitives so a future
 * re-theme touches ONLY `globals.css` tokens + this file. Never hard-code
 * colors in pages; use the exported tone constants or semantic components.
 *
 * Tokens (see globals.css @theme):
 *   brand #1f9d55 / hover #178a48 / text #166b3b / soft #e9f6ee
 *   copper #9a4b0e / soft #faf0e2
 *   ink #16241c / ink-2 #4a5c52 / ink-3 #7c8b82
 *   line #e3e9e5 / line-strong #cfdad3 · surface-2 #f0f4f1
 *   badges: blue / green / amber / slate / red
 */

import { useState, useRef, useEffect, createContext, useContext } from 'react';
import * as ReactDOM from 'react-dom';
import Link from 'next/link';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Tones — the shared color vocabulary. Anything colored goes through these.
// ─────────────────────────────────────────────────────────────────────────────

export type Tone = 'brand' | 'copper' | 'blue' | 'green' | 'amber' | 'slate' | 'red' | 'violet';

export const TONE_SOFT: Record<Tone, string> = {
  brand:  'bg-brand-soft text-brand-text',
  copper: 'bg-copper-soft text-copper',
  blue:   'bg-blue-50 text-blue-700',
  green:  'bg-green-50 text-green-700',
  amber:  'bg-amber-50 text-amber-700',
  slate:  'bg-surface-2 text-ink-2',
  red:    'bg-red-50 text-red-700',
  violet: 'bg-violet-50 text-violet-700',
};

/** Semantic status → tone. The single mapping used by every StatusPill. */
export type SemanticStatus =
  | 'active' | 'live' | 'verified' | 'approved' | 'success'
  | 'pending' | 'review' | 'warning'
  | 'rejected' | 'suspended' | 'dropped' | 'danger' | 'inactive'
  | 'draft' | 'neutral' | 'info' | 'closed';

export const STATUS_TONE: Record<SemanticStatus, Tone> = {
  active: 'green', live: 'green', verified: 'green', approved: 'green', success: 'green',
  pending: 'amber', review: 'amber', warning: 'amber',
  rejected: 'red', suspended: 'red', dropped: 'red', danger: 'red', inactive: 'red',
  draft: 'slate', neutral: 'slate', info: 'blue', closed: 'slate',
};

/** Map any arbitrary app status string to a semantic status. */
export function statusTone(status?: string | null): Tone {
  const s = (status ?? '').toLowerCase();
  if (['active', 'live', 'verified', 'approved', 'closed_won', 'completed'].includes(s)) return 'green';
  if (['pending', 'under_review', 'pending_verification', 'needs_update', 'pending_live', 'introduction', 'queued'].includes(s)) return 'amber';
  if (['rejected', 'suspended', 'dropped', 'deactivated', 'expired', 'failed'].includes(s)) return 'red';
  if (['closed', 'archived', 'draft', 'inactive'].includes(s)) return 'slate';
  return 'slate';
}

// ─────────────────────────────────────────────────────────────────────────────
// SoftIcon — 40px rounded tile with a soft tone fill (mock .card-icon)
// ─────────────────────────────────────────────────────────────────────────────

export function SoftIcon({ icon: Icon, tone = 'brand', size = 'md', className }: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone?: Tone;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span className={cn(
      'grid shrink-0 place-items-center rounded-none',
      size === 'md' ? 'size-10' : 'size-9',
      TONE_SOFT[tone],
      className,
    )}>
      <Icon className={size === 'md' ? 'size-[18px]' : 'size-4'} />
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card — mock .card / .card-head / .card-body
// ─────────────────────────────────────────────────────────────────────────────

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]', className)}>
      {children}
    </section>
  );
}

export function CardHead({ icon, tone = 'brand', title, sub, trailing, className }: {
  icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  title: React.ReactNode;
  sub?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3.5 border-b border-line px-[22px] py-[17px]', className)}>
      {icon && <SoftIcon icon={icon} tone={tone} />}
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[15px] font-bold text-ink">
          {title}
          {trailing}
        </div>
        {sub && <div className="text-[12.5px] text-ink-3">{sub}</div>}
      </div>
    </div>
  );
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-[22px]', className)}>{children}</div>;
}

/** Small count chip used in card titles (mock .chip). */
export function CountChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-surface-2 px-[9px] py-px align-[2px] text-[11px] font-bold text-ink-2">
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge / StatusPill (mock .badge-role + .status)
// ─────────────────────────────────────────────────────────────────────────────

export function Badge({ tone = 'slate', children, className }: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold tracking-[0.02em]', TONE_SOFT[tone], className)}>
      {children}
    </span>
  );
}

export function StatusPill({ status, label, pulse = false, className }: {
  status?: string | null;
  /** Override the derived label (defaults to prettified status). */
  label?: string;
  /** Animated dot, for "live"-style states. */
  pulse?: boolean;
  className?: string;
}) {
  const tone = statusTone(status);
  const text = label ?? (status ?? '—').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className={cn('inline-flex items-center gap-[7px] rounded-full px-[11px] py-1 text-xs font-semibold', TONE_SOFT[tone], className)}>
      {pulse && <span className="size-[7px] rounded-full bg-current motion-safe:animate-pulse" />}
      {!pulse && <span className="size-[7px] rounded-full bg-current opacity-70" />}
      {text}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero — gradient page banner (mock .hero) with actions + stats strip
// ─────────────────────────────────────────────────────────────────────────────

export function Hero({ eyebrow, icon, title, description, actions, stats, watermark = 'zap', className }: {
  eyebrow?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned actions — pass ready-made <HeroGhostButton>/<HeroLightButton>. */
  actions?: React.ReactNode;
  /** Stats strip: { value, label }[] */
  stats?: { value: React.ReactNode; label: string }[];
  watermark?: 'zap' | 'shield' | 'activity' | 'folder' | 'building';
  className?: string;
}) {
  const WatermarkIcon = (Icons[watermark] ?? Icons.zap) as React.ComponentType<{ className?: string; strokeWidth?: number }>;
  const EyebrowIcon = icon;
  return (
    <section
      className={cn('relative overflow-hidden rounded-none px-8 py-[30px] text-[#dff0e4] shadow-[0_14px_34px_-14px_rgba(12,43,27,0.5)]', className)}
      style={{
        background:
          'radial-gradient(900px 340px at 88% -30%, rgba(96,220,140,0.16), transparent 60%),' +
          'radial-gradient(520px 240px at -8% 115%, rgba(96,220,140,0.10), transparent 60%),' +
          'linear-gradient(118deg, #0c2b1b, #14532d 55%, #176239)',
      }}
    >
      <WatermarkIcon className="pointer-events-none absolute -bottom-[58px] -right-9 size-[300px] text-white opacity-[0.05]" strokeWidth={1.4} />
      <div className="relative flex flex-wrap items-start justify-between gap-[22px]">
        <div className="min-w-0">
          {eyebrow && (
            <span className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#93d0a9]">
              {icon && EyebrowIcon && <EyebrowIcon className="size-3.5" />}
              {eyebrow}
            </span>
          )}
          <h1 className="mt-2.5 text-[27px] font-bold leading-tight tracking-[-0.02em] text-white">{title}</h1>
          {description && <p className="mt-1.5 max-w-[60ch] text-sm text-[#b7d6c2]">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
      </div>
      {stats && stats.length > 0 && (
        <div className="relative mt-[26px] flex flex-wrap border-t border-white/[0.14] pt-[18px]">
          {stats.map((s, i) => (
            <div key={s.label} className={cn('py-1', i === 0 ? 'pr-[30px]' : 'border-l border-white/[0.14] px-[30px]')}>
              <div className="text-[22px] font-extrabold tracking-[-0.01em] text-white">{s.value}</div>
              <div className="mt-0.5 text-[11.5px] text-[#9cc6ab]">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function HeroGhostButton({ children, onClick, href, className }: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const cls = cn(
    'inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-none border border-white/20 bg-white/[0.12] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/[0.22]',
    className,
  );
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button onClick={onClick} className={cls}>{children}</button>;
}

export function HeroLightButton({ children, onClick, href, className }: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const cls = cn(
    'inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-none bg-white px-4 text-[13.5px] font-semibold text-[#123a26] transition-colors hover:bg-brand-soft',
    className,
  );
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button onClick={onClick} className={cls}>{children}</button>;
}

/** White count pill used inside hero buttons (mock .pill). */
export function HeroPill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/[0.22] px-2 py-0.5 text-[11.5px] font-extrabold">{children}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// TabBar — pill filter tabs with counts (queue pages)
// ─────────────────────────────────────────────────────────────────────────────

export function TabBar<T extends string>({ tabs, active, onChange, className }: {
  tabs: { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-none px-3.5 py-1.5 text-xs font-bold transition-colors',
            active === t.id
              ? 'bg-brand-soft text-brand-text ring-1 ring-brand/25'
              : 'text-ink-2 hover:bg-surface-2',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn(
              'rounded-full px-1.5 py-px text-[10px] font-extrabold',
              active === t.id ? 'bg-brand/15 text-brand-text' : 'bg-surface-2 text-ink-3',
            )}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchInput — rounded search with icon (mock .search input)
// ─────────────────────────────────────────────────────────────────────────────

export function SearchInput({ value, onChange, placeholder = 'Search…', className }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Icons.search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-none border border-line bg-white pl-9 pr-9 text-[13.5px] text-ink transition-colors placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-[3.5px] focus:ring-brand/20"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
        >
          <Icons.x className="size-4" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Select — mock .select with chevron
// ─────────────────────────────────────────────────────────────────────────────

export function Select({ value, onChange, options, className, ariaLabel }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        aria-label={ariaLabel}
        onChange={e => onChange(e.target.value)}
        className="h-10 w-full appearance-none rounded-none border border-line-strong bg-white pl-3.5 pr-9 text-[13.5px] font-semibold text-ink transition-colors focus:border-brand focus:outline-none focus:ring-[3.5px] focus:ring-brand/20"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Icons.chevronDown className="pointer-events-none absolute right-3 top-1/2 size-[15px] -translate-y-1/2 text-ink-3" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PrimaryButton — brand CTA (mock .btn-primary)
// ─────────────────────────────────────────────────────────────────────────────

export function PrimaryButton({ children, onClick, type = 'button', disabled, loading, icon: Icon, className }: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-none bg-brand px-4 text-[13.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_3px_rgba(22,36,28,0.18)] transition-all hover:bg-brand-hover active:translate-y-px disabled:pointer-events-none disabled:opacity-60',
        className,
      )}
    >
      {loading ? (
        <Icons.spinner className="size-4 animate-spin" />
      ) : (
        Icon && <Icon className="size-4" />
      )}
      {children}
    </button>
  );
}

/** Ghost/secondary button (mock .btn-ghost). */
export function GhostButton({ children, onClick, type = 'button', disabled, icon: Icon, className }: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-none border border-line-strong bg-white px-4 text-[13.5px] font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-60',
        className,
      )}
    >
      {Icon && <Icon className="size-4" />}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row — list row used for pending invites / activity feeds (mock .row)
// ─────────────────────────────────────────────────────────────────────────────

export function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-3.5 border-b border-line px-[22px] py-3.5 transition-colors last:border-b-0 hover:bg-surface-2', className)}>{children}</div>;
}

export function RowMain({ title, sub, className }: { title: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 flex-1', className)}>
      <div className="truncate text-[13.5px] font-semibold text-ink">{title}</div>
      {sub && <div className="mt-px text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EmptyState — mock .empty
// ─────────────────────────────────────────────────────────────────────────────

export function EmptyState({ icon = 'search', title, sub, action, className }: {
  icon?: keyof typeof Icons;
  title: string;
  sub?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const Icon = (Icons[icon] ?? Icons.search) as React.ComponentType<{ className?: string; strokeWidth?: number }>;
  return (
    <div className={cn('flex flex-col items-center gap-[3px] px-5 py-[46px] text-center text-ink-3', className)}>
      <Icon className="mb-2 size-[34px] stroke-[1.5]" />
      <div className="text-[14.5px] font-bold text-ink">{title}</div>
      {sub && <div className="text-[13px]">{sub}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Th/Td helpers — match the mock .team-table typographic rhythm
// ─────────────────────────────────────────────────────────────────────────────

export const TH_CLASS = 'px-[22px] py-3 text-left text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-ink-3 border-b border-line';
export const TD_CLASS = 'px-[22px] py-3.5 align-middle border-b border-line';

// ─────────────────────────────────────────────────────────────────────────────
// RowMenu — portal dropdown menu anchored to a trigger (mock .menu)
// ─────────────────────────────────────────────────────────────────────────────

const MenuCtx = createContext<{ close: () => void }>({ close: () => {} });
export const useMenuClose = () => useContext(MenuCtx);

export function RowMenu({ trigger, items, align = 'right', className }: {
  /** Render-prop trigger; receives { open, toggle }. */
  trigger: (state: { open: boolean; toggle: () => void }) => React.ReactNode;
  items: (
    | { label: string; icon?: React.ComponentType<{ className?: string }>; onClick: () => void; danger?: boolean; disabled?: boolean; checked?: boolean }
    | 'divider'
  )[];
  align?: 'left' | 'right';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; left: number; bottom?: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const MENU_H = items.length * 38 + 16;
      const openUp = window.innerHeight - rect.bottom < MENU_H;
      setPos({
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        left: align === 'right' ? rect.right - 190 : rect.left,
      });
    }
    setOpen(v => !v);
  };

  return (
    <div ref={triggerRef} className={cn('relative inline-block', className)}>
      {trigger({ open, toggle })}
      {open && pos && ReactDOM.createPortal(
        <MenuCtx.Provider value={{ close: () => setOpen(false) }}>
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: Math.max(8, pos.left), zIndex: 90 }}
            className="w-[190px] animate-in fade-in slide-in-from-top-1 rounded-none border border-line bg-white p-1.5 shadow-[0_12px_32px_-8px_rgba(22,36,28,0.18)] duration-150"
          >
            {items.map((item, i) =>
              item === 'divider' ? (
                <div key={`d${i}`} className="mx-1 my-1.5 h-px bg-line" />
              ) : (
                <button
                  key={item.label}
                  disabled={item.disabled}
                  onClick={() => { item.onClick(); setOpen(false); }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-none px-2.5 py-2 text-left text-[13px] font-semibold transition-colors',
                    item.danger
                      ? 'text-red-700 hover:bg-red-50'
                      : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                    item.disabled && 'pointer-events-none opacity-40',
                  )}
                >
                  {item.icon && <item.icon className="size-[15px]" />}
                  {item.label}
                  {item.checked && <Icons.check className="ml-auto size-[15px] text-brand-text" />}
                </button>
              )
            )}
          </div>
        </MenuCtx.Provider>,
        document.body,
      )}
    </div>
  );
}
