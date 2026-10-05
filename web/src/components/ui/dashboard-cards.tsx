'use client';

import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

// ─── Design Tokens ──────────────────────────────────────────────────────────
// Single source of truth for all dashboard card styling.
// Every dashboard imports from here — no more ad-hoc card classes.

const CARD = {
  base: 'bg-white rounded-none border border-slate-100 shadow-soft',
  hover: 'hover:shadow-md transition-all duration-200',
  header: 'px-6 py-4 border-b border-slate-50',
  body: 'p-6',
  label: 'text-[10px] font-bold text-slate-400 tracking-[0.12em] uppercase',
  title: 'text-sm font-bold text-slate-900 mt-0.5',
  value: 'text-2xl font-extrabold text-slate-900 leading-none',
  subtitle: 'text-[10px] font-bold text-slate-400 tracking-[0.12em] mt-1.5',
} as const;

// ─── KpiCard ────────────────────────────────────────────────────────────────
// 4-up KPI row at the top of every dashboard.
// Variants: default (white), highlighted (dark bg), accent (colored bg).

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  /** Background color class for the icon container, e.g. 'bg-blue-50' */
  iconBg?: string;
  /** Icon color class, e.g. 'text-blue-600' */
  iconColor?: string;
  /** Value color override, e.g. 'text-green-600' for highlighted values */
  valueClassName?: string;
  /** Optional unit suffix, e.g. 'MW' */
  unit?: string;
  /** Render as dark card (white text on slate-900) */
  dark?: boolean;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  iconBg = 'bg-slate-50',
  iconColor = 'text-slate-600',
  valueClassName,
  unit,
  dark = false,
}: KpiCardProps) {
  if (dark) {
    return (
      <div className={cn(CARD.base, 'p-5 bg-slate-900 border-slate-800')}>
        <div className="flex items-center gap-3 mb-3">
          <div className="size-9 rounded-none bg-white/10 flex items-center justify-center">
            <Icon className="size-4 text-white/70" />
          </div>
        </div>
        <p className="text-2xl font-extrabold text-white leading-none">
          {value}
          {unit && <span className="text-sm font-bold text-white/50 ml-1">{unit}</span>}
        </p>
        <p className="text-[10px] font-bold text-white/40 tracking-[0.12em] mt-1.5 uppercase">{label}</p>
      </div>
    );
  }

  return (
    <div className={cn(CARD.base, 'p-5')}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('size-9 rounded-none flex items-center justify-center', iconBg)}>
          <Icon className={cn('size-4', iconColor)} />
        </div>
      </div>
      <p className={cn(CARD.value, valueClassName)}>
        {value}
        {unit && <span className="text-sm font-bold text-slate-400 ml-1">{unit}</span>}
      </p>
      <p className={CARD.subtitle}>{label}</p>
    </div>
  );
}

// ─── SectionCard ────────────────────────────────────────────────────────────
// Reusable card container with header + content + optional footer action.
// Used for "Top Matches", "Active Engagements", "Inbound Interest", etc.

interface SectionCardProps {
  /** Top-left label (e.g. "Opportunities") */
  sectionLabel: string;
  /** Card title (e.g. "Top Matches") */
  title: string;
  /** Right side of header — string label or full node */
  headerAction?: React.ReactNode;
  /** Clickable header action (e.g. "View All" button) */
  onHeaderAction?: () => void;
  children: React.ReactNode;
  /** Empty state when no content */
  empty?: React.ReactNode;
  /** Show loading spinner instead of children */
  loading?: boolean;
  /** Custom className on the outer wrapper */
  className?: string;
}

export function SectionCard({
  sectionLabel,
  title,
  headerAction,
  onHeaderAction,
  children,
  empty,
  loading = false,
  className,
}: SectionCardProps) {
  return (
    <div className={cn(CARD.base, 'overflow-hidden', className)}>
      {/* Header */}
      <div className={cn(CARD.header, 'flex items-center justify-between')}>
        <div>
          <p className={CARD.label}>{sectionLabel}</p>
          <h3 className={CARD.title}>{title}</h3>
        </div>
        {onHeaderAction ? (
          <button
            onClick={onHeaderAction}
            className="text-[10px] font-bold tracking-[0.12em] text-primary hover:underline uppercase"
          >
            {headerAction || 'View All'}
          </button>
        ) : headerAction ? (
          <span className="text-[10px] font-bold text-slate-400 tracking-[0.12em] uppercase">
            {headerAction}
          </span>
        ) : null}
      </div>

      {/* Body */}
      {loading ? (
        <div className="p-8 text-center">
          <Icons.spinner className="size-5 animate-spin mx-auto text-primary" />
        </div>
      ) : (
        <div className="divide-y divide-slate-50">{children}</div>
      )}

      {/* Empty state */}
      {!loading && empty && (
        <div className="p-8 text-center">{empty}</div>
      )}
    </div>
  );
}

// ─── ListItemRow ────────────────────────────────────────────────────────────
// A single row inside a SectionCard (e.g. a match, an engagement, a project).
// Provides consistent padding, hover state, and chevron.

interface ListItemRowProps {
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Right-side content (score, badge, etc.) */
  trailing?: React.ReactNode;
  /** Show chevron on the right */
  showChevron?: boolean;
}

export function ListItemRow({
  href,
  onClick,
  icon,
  title,
  subtitle,
  trailing,
  showChevron = true,
}: ListItemRowProps) {
  const content = (
    <div className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50/60 transition-colors group">
      {icon && (
        <div className="shrink-0">{icon}</div>
      )}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-primary transition-colors">
          {title}
        </h4>
        {subtitle && (
          <p className="text-[10px] font-bold text-slate-400 tracking-wider mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {trailing}
        {showChevron && (
          <Icons.chevronRight className="size-4 text-slate-300 group-hover:text-primary transition-colors" />
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  if (onClick) {
    return <button onClick={onClick} className="w-full text-left">{content}</button>;
  }
  return content;
}

// ─── QuickActionCard ────────────────────────────────────────────────────────
// Horizontal action card with icon + title + description.
// Used in the "Quick Actions" row at the bottom of dashboards.

interface QuickActionCardProps {
  href: string;
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  title: string;
  description: string;
}

export function QuickActionCard({
  href,
  icon: Icon,
  iconBg = 'bg-slate-50',
  iconColor = 'text-slate-600',
  title,
  description,
}: QuickActionCardProps) {
  return (
    <Link href={href} className="group">
      <div className={cn(CARD.base, CARD.hover, 'p-5 flex items-center gap-4')}>
        <div className={cn('size-11 rounded-none flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform', iconBg)}>
          <Icon className={cn('size-5', iconColor)} />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{title}</h4>
          <p className="text-[10px] font-bold text-slate-400 tracking-wider mt-0.5">{description}</p>
        </div>
      </div>
    </Link>
  );
}

// ─── StatusBadge ────────────────────────────────────────────────────────────
// Consistent status badge used across all dashboards and engagement views.

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  INTRO_SENT:        { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100' },
  INTRO_ACCEPTED:    { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-100' },
  NDA_SIGNED:        { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-100' },
  DUE_DILIGENCE:     { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100' },
  TERM_SHEET:        { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-100' },
  CONTRACT_SIGNED:   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  CAPITAL_COMMITTED: { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-100' },
  CLOSED:            { bg: 'bg-green-100',  text: 'text-green-800',   border: 'border-green-200' },
  DROPPED:           { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-100' },
};

const STATUS_LABELS: Record<string, string> = {
  INTRO_SENT: 'Introduction Sent',
  INTRO_ACCEPTED: 'Introduction Accepted',
  NDA_SIGNED: 'NDA Signed',
  DUE_DILIGENCE: 'Due Diligence',
  TERM_SHEET: 'Term Sheet',
  CONTRACT_SIGNED: 'Contract Signed',
  CAPITAL_COMMITTED: 'Capital Committed',
  CLOSED: 'Closed',
  DROPPED: 'Dropped',
};

export function StatusBadge({ status }: { status: string }) {
  const st = STATUS_STYLES[status] ?? STATUS_STYLES.INTRO_SENT;
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
  return (
    <span className={cn(
      'px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider border inline-flex',
      st.bg, st.text, st.border,
    )}>
      {label}
    </span>
  );
}

// ─── Exported constants for reuse ───────────────────────────────────────────
export { CARD, STATUS_STYLES, STATUS_LABELS };
