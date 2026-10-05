import { cn } from '@/lib/utils';

/* ── Primitive ─────────────────────────────────────────────── */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-slate-100 after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_2s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/50 after:to-transparent',
        className,
      )}
      {...props}
    />
  );
}

/* ── KPI Row Skeleton ──────────────────────────────────────── */

export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="size-8" />
          </div>
          <Skeleton className="h-7 w-16 mb-1.5" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}

/* ── Table Skeleton ────────────────────────────────────────── */

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      {/* Dark green header */}
      <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
        <Skeleton className="h-3.5 w-32 bg-white/20" />
        <Skeleton className="h-5 w-16 bg-white/20" />
      </div>
      {/* Header row */}
      <div className="grid gap-4 px-5 py-3 border-b border-slate-100" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 w-full" />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="grid gap-4 px-5 py-4 border-b border-slate-50 last:border-0"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton key={col} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Card Grid Skeleton ────────────────────────────────────── */

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5"
        >
          <div className="flex items-start gap-3 mb-4">
            <Skeleton className="size-10 shrink-0" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-28 mb-2" />
              <Skeleton className="h-2.5 w-16" />
            </div>
            <Skeleton className="h-5 w-16 shrink-0" />
          </div>
          <Skeleton className="h-2.5 w-full mb-2" />
          <Skeleton className="h-2.5 w-3/4 mb-4" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-2.5 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Dashboard Skeleton ────────────────────────────────────── */

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-3 w-24 mb-2" />
        <Skeleton className="h-7 w-48 mb-1" />
        <Skeleton className="h-3 w-64" />
      </div>
      {/* KPIs */}
      <KpiRowSkeleton count={4} />
      {/* Two-column: chart + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
            <Skeleton className="h-3.5 w-28 bg-white/20" />
          </div>
          <div className="p-[22px]">
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] ">
          <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
            <Skeleton className="h-3.5 w-28 bg-white/20" />
          </div>
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-3 w-full mb-1.5" />
                  <Skeleton className="h-2 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Action center */}
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] ">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <Skeleton className="h-3.5 w-24 bg-white/20" />
        </div>
        <div className="p-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border border-slate-100">
              <Skeleton className="size-9 shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-40 mb-1.5" />
                <Skeleton className="h-2.5 w-56" />
              </div>
              <Skeleton className="h-7 w-20 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Chart + Table Skeleton ────────────────────────────────── */

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-3 w-24 mb-2" />
        <Skeleton className="h-7 w-40" />
      </div>
      <KpiRowSkeleton count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] ">
            <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
              <Skeleton className="h-3.5 w-28 bg-white/20" />
            </div>
            <div className="p-5">
              <Skeleton className="h-52 w-full" />
            </div>
          </div>
        ))}
      </div>
      <TableSkeleton rows={5} cols={6} />
    </div>
  );
}

/* ── Data Room Skeleton ────────────────────────────────────── */

export function DataRoomSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-7 w-32" />
      </div>
      <KpiRowSkeleton count={3} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
            <div className="flex items-start gap-3 mb-3">
              <Skeleton className="size-10 shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1.5" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
            <Skeleton className="h-2.5 w-full mb-2" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Settings Skeleton ─────────────────────────────────────── */

export function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-7 w-28" />
      </div>
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-6">
        <div className="space-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-2.5 w-24 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}

/* ── Partner Card Skeleton ─────────────────────────────────── */

export function PartnerSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="size-12 shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-28 mb-1.5" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
          <Skeleton className="h-2.5 w-full mb-2" />
          <Skeleton className="h-2.5 w-full mb-2" />
          <Skeleton className="h-2.5 w-2/3 mb-4" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Engagement List Skeleton ──────────────────────────────── */

export function EngagementSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 shrink-0" />
              <div>
                <Skeleton className="h-4 w-36 mb-1.5" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-2.5 w-full mb-2" />
          <Skeleton className="h-2.5 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/* ── Profile Detail Skeleton ───────────────────────────────── */

export function ProfileDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 shrink-0" />
        <div>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-3 w-32 mb-1" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      </div>
      {/* KPI strip */}
      <KpiRowSkeleton count={4} />
      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
              <Skeleton className="h-3.5 w-28 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
            <Skeleton className="h-3.5 w-20 mb-3" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── KPI Bar Skeleton (alias for KpiRowSkeleton) ───────────── */

export function KpiBarSkeleton({ count = 4 }: { count?: number }) {
  return <KpiRowSkeleton count={count} />;
}

/* ── Tracker Table Skeleton ────────────────────────────────── */

export function TrackerTableSkeleton({ rows = 5 }: { rows?: number }) {
  return <TableSkeleton rows={rows} cols={6} />;
}

/* ── Analysis Report Skeleton ──────────────────────────────── */

export function AnalysisReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
        <Skeleton className="h-4 w-48 mb-4" />
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-3/4 mb-2" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
  );
}

/* ── Inspector Skeleton ────────────────────────────────────── */

export function InspectorSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-5">
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-3 w-full mb-1.5" />
                <Skeleton className="h-2.5 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Team Page Skeleton ────────────────────────────────────── */

export function TeamPageSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-7 w-32" />
      </div>
      <KpiRowSkeleton count={3} />
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
}

/* ── Team Table Skeleton ───────────────────────────────────── */

export function TeamTableSkeleton({ rows = 5 }: { rows?: number }) {
  return <TableSkeleton rows={rows} cols={5} />;
}

/* ── Invite Table Skeleton ─────────────────────────────────── */

export function InviteTableSkeleton({ rows = 4 }: { rows?: number }) {
  return <TableSkeleton rows={rows} cols={4} />;
}

/* ── History Table Skeleton ────────────────────────────────── */

export function HistoryTableSkeleton({ rows = 5 }: { rows?: number }) {
  return <TableSkeleton rows={rows} cols={4} />;
}
