'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/dashboard-cards';
import { getStateLabel, getStateProgress } from '@/lib/engagement';
import { useConsultantData } from '@/hooks/useConsultantData';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';

const cardClass = 'rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]';

type StatusFilter = 'ALL' | 'ACTIVE' | 'COMMITTED' | 'CLOSED' | 'DROPPED';

export default function ConsultantPortfolioPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useConsultantData({ engagements: true });
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'CONSULTANT' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.engagements
      .filter(e => {
        if (filter === 'ACTIVE') {
          if (['CLOSED', 'DROPPED'].includes(e.status)) return false;
        } else if (filter !== 'ALL' && e.status !== filter) {
          return false;
        }
        if (!q) return true;
        const hay = `${e.project?.name || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
  }, [data.engagements, filter, search]);

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  const committed = data.engagements.filter(e => e.status === 'CAPITAL_COMMITTED').length;
  const closed = data.engagements.filter(e => e.status === 'CLOSED').length;

  const FILTERS: { id: StatusFilter; label: string }[] = [
    { id: 'ALL', label: `All (${data.engagements.length})` },
    { id: 'ACTIVE', label: `Active (${data.activeEngagements.length})` },
    { id: 'COMMITTED', label: `Committed (${committed})` },
    { id: 'CLOSED', label: `Closed (${closed})` },
    { id: 'DROPPED', label: `Dropped (${data.engagements.filter(e => e.status === 'DROPPED').length})` },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Advisory Portfolio" />
      <PageHero
        eyebrow="Portfolio"
        title="Your advisory engagements"
        description="Every mandate you're advising on, from introduction through contract — with live stage progress for each."
      />

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Engagements', value: data.engagements.length },
          { label: 'Active Pipeline', value: data.activeEngagements.length },
          { label: 'Committed', value: committed },
          { label: 'Completed', value: closed },
        ].map(k => (
          <div key={k.label} className={cn(cardClass, 'p-4')}>
            <p className="text-xl font-bold text-slate-950 tracking-tight">{k.value}</p>
            <p className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs + search */}
      <div className={cn(cardClass, 'flex flex-wrap items-center gap-3 p-3')}>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'h-8 border px-3 text-[11px] font-bold transition-colors',
                filter === f.id
                  ? 'border-[#0b3b24] bg-[#0b3b24] text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto min-w-52 flex-1 md:max-w-xs">
          <Icons.search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by project name…"
            className="h-9 w-full rounded-none border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-medium text-slate-900 transition-colors placeholder:text-slate-400 focus:border-[#052e1a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e1a]/8"
          />
        </div>
      </div>

      {/* Engagement list */}
      {data.loadingEngagements ? (
        <div className={cn(cardClass, 'p-8 text-center')}><Icons.spinner className="size-5 animate-spin mx-auto text-[#0b3b24]" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="briefcase"
          title={search || filter !== 'ALL' ? 'No engagements for these filters' : 'No Engagements'}
          description={
            search || filter !== 'ALL'
              ? 'Try clearing the search or choosing a different status.'
              : "You don't have any engagements in progress. Start by exploring the marketplace."
          }
          actionLabel={search || filter !== 'ALL' ? undefined : 'Explore Marketplace'}
          actionHref="/consultant/marketplace"
        />
      ) : (
        <div className={cn(cardClass, 'overflow-hidden')}>
          <div className="divide-y divide-slate-100">
            {filtered.map(eng => {
              const progress = getStateProgress(eng.status);
              return (
                <div key={eng.id} className="px-6 py-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-bold text-slate-900">{eng.project?.name || 'Project'}</h4>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Updated {new Date(eng.updated_at || eng.created_at).toLocaleDateString()} · {getStateLabel(eng.status)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={eng.status} />
                      <Link href={`/engagements/${eng.id}`}>
                        <button className="inline-flex h-8 items-center rounded-none border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50">
                          Open
                        </button>
                      </Link>
                    </div>
                  </div>
                  {/* Stage progress */}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-none bg-slate-100">
                      <div
                        className={cn('h-full rounded-none transition-all', eng.status === 'DROPPED' ? 'bg-rose-400' : 'bg-[#0b3b24]')}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
