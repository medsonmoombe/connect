'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { engagementService, getStateLabel, getStateProgress } from '@/lib/engagement';
import { Engagement } from '@/types';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { EngagementSkeleton } from '@/components/ui/skeleton';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

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
  POWER_TRADER:   'Power Trader',
};

type FilterStatus = 'all' | 'pending' | 'active' | 'closed';
type PageView = 'deals' | 'messages';

function filterEngagements(engagements: Engagement[], filter: FilterStatus) {
  if (filter === 'pending') return engagements.filter(e => e.status === 'INTRO_SENT');
  if (filter === 'active') return engagements.filter(e =>
    ['INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED'].includes(e.status)
  );
  if (filter === 'closed') return engagements.filter(e => ['CLOSED', 'DROPPED'].includes(e.status));
  return engagements;
}

export default function EngagementsListPage() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [view, setView] = useState<PageView>(searchParams.get('view') === 'messages' ? 'messages' : 'deals');
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const { unreadByEngagement } = useUnreadMessages();

  useEffect(() => {
    if (!user?.company_id) { setLoading(false); return; }
    engagementService.getCompanyEngagements(user.company_id)
      .then(setEngagements)
      .finally(() => setLoading(false));
  }, [user?.company_id]);

  const filtered = useMemo(() => filterEngagements(engagements, filter), [engagements, filter]);
  const pendingCount = engagements.filter(e => e.status === 'INTRO_SENT').length;
  const activeCount   = engagements.filter(e =>
    ['INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED'].includes(e.status)
  ).length;
  const closedCount   = engagements.filter(e => ['CLOSED', 'DROPPED'].includes(e.status)).length;
  const totalUnread   = Object.values(unreadByEngagement ?? {}).reduce((a, b) => a + b, 0);

  // Conversations = engagements with recent activity, newest first
  const conversations = useMemo(() =>
    [...engagements].sort((a, b) =>
      new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    ),
  [engagements]);

  if (authLoading || loading) {
    return <div className="p-6"><EngagementSkeleton /></div>;
  }

  const switchView = (v: PageView) => setView(v);

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <p className="dash-section-label mb-1">Workspace</p>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Engagements</h2>
        <p className="text-sm text-slate-500 font-medium mt-1">
          {view === 'deals'
            ? 'All your deal rooms — track progress, open rooms, and manage partners.'
            : 'Every conversation, organised by deal — unread counts show what needs you.'}
        </p>
      </div>

      {/* Sibling nav */}
      <div className="flex items-center gap-1 border-b border-slate-100 pb-0">
        <Link
          href="/engagements"
          className="inline-flex items-center gap-1.5 h-9 px-4 text-[10px] font-bold tracking-wider text-green-800 border-b-2 border-green-800 transition-all"
        >
          <Icons.messageSquare className="size-3" /> My Engagements
          {totalUnread > 0 && (
            <span className="size-4 rounded-full bg-green-800 text-white text-[10px] font-black flex items-center justify-center">
              {totalUnread}
            </span>
          )}
        </Link>
        <Link
          href="/engagements/requests"
          className="inline-flex items-center gap-1.5 h-9 px-4 text-[10px] font-bold tracking-wider text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-200 transition-all"
        >
          <Icons.bell className="size-3" /> Incoming Requests
          {pendingCount > 0 && (
            <span className="size-4 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </Link>
      </div>

      {/* View toggle: Deals | Messages (messages merged from former per-portal pages) */}
      <div className="flex items-center gap-2">
        {([
          { id: 'deals' as PageView, label: 'Deals', icon: Icons.handshake, count: engagements.length },
          { id: 'messages' as PageView, label: 'Messages', icon: Icons.mail, count: totalUnread },
        ]).map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => switchView(id)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-none border px-4 text-[11px] font-bold transition-colors',
              view === id
                ? 'border-[#0b3b24] bg-[#0b3b24] text-white'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            )}
          >
            <Icon className="size-3.5" />
            {label}
            {count > 0 && (
              <span className={cn('px-1.5 text-[10px] font-black', view === id ? 'bg-white/15' : 'bg-slate-100')}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {view === 'messages' ? (
        /* ── Messages view: conversations grouped per deal ── */
        conversations.length === 0 ? (
          <div className="border border-dashed border-slate-200 bg-white py-16 text-center">
            <Icons.mail className="size-8 text-slate-200 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700 mb-1">No Conversations Yet</h4>
            <p className="text-xs text-slate-400 font-medium">
              Messages appear once you have engagements — start one from any project page.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className="bg-[#0b3b24] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icons.mail className="size-4 text-emerald-200" />
                <p className="text-[10px] font-bold text-white uppercase tracking-widest">
                  {conversations.length} Conversation{conversations.length !== 1 ? 's' : ''}
                </p>
              </div>
              {totalUnread > 0 && (
                <p className="text-[10px] text-emerald-200/80 font-bold">{totalUnread} unread message{totalUnread !== 1 ? 's' : ''}</p>
              )}
            </div>
            <div className="divide-y divide-slate-50">
              {conversations.map((eng) => {
                const unread = unreadByEngagement?.[eng.id] ?? 0;
                const counterpartyLabel = COUNTERPARTY_LABELS[eng.counterparty_type] ?? eng.counterparty_type;
                return (
                  <Link
                    key={eng.id}
                    href={`/engagements/${eng.id}`}
                    className={cn(
                      'flex items-center gap-4 px-6 py-4 transition-colors group',
                      unread > 0 ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-slate-50'
                    )}
                  >
                    <div className={cn(
                      'size-9 shrink-0 flex items-center justify-center border text-[11px] font-black',
                      unread > 0
                        ? 'bg-blue-100 border-blue-200 text-blue-700'
                        : 'bg-slate-100 border-slate-200 text-slate-600'
                    )}>
                      {(eng.counterparty_type || 'E').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate group-hover:text-green-800 transition-colors">
                        {eng.project?.name || 'Unknown Project'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                        <Icons.building className="size-2.5" />
                        {counterpartyLabel}
                        <span className="text-slate-300">·</span>
                        {getStateLabel(eng.status as any)}
                        <span className="text-slate-300">·</span>
                        {new Date(eng.updated_at || eng.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {unread > 0 ? (
                      <span className="size-5 rounded-full bg-green-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                        {unread}
                      </span>
                    ) : (
                      <Icons.chevronRight className="size-3.5 text-slate-300 group-hover:text-green-700 transition-colors shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )
      ) : (
        /* ── Deals view: the original engagements workspace ── */
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total',   value: engagements.length, icon: 'layers' as const, tone: 'text-slate-700' },
              { label: 'Pending', value: pendingCount,        icon: 'clock'  as const, tone: 'text-amber-600' },
              { label: 'Active',  value: activeCount,         icon: 'zap'    as const, tone: 'text-blue-600'  },
              { label: 'Closed',  value: closedCount,         icon: 'check'  as const, tone: 'text-emerald-600' },
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

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="border border-dashed border-slate-200 bg-white py-16 text-center">
              <Icons.messageSquare className="size-8 text-slate-200 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700 mb-1">No Engagements Found</h4>
              <p className="text-xs text-slate-400 font-medium">
                {filter === 'all'
                  ? 'When partners express interest or you reach out, engagements appear here.'
                  : `No ${filter} engagements.`}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">

              {/* Dark header */}
              <div className="bg-[#0b3b24] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icons.messageSquare className="size-4 text-emerald-200" />
                  <p className="text-[10px] font-bold text-white uppercase tracking-widest">
                    {filtered.length} Engagement{filtered.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <p className="text-[10px] text-emerald-200/60 font-medium">Click any row to open the engagement room</p>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[1fr_150px_130px_90px_36px] gap-4 px-6 py-2.5 border-b border-slate-100 bg-slate-50">
                {['Project', 'Partner Type', 'Status', 'Progress', ''].map((col, i) => (
                  <p key={i} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{col}</p>
                ))}
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-50">
                {filtered.map((eng) => {
                  const unread      = unreadByEngagement?.[eng.id] ?? 0;
                  const statusTone  = STATUS_TONE[eng.status] ?? STATUS_TONE.INTRO_SENT;
                  const progress    = getStateProgress(eng.status as any);
                  const partnerLabel = COUNTERPARTY_LABELS[eng.counterparty_type] ?? eng.counterparty_type;

                  return (
                    <Link
                      key={eng.id}
                      href={`/engagements/${eng.id}`}
                      className="grid grid-cols-[1fr_150px_130px_90px_36px] gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group items-center"
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
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">{progress}%</span>
                      </div>

                      {/* Unread / chevron */}
                      <div className="flex justify-end">
                        {unread > 0 ? (
                          <span className="size-5 rounded-full bg-green-600 text-white text-[10px] font-black flex items-center justify-center">
                            {unread}
                          </span>
                        ) : (
                          <Icons.chevronRight className="size-3.5 text-slate-300 group-hover:text-green-700 transition-colors" />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
