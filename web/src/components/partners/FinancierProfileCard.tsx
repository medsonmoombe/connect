'use client';

import { cn } from '@/lib/utils';
import type { CapitalPartner } from '@/types';

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface FinancierProfileCardProps {
  partner: CapitalPartner;
  /** Extra CSS classes. */
  className?: string;
  /** Compact layout for cards in a grid. */
  compact?: boolean;
  /** If true, hides the investment range (e.g. for the partner's own view). */
  hideRange?: boolean;
}

/* ─── Constants ────────────────────────────────────────────────────────────── */

const RISK_BADGES: Record<string, { label: string; color: string }> = {
  LOW:    { label: 'Low Risk',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MEDIUM: { label: 'Medium Risk', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  HIGH:   { label: 'High Risk',   color: 'bg-red-50 text-red-700 border-red-200' },
};

const GOV_LABELS: Record<string, string> = {
  PASSIVE:     'Passive (No intervention)',
  BOARD_SEAT:  'Board Seat',
  ACTIVE_ROLE: 'Active Role',
};

/* ─── Format helpers ───────────────────────────────────────────────────────── */

function fmtMoney(val: number | undefined | null): string {
  if (val == null) return '—';
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

function fmtLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/* ─── Badge group ──────────────────────────────────────────────────────────── */

function BadgeGroup({ items, emptyText }: { items: string[]; emptyText?: string }) {
  if (!items || items.length === 0) {
    return <span className="text-xs text-slate-400 italic">{emptyText ?? 'None specified'}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => (
        <span key={item} className="px-2 py-0.5 rounded-none bg-slate-50 border border-slate-200 text-[10px] font-semibold text-slate-700 whitespace-nowrap">
          {fmtLabel(item)}
        </span>
      ))}
    </div>
  );
}

/* ─── Detail row ────────────────────────────────────────────────────────────── */

function DetailRow({ label, children, fullWidth }: {
  label: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn(fullWidth ? 'col-span-full' : '')}>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="text-sm font-semibold text-slate-800">{children}</div>
    </div>
  );
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export function FinancierProfileCard({
  partner,
  className,
  compact = false,
  hideRange = false,
}: FinancierProfileCardProps) {
  const riskBadge = RISK_BADGES[partner.risk_tolerance] ?? { label: partner.risk_tolerance, color: 'bg-slate-50 text-slate-600' };

  // ── Compact: single row summary (for match cards / lists) ──────────────
  if (compact) {
    return (
      <div className={cn('flex items-center gap-4', className)}>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-900 truncate">
            {partner.company?.name ?? 'Unnamed Financier'}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            {!hideRange && (
              <span className="text-[10px] font-semibold text-slate-500">
                {fmtMoney(partner.min_ticket_size)} – {fmtMoney(partner.max_ticket_size)}
              </span>
            )}
            <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold border', riskBadge.color)}>
              {riskBadge.label}
            </span>
          </div>
        </div>
        {partner.sector_focus && partner.sector_focus.length > 0 && (
          <div className="hidden sm:flex gap-1 shrink-0">
            {partner.sector_focus.slice(0, 3).map(s => (
              <span key={s} className="px-1.5 py-0.5 rounded bg-slate-50 text-[9px] font-medium text-slate-600">
                {fmtLabel(s)}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Full: detailed profile card (for profile page / overview) ──────────
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header / Org info */}
      <div className="flex items-center gap-4">
        <div className="size-12 rounded-none bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white font-black text-sm shrink-0">
          {(partner.company?.name ?? 'FC').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-slate-900 truncate">
            {partner.company?.name ?? 'Unnamed Financier'}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {partner.company?.country ?? '—'} · {partner.company?.years_operating ?? '—'} years
          </p>
        </div>
      </div>

      {/* Investment criteria grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {/* Investment range */}
        {!hideRange && (
          <>
            <DetailRow label="Minimum Investment">
              <span className="text-primary font-black">{fmtMoney(partner.min_ticket_size)}</span>
            </DetailRow>
            <DetailRow label="Maximum Investment">
              <span className="text-primary font-black">{fmtMoney(partner.max_ticket_size)}</span>
            </DetailRow>
          </>
        )}

        {/* Risk tolerance */}
        <DetailRow label="Risk Appetite">
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border', riskBadge.color)}>
            {riskBadge.label}
          </span>
        </DetailRow>

        {/* Governance preference */}
        <DetailRow label="Governance Preference">
          {GOV_LABELS[partner.governance_preference] ?? fmtLabel(partner.governance_preference)}
        </DetailRow>

        {/* Preferred project stages */}
        {partner.preferred_project_stage && partner.preferred_project_stage.length > 0 && (
          <DetailRow label="Preferred Project Stage" fullWidth>
            <BadgeGroup items={partner.preferred_project_stage} emptyText="All stages considered" />
          </DetailRow>
        )}

        {/* Preferred capital structures */}
        <DetailRow label="Capital Structures" fullWidth>
          {partner.preferred_capital_structure && partner.preferred_capital_structure.length > 0 ? (
            <BadgeGroup items={partner.preferred_capital_structure} />
          ) : (
            <span className="text-sm text-slate-400">Debt, Equity, Profit Sharing, Leasing, Grant</span>
          )}
        </DetailRow>

        {/* Sector focus */}
        <DetailRow label="Sector Focus" fullWidth>
          <BadgeGroup items={partner.sector_focus ?? []} emptyText="All sectors" />
        </DetailRow>

        {/* Geographic focus */}
        <DetailRow label="Geographic Focus" fullWidth>
          <BadgeGroup items={partner.geographic_focus ?? []} emptyText="Global" />
        </DetailRow>
      </div>

      {/* Return expectations */}
      {partner.expected_return_profile && (
        <div className="p-3 rounded-none bg-slate-50 border border-slate-100">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Return Expectations</p>
          <p className="text-sm font-semibold text-slate-800">{partner.expected_return_profile}</p>
        </div>
      )}

      {/* Company description */}
      {partner.company?.description && (
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">About</p>
          <p className="text-sm text-slate-600 leading-relaxed">{partner.company.description}</p>
        </div>
      )}
    </div>
  );
}
