'use client';

import { useEffect, useMemo, useState } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { EmptyState } from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { getStateLabel } from '@/lib/engagement';
import { useGrantData } from '@/hooks/useGrantData';
import { EngagementStatus } from '@/types';

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active pipeline' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'DROPPED', label: 'Dropped' },
] as const;

function statusChipClass(status: string): string {
  if (status === 'CLOSED') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'DROPPED') return 'bg-red-50 text-red-600 border-red-200';
  if (status.includes('COMMITTED') || status.includes('CONTRACT')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status.includes('NDA') || status.includes('DUE')) return 'bg-violet-50 text-violet-700 border-violet-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

export default function GrantPortfolioPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useGrantData({ engagements: true });
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]['value']>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'GRANT_PROVIDER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  const filtered = useMemo(() => {
    let list = [...data.engagements];
    if (filter === 'ACTIVE') list = list.filter(e => !['CLOSED', 'DROPPED'].includes(e.status));
    else if (filter !== 'ALL') list = list.filter(e => e.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.project?.name?.toLowerCase().includes(q) || e.project?.location_country?.toLowerCase().includes(q));
    }
    return list.sort((a, b) =>
      new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    );
  }, [data.engagements, filter, search]);

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  const committed = data.engagements.filter(e => ['CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'].includes(e.status)).length;
  const dropped = data.engagements.filter(e => e.status === 'DROPPED').length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Funded Projects" />
      <PageHero
        eyebrow="Grant Portfolio"
        title="Your funding pipeline"
        description="Every engagement from first introduction through disbursement — track each deal's stage and jump back into the conversation."
        actions={
          <Link href="/grant/marketplace">

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}
            <Button className="h-9 px-4 bg-white text-[#0b3b24] hover:bg-emerald-50 border border-emerald-200/40" icon={<Icons.search className="size-4" />

      }>
              Find new projects
            </Button>
          </Link>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total engagements', value: data.engagements.length, icon: Icons.briefcase, accent: 'text-slate-900', tile: 'bg-slate-100 text-slate-600' },
          { label: 'Active pipeline', value: data.activeEngagements.length, icon: Icons.activity, accent: 'text-[#166b3b]', tile: 'bg-[#e9f6ee] text-[#166b3b]' },
          { label: 'Committed / closed', value: committed, icon: Icons.checkCircle2, accent: 'text-emerald-700', tile: 'bg-emerald-50 text-emerald-600' },
          { label: 'Dropped', value: dropped, icon: Icons.close, accent: 'text-red-600', tile: 'bg-red-50 text-red-500' },
        ].map(({ label, value, icon: Icon, accent, tile }) => (
          <div key={label} className="rounded-none border border-line bg-white p-4 shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className={cn('mb-2.5 grid size-8 place-items-center rounded-none', tile)}>
              <Icon className="size-4" />
            </div>
            <p className={cn('text-xl font-black tracking-tight', accent)}>{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      {data.engagements.length > 0 && (
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-4 flex flex-col sm:flex-row gap-3">
          <div className="flex rounded-none border border-slate-200 overflow-hidden">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'px-3.5 h-9 text-[11px] font-bold transition-colors border-r border-slate-200 last:border-r-0',
                  filter === f.value ? 'bg-[#0b3b24] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search engagements…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-[#0b3b24]"
            />
          </div>
        </div>
      )}

      {/* Engagement list */}
      {data.loadingEngagements ? (
        <div className="p-10 text-center"><Icons.spinner className="size-5 animate-spin mx-auto text-slate-300" /></div>
      ) : data.engagements.length === 0 ? (
        <EmptyState
          icon="briefcase"
          title="No Funded Projects Yet"
          description="Start by exploring matched projects in the marketplace and expressing interest."
          actionLabel="Browse Matches"
          onAction={() => router.push('/grant/marketplace')}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon="search" title="No engagements match" description="Adjust your filters to see more of your pipeline." />
      ) : (
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filtered.map((eng) => {
              const updated = eng.updated_at || eng.created_at;
              return (
                <Link key={eng.id} href={`/engagements/${eng.id}`} className="block">
                  <div className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                    <div className="size-10 rounded-none bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                      <Icons.fileText className="size-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{eng.project?.name || 'Project'}</p>
                      <p className="text-[10px] font-bold text-slate-400 tracking-wider mt-0.5">
                        {eng.project?.technology_type?.replace(/_/g, ' ')} · {eng.project?.project_size_mw} MW · {eng.project?.location_country}
                      </p>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Updated</p>
                      <p className="text-xs font-bold text-slate-600">
                        {new Date(updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className={cn('inline-flex items-center border px-2 py-0.5 text-[10px] font-bold shrink-0', statusChipClass(eng.status))}>
                      {getStateLabel(eng.status)}
                    </span>
                    <Icons.chevronRight className="size-4 text-slate-300 shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
