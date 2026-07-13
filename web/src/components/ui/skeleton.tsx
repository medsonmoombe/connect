// ─── Base primitive ───────────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />
  );
}

// ─── KPI bar (4 stat cards) ───────────────────────────────────────────────────

export function KpiBarSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

// ─── Tracker table rows ───────────────────────────────────────────────────────

export function TrackerTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* header bar */}
      <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-48 rounded-xl" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 sm:px-6 py-3 flex items-center gap-4">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-2.5 w-32" />
            </div>
            {/* milestone dots */}
            <div className="flex gap-1">
              {Array.from({ length: 9 }).map((_, j) => (
                <Skeleton key={j} className="size-2 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Analysis report panel (dark card) ───────────────────────────────────────

export function AnalysisReportSkeleton() {
  return (
    <div className="bg-gradient-to-br from-green-900 to-slate-900 rounded-3xl p-5 sm:p-8 space-y-6 shadow-xl">
      {/* header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="size-9 rounded-xl bg-white/10 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-48 rounded-lg bg-white/20 animate-pulse" />
            <div className="h-2.5 w-32 rounded-lg bg-white/10 animate-pulse" />
          </div>
        </div>
        {/* score box */}
        <div className="bg-white/10 rounded-xl px-5 py-3 space-y-1.5 shrink-0 animate-pulse">
          <div className="h-8 w-12 rounded-lg bg-white/20 mx-auto" />
          <div className="h-2 w-10 rounded bg-white/10 mx-auto" />
        </div>
      </div>

      {/* summary lines */}
      <div className="space-y-2">
        <div className="h-3 rounded bg-white/10 animate-pulse w-full" />
        <div className="h-3 rounded bg-white/10 animate-pulse w-5/6" />
        <div className="h-3 rounded bg-white/10 animate-pulse w-4/6" />
      </div>

      {/* market context cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/10 pt-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-2 animate-pulse">
            <div className="h-2 w-20 rounded bg-white/20" />
            <div className="h-2.5 w-full rounded bg-white/10" />
            <div className="h-2.5 w-4/5 rounded bg-white/10" />
          </div>
        ))}
      </div>

      {/* tab strip */}
      <div className="border-t border-white/10 pt-5 space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-7 w-20 rounded-xl bg-white/10 animate-pulse" />
          ))}
        </div>
        {/* risk cards */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3 animate-pulse">
              <div className="flex justify-between">
                <div className="h-3.5 w-40 rounded bg-white/20" />
                <div className="h-5 w-20 rounded-full bg-white/10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="h-2 w-16 rounded bg-white/10" />
                  <div className="h-2.5 w-full rounded bg-white/10" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 w-12 rounded bg-white/10" />
                  <div className="h-2.5 w-full rounded bg-white/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Project inspector panel ──────────────────────────────────────────────────

export function InspectorSkeleton() {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-5">
      <div className="space-y-1.5">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-b border-slate-100 py-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-2 w-10" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      {/* milestone grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-xl" />
        ))}
      </div>
      {/* summary block */}
      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-2">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    </div>
  );
}

// ─── History drawer table rows ────────────────────────────────────────────────

export function HistoryTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Skeleton className="size-4 rounded shrink-0" />
            <Skeleton className="h-3.5 w-36" />
          </div>
          <Skeleton className="h-3.5 w-6" />
          <Skeleton className="h-4 w-14 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-2.5 w-16" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-7 w-12 rounded-lg" />
            <Skeleton className="h-7 w-12 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Team members table skeleton ─────────────────────────────────────────────

export function TeamTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-5 py-3.5 flex items-center gap-4">
          {/* member avatar + name */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Skeleton className="size-8 rounded-lg shrink-0" />
            <div className="space-y-1.5 min-w-0">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-2.5 w-40" />
            </div>
          </div>
          {/* role badge */}
          <Skeleton className="h-4 w-14 rounded-full" />
          {/* status badge */}
          <Skeleton className="h-4 w-16 rounded-full" />
          {/* joined date */}
          <Skeleton className="h-3.5 w-20" />
          {/* actions */}
          <Skeleton className="size-7 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ─── Pending invite table skeleton ───────────────────────────────────────────

export function InviteTableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-5 py-3.5 flex items-center gap-4">
          {/* email */}
          <Skeleton className="h-3.5 w-44 flex-1" />
          {/* role */}
          <Skeleton className="h-3.5 w-14" />
          {/* expires */}
          <Skeleton className="h-3.5 w-20" />
          {/* actions */}
          <Skeleton className="size-7 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ─── Full team page skeleton ─────────────────────────────────────────────────

export function TeamPageSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-9 w-36 rounded-xl" />
      </div>

      {/* invite form card */}
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 space-y-1">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-2.5 w-52" />
        </div>
        <div className="p-6">
          <div className="flex gap-3">
            <Skeleton className="h-11 flex-1 rounded-xl" />
            <Skeleton className="h-11 w-24 rounded-xl" />
          </div>
        </div>
      </div>

      {/* members table card */}
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
        <TeamTableSkeleton rows={5} />
      </div>
    </div>
  );
}
