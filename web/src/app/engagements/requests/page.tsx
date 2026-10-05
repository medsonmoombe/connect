'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { engagementService, getStateLabel, getStateProgress } from '@/lib/engagement';
import { Engagement } from '@/types';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { EngagementSkeleton } from '@/components/ui/skeleton';

const REQUEST_TYPE_CONFIG: Record<string, { label: string; tone: string }> = {
  quote:        { label: 'Quote Request',   tone: 'bg-blue-50 text-blue-700 border-blue-100' },
  meeting:      { label: 'Meeting Request', tone: 'bg-violet-50 text-violet-700 border-violet-100' },
  introduction: { label: 'Introduction',    tone: 'bg-green-50 text-green-700 border-green-100' },
};

const STATUS_TONE: Record<string, string> = {
  INTRO_SENT:        'bg-amber-50 text-amber-700 border-amber-100',
  INTRO_ACCEPTED:    'bg-blue-50 text-blue-700 border-blue-100',
  NDA_SIGNED:        'bg-indigo-50 text-indigo-700 border-indigo-100',
  DUE_DILIGENCE:     'bg-violet-50 text-violet-700 border-violet-100',
  TERM_SHEET:        'bg-cyan-50 text-cyan-700 border-cyan-100',
  CONTRACT_SIGNED:   'bg-emerald-50 text-emerald-700 border-emerald-100',
  CAPITAL_COMMITTED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  CLOSED:            'bg-emerald-50 text-emerald-700 border-emerald-100',
  DROPPED:           'bg-red-50 text-red-600 border-red-100',
};

const COUNTERPARTY_LABELS: Record<string, string> = {
  CAPITAL:        'Capital Partner',
  TECHNICAL:      'Technical Partner',
  CONSULTANT:     'Consultant',
  GRANT_PROVIDER: 'Grant Provider',
};

type FilterStatus = 'all' | 'pending' | 'active' | 'closed';

function filterEngagements(engagements: Engagement[], filter: FilterStatus) {
  if (filter === 'all') return engagements;
  if (filter === 'pending') return engagements.filter(e => e.status === 'INTRO_SENT');
  if (filter === 'active') return engagements.filter(e =>
    ['INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED'].includes(e.status)
  );
  if (filter === 'closed') return engagements.filter(e => ['CLOSED', 'DROPPED'].includes(e.status));
  return engagements;
}

export default function IncomingRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');

  useEffect(() => {
    if (!user?.company_id) { setLoading(false); return; }
    engagementService.getCompanyEngagements(user.company_id)
      .then(setEngagements)
      .finally(() => setLoading(false));
  }, [user?.company_id]);

  if (authLoading || loading) {
    return <div className="p-6"><EngagementSkeleton /></div>;
  }

  const filtered = filterEngagements(engagements, filter);
  const pendingCount = engagements.filter(e => e.status === 'INTRO_SENT').length;
  const activeCount = engagements.filter(e =>
    ['INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED'].includes(e.status)
  ).length;
  const closedCount = engagements.filter(e => ['CLOSED', 'DROPPED'].includes(e.status)).length;

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <p className="dash-section-label mb-1">Workspace</p>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Incoming Requests</h2>
        <p className="text-sm text-slate-500 font-medium mt-1">
          All engagement requests and partner interactions
        </p>
      </div>

      {/* Sibling nav */}
      <div className="flex items-center gap-1 border-b border-slate-100 pb-0">
        <Link
          href="/engagements"
          className="inline-flex items-center gap-1.5 h-9 px-4 text-[10px] font-bold tracking-wider text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-200 transition-all"
        >
          <Icons.messageSquare className="size-3" /> My Engagements
        </Link>
        <Link
          href="/engagements/requests"
          className="inline-flex items-center gap-1.5 h-9 px-4 text-[10px] font-bold tracking-wider text-green-800 border-b-2 border-green-800 transition-all"
        >
          <Icons.bell className="size-3" /> Incoming Requests
          {pendingCount > 0 && (
            <span className="size-4 rounded-full bg-green-800 text-white text-[9px] font-black flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',   value: engagements.length, icon: 'layers' as const,      tone: 'text-slate-700' },
          { label: 'Pending', value: pendingCount,        icon: 'clock' as const,       tone: 'text-amber-600' },
          { label: 'Active',  value: activeCount,         icon: 'zap' as const,         tone: 'text-blue-600' },
          { label: 'Closed',  value: closedCount,         icon: 'check' as const,       tone: 'text-emerald-600' },
        ].map(({ label, value, icon, tone }) => {
          const Icon = Icons[icon];
          return (
            <div key={label} className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
                <Icon className={cn('size-3.5', tone)} />
              </div>
              <p className={cn('text-2xl font-black', tone)}>{value}</p>
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-4 flex items-center gap-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Filter</p>
        {(['all', 'pending', 'active', 'closed'] as FilterStatus[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'h-7 px-3 rounded-none text-[10px] font-bold tracking-wider transition-all capitalize',
              filter === f
                ? 'bg-[#0b3b24] text-white'
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Requests list */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-slate-200 bg-white py-16 text-center">
          <Icons.bell className="size-8 text-slate-200 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-700 mb-1">No Requests Found</h4>
          <p className="text-xs text-slate-400 font-medium">
            {filter === 'all'
              ? 'No engagement requests yet. They will appear here when partners reach out or you send requests.'
              : `No ${filter} requests.`}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          {/* Table header */}
          <div className="bg-[#0b3b24] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icons.bell className="size-4 text-emerald-200" />
              <p className="text-[10px] font-bold text-white uppercase tracking-widest">
                {filtered.length} Request{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
            <p className="text-[10px] text-emerald-200/60 font-medium">Click any row to open the engagement room</p>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_140px_140px_120px_80px] gap-4 px-6 py-2.5 border-b border-slate-100 bg-slate-50">
            {['Project', 'Partner Type', 'Request Type', 'Status', 'Progress'].map(col => (
              <p key={col} className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{col}</p>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-50">
            {filtered.map((eng) => {
              const reqType = (eng as any).request_type as string | undefined;
              const rtConfig = REQUEST_TYPE_CONFIG[reqType ?? 'introduction'] ?? REQUEST_TYPE_CONFIG.introduction;
              const statusTone = STATUS_TONE[eng.status] ?? STATUS_TONE.INTRO_SENT;
              const progress = getStateProgress(eng.status as any);
              const partnerLabel = COUNTERPARTY_LABELS[eng.counterparty_type] ?? eng.counterparty_type;

              return (
                <Link
                  key={eng.id}
                  href={`/engagements/${eng.id}`}
                  className="grid grid-cols-[1fr_140px_140px_120px_80px] gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group items-center"
                >
                  {/* Project */}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-green-800 transition-colors">
                      {eng.project?.name || 'Unknown Project'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {new Date(eng.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Partner type */}
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600">
                      <Icons.building className="size-2.5" />
                      {partnerLabel}
                    </span>
                  </div>

                  {/* Request type */}
                  <div>
                    <span className={cn('inline-flex items-center px-2 py-1 rounded-none border text-[10px] font-bold', rtConfig.tone)}>
                      {rtConfig.label}
                    </span>
                  </div>

                  {/* Status */}
                  <div>
                    <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-none border text-[10px] font-bold', statusTone)}>
                      <span className="size-1.5 rounded-full bg-current" />
                      {getStateLabel(eng.status as any)}
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-700 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 shrink-0">{progress}%</span>
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
