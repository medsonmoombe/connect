'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { firstErrorMessage } from '@/lib/section-errors';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import PageTitle from '@/components/PageTitle';
import { PageHero } from '@/components/ui/PageHero';
import { useTechnicalData } from '@/hooks/useTechnicalData';
import { EngagementStatus } from '@/types';

const STATUS_META: Record<string, { label: string; chip: string; dot: string; group: 'active' | 'closed' }> = {
  INTRO_SENT: { label: 'Introduction sent', chip: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', group: 'active' },
  INTRO_ACCEPTED: { label: 'Introduction accepted', chip: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', group: 'active' },
  NDA_SIGNED: { label: 'NDA signed', chip: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500', group: 'active' },
  DUE_DILIGENCE: { label: 'Due diligence', chip: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500', group: 'active' },
  TERM_SHEET: { label: 'Term sheet', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500', group: 'active' },
  CONTRACT_SIGNED: { label: 'Contract signed', chip: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500', group: 'active' },
  CAPITAL_COMMITTED: { label: 'Capital committed', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', group: 'active' },
  CLOSED: { label: 'Closed', chip: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-600', group: 'closed' },
  DROPPED: { label: 'Dropped', chip: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500', group: 'closed' },
};

export default function TechnicalPortfolioPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const data = useTechnicalData({ engagements: true });

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'TECHNICAL_PARTNER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="mx-auto w-full max-w-6xl p-6"><DashboardSkeleton /></div>;
  }

  const engagements = [...data.engagements].sort(
    (a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime()
  );
  const active = engagements.filter(e => STATUS_META[e.status]?.group === 'active');
  const closed = engagements.filter(e => STATUS_META[e.status]?.group === 'closed');
  const delivered = data.techProfile?.total_mw_delivered || 0;

  const groups = [
    { key: 'active', label: 'Active pipeline', items: active, icon: Icons.activity, accent: 'text-[#166b3b]' },
    { key: 'closed', label: 'Completed & closed', items: closed, icon: Icons.checkCircle2, accent: 'text-slate-500' },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-500">
      <PageTitle title="Project Portfolio" />
      <PageHero
        eyebrow="Delivery Pipeline"
        title="Your engagements, end to end"
        description="Every introduction, contract, and delivery your company has on the platform — grouped by pipeline stage."
      />

      {data.errors && (
        <ErrorState
          message={firstErrorMessage(data.errors)}
          onRetry={() => void data.forceRefresh()}
        />
      )}

      

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total engagements', value: engagements.length, icon: Icons.briefcase, tile: 'bg-slate-100 text-slate-600', accent: 'text-slate-900' },
          { label: 'Active pipeline', value: active.length, icon: Icons.activity, tile: 'bg-[#e9f6ee] text-[#166b3b]', accent: 'text-[#166b3b]' },
          { label: 'Contracts signed', value: engagements.filter(e => ['CONTRACT_SIGNED', 'CAPITAL_COMMITTED'].includes(e.status)).length, icon: Icons.clipboardCheck, tile: 'bg-teal-50 text-teal-600', accent: 'text-teal-700' },
          { label: 'MW delivered', value: `${delivered}`, icon: Icons.zap, tile: 'bg-amber-50 text-amber-600', accent: 'text-amber-700' },
        ].map(({ label, value, icon: Icon, tile, accent }) => (
          <div key={label} className="rounded-none border border-line bg-white p-4 shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className={cn('mb-2.5 grid size-8 place-items-center rounded-none', tile)}>
              <Icon className="size-4" />
            </div>
            <p className={cn('text-xl font-black tracking-tight', accent)}>{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {engagements.length === 0 ? (
        <div className="rounded-none border border-line bg-white p-12 text-center shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <Icons.briefcase className="size-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">No engagements yet</p>
          <p className="text-xs text-slate-400 mt-1">Start by exploring the marketplace for projects that need your expertise.</p>
          <Link href="/technical/marketplace" className="mt-4 inline-flex h-9 items-center gap-2 rounded-none bg-[#0b3b24] px-4 text-[11px] font-bold text-white hover:bg-[#0d4a2e]">
            <Icons.search className="size-3.5" /> Explore marketplace
          </Link>
        </div>
      ) : (
        groups.map(({ key, label, items, icon: Icon, accent }) => items.length > 0 && (
          <div key={key} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className={cn('size-4', accent)} />
              <p className="text-sm font-bold text-slate-900">{label}</p>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-black text-slate-500">{items.length}</span>
            </div>
            <div className="space-y-3">
              {items.map(eng => {
                const meta = STATUS_META[eng.status];
                return (
                  <Link key={eng.id} href={`/engagements/${eng.id}`}>
                    <div className="p-5 rounded-none bg-white border border-line shadow-[0_1px_2px_rgba(22,36,28,0.05)] hover:shadow-lg transition-all flex items-center gap-4 group">
                      <div className="size-11 rounded-none bg-[#f4f6f5] border border-slate-100 flex items-center justify-center text-[#166b3b] shrink-0">
                        <Icons.zap className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 group-hover:text-[#166b3b] transition-colors truncate">{eng.project?.name || 'Project'}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                          <span>{eng.project?.technology_type?.replace(/_/g, ' ')}</span>
                          {eng.project?.project_size_mw ? <span>· {eng.project.project_size_mw} MW</span> : null}
                          <span>· Started {new Date(eng.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={cn('inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-bold', meta?.chip)}>
                          <span className={cn('size-1.5 rounded-full', meta?.dot)} />
                          {meta?.label ?? eng.status}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1.5">
                          Updated {new Date(eng.updated_at ?? eng.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <Icons.chevronRight className="size-4 text-slate-300 group-hover:text-[#166b3b] transition-colors shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
