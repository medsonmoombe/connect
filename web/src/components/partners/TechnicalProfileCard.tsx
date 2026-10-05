'use client';

import { cn } from '@/lib/utils';
import type { TechnicalPartner } from '@/types';

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface TechnicalProfileCardProps {
  partner: TechnicalPartner;
  /** Extra CSS classes. */
  className?: string;
  /** Compact layout for cards in a grid. */
  compact?: boolean;
}

/* ─── Format helpers ───────────────────────────────────────────────────────── */

function fmtLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function fmtMoney(val: number | undefined | null): string {
  if (val == null) return '—';
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

/* ─── Badge group ──────────────────────────────────────────────────────────── */

function BadgeGroup({ items, emptyText, limit }: { items: string[]; emptyText?: string; limit?: number }) {
  if (!items || items.length === 0) {
    return <span className="text-xs text-slate-400 italic">{emptyText ?? 'None specified'}</span>;
  }
  const displayed = limit ? items.slice(0, limit) : items;
  const remaining = limit ? items.length - limit : 0;
  return (
    <div className="flex flex-wrap gap-1.5">
      {displayed.map(item => (
        <span key={item} className="px-2 py-0.5 rounded-none bg-slate-50 border border-slate-200 text-[10px] font-semibold text-slate-700 whitespace-nowrap">
          {fmtLabel(item)}
        </span>
      ))}
      {remaining > 0 && (
        <span className="px-2 py-0.5 rounded-none bg-slate-100 text-[10px] font-semibold text-slate-500 whitespace-nowrap">
          +{remaining} more
        </span>
      )}
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

/* ─── Stat chip ─────────────────────────────────────────────────────────────── */

function StatChip({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="p-3 rounded-none bg-slate-50 border border-slate-100 min-w-0">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className={cn('text-sm font-extrabold text-slate-900 truncate', color)}>{value}</p>
    </div>
  );
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export function TechnicalProfileCard({
  partner,
  className,
  compact = false,
}: TechnicalProfileCardProps) {
  // ── Compact: summary row (for match cards / lists) ─────────────────────
  if (compact) {
    return (
      <div className={cn('flex items-center gap-4', className)}>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-900 truncate">
            {partner.company?.name ?? 'Unnamed EPC / Operator'}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <span className="text-[10px] font-semibold text-slate-500">
              {partner.total_mw_delivered ?? '—'} MW delivered
            </span>
            {partner.service_categories && partner.service_categories.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold">
                {partner.service_categories.slice(0, 2).map(fmtLabel).join(', ')}
              </span>
            )}
          </div>
        </div>
        {partner.sector_experience && partner.sector_experience.length > 0 && (
          <div className="hidden sm:flex gap-1 shrink-0">
            {partner.sector_experience.slice(0, 2).map(s => (
              <span key={s} className="px-1.5 py-0.5 rounded bg-slate-50 text-[9px] font-medium text-slate-600">
                {fmtLabel(s)}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Full: detailed profile card ───────────────────────────────────────
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header / Org info */}
      <div className="flex items-center gap-4">
        <div className="size-12 rounded-none bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center text-white font-black text-sm shrink-0">
          {(partner.company?.name ?? 'EPC').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-slate-900 truncate">
            {partner.company?.name ?? 'Unnamed EPC / Operator'}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {partner.company?.country ?? '—'} · {partner.years_of_experience ?? partner.company?.years_operating ?? '—'} years
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatChip label="Total Delivered" value={`${partner.total_mw_delivered ?? '—'} MW`} color="text-primary" />
        <StatChip label="Largest Project" value={`${partner.largest_project_mw ?? '—'} MW`} color="text-primary" />
        <StatChip label="Annual Capacity" value={`${partner.annual_delivery_capacity_mw ?? '—'} MW`} />
        <StatChip label="Avg Delivery" value={partner.average_delivery_time_months ? `${partner.average_delivery_time_months}m` : '—'} />
      </div>

      {/* Criteria grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {/* MW Capacity Range */}
        <DetailRow label="Min MW Capacity">
          <span className="text-primary font-black">{partner.min_mw_capacity ?? '—'} MW</span>
        </DetailRow>
        <DetailRow label="Max MW Capacity">
          <span className="text-primary font-black">{partner.max_mw_capacity ?? '—'} MW</span>
        </DetailRow>

        {/* Bonding / Ticket */}
        <DetailRow label="Bonding Capacity">
          {fmtMoney(partner.bonding_capacity)}
        </DetailRow>
        <DetailRow label="Ticket Size Range">
          {partner.min_ticket_size_zmw && partner.max_ticket_size_zmw
            ? `${fmtMoney(partner.min_ticket_size_zmw)} – ${fmtMoney(partner.max_ticket_size_zmw)}`
            : 'Not specified'}
        </DetailRow>

        {/* Service Categories */}
        <DetailRow label="Service Categories" fullWidth>
          <BadgeGroup items={partner.service_categories ?? []} emptyText="Not specified" />
        </DetailRow>

        {/* Sector Experience */}
        <DetailRow label="Sector Experience" fullWidth>
          <BadgeGroup items={partner.sector_experience ?? []} emptyText="Not specified" limit={8} />
        </DetailRow>

        {/* Delivery Models */}
        <DetailRow label="Delivery Models" fullWidth>
          <BadgeGroup items={partner.delivery_models ?? []} emptyText="Not specified" />
        </DetailRow>

        {/* Regions Operated */}
        <DetailRow label="Regions Operated" fullWidth>
          <BadgeGroup items={partner.regions_operated ?? []} emptyText="Global" />
        </DetailRow>

        {/* Project Type Experience */}
        {partner.project_type_experience && partner.project_type_experience.length > 0 && (
          <DetailRow label="Project Types" fullWidth>
            <BadgeGroup items={partner.project_type_experience} limit={6} />
          </DetailRow>
        )}

        {/* Payment Terms */}
        {partner.payment_terms && (
          <DetailRow label="Payment Terms" fullWidth>
            <span className="text-sm font-semibold text-slate-800">{fmtLabel(partner.payment_terms)}</span>
          </DetailRow>
        )}
      </div>

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
