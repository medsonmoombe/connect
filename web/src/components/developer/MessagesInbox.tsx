'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Engagement } from '@/types';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { getCounterpartyLabel } from '@/lib/role-labels';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  INTRO_SENT:        { label: 'Intro Sent',     color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
  INTRO_ACCEPTED:    { label: 'Accepted',        color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
  NDA_SIGNED:        { label: 'NDA Signed',      color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-100' },
  DUE_DILIGENCE:     { label: 'Due Diligence',   color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100' },
  TERM_SHEET:        { label: 'Term Sheet',      color: 'text-cyan-600',    bg: 'bg-cyan-50',    border: 'border-cyan-100' },
  CONTRACT_SIGNED:   { label: 'Contract Signed', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  CAPITAL_COMMITTED: { label: 'Committed',       color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  CLOSED:            { label: 'Closed',          color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  DROPPED:           { label: 'Dropped',         color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-100' },
};

export function MessagesInbox({
  engagements,
  loading,
  unreadByEngagement,
}: {
  engagements: Engagement[];
  loading: boolean;
  unreadByEngagement?: Record<string, number>;
}) {
  const [selectedEngagement, setSelectedEngagement] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'capital' | 'technical'>('all');

  const sorted = useMemo(() => {
    return [...engagements]
      .filter((e) => {
        if (filterType === 'capital' && e.counterparty_type !== 'CAPITAL') return false;
        if (filterType === 'technical' && e.counterparty_type !== 'TECHNICAL') return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            e.project?.name?.toLowerCase().includes(q) ||
            e.counterparty_type?.toLowerCase().includes(q) ||
            e.status?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        // Unread first, then by date
        const aUnread = unreadByEngagement?.[a.id] ?? 0;
        const bUnread = unreadByEngagement?.[b.id] ?? 0;
        if (aUnread > 0 && bUnread === 0) return -1;
        if (aUnread === 0 && bUnread > 0) return 1;
        return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
      });
  }, [engagements, filterType, searchQuery, unreadByEngagement]);

  const selectedEng = engagements.find((e) => e.id === selectedEngagement);

  if (loading) {
    return (
      <div className="py-8 text-center bg-white rounded-none border border-slate-100">
        <Icons.spinner className="size-5 animate-spin mx-auto text-primary mb-2" />
        <p className="text-[11px] font-bold text-slate-400">Loading messages...</p>
      </div>
    );
  }

  const totalUnread = unreadByEngagement
    ? Object.values(unreadByEngagement).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="dash-section-label mb-1">Comms</p>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Messages</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {totalUnread > 0 ? `${totalUnread} unread message${totalUnread > 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Conversation List */}
        <div className="lg:col-span-2 space-y-3">
          {/* Search + Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full pl-9 pr-3 rounded-none border border-slate-200 text-sm bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-none p-1">
              {(['all', 'capital', 'technical'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={cn(
                    'px-3 py-1.5 rounded-none text-[10px] font-bold tracking-widest transition-all capitalize',
                    filterType === type
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  {type === 'all' ? 'All' : type === 'capital' ? 'Investors' : 'EPCs'}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Cards */}
          {sorted.length > 0 ? (
            <div className="space-y-2">
              {sorted.map((eng) => {
                const st = STATUS_CONFIG[eng.status] || STATUS_CONFIG.INTRO_SENT;
                const unread = unreadByEngagement?.[eng.id] ?? 0;
                const isNew = eng.status === 'INTRO_SENT';
                const isSelected = selectedEngagement === eng.id;
                const date = new Date(eng.updated_at || eng.created_at);
                const now = new Date();
                const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
                const diffDays = Math.round(
                  (startOfDay(now).getTime() - startOfDay(date).getTime()) / (1000 * 60 * 60 * 24)
                );
                const timeLabel = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : `${diffDays}d ago`;

                return (
                  <button
                    key={eng.id}
                    onClick={() => setSelectedEngagement(eng.id)}
                    className={cn(
                      'w-full p-4 rounded-none border transition-all text-left',
                      isSelected
                        ? 'bg-primary/5 border-primary/20 shadow-sm'
                        : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm',
                      unread > 0 && 'ring-1 ring-primary/10'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className={cn(
                        'size-10 rounded-none flex items-center justify-center shrink-0 border transition-colors',
                        isSelected
                          ? 'bg-primary text-white border-primary'
                          : 'bg-slate-50 text-slate-400 border-slate-100'
                      )}>
                        {eng.counterparty_type === 'CAPITAL' ? (
                          <Icons.dollarSign className="size-4" />
                        ) : (
                          <Icons.wrench className="size-4" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <h4 className={cn(
                            'text-sm font-bold truncate',
                            unread > 0 ? 'text-slate-900' : 'text-slate-700'
                          )}>
                            {eng.project?.name || 'Project'}
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400 tracking-wider shrink-0">
                            {timeLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 tracking-wider truncate">
                            {getCounterpartyLabel(eng.counterparty_type)}
                          </span>
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider border shrink-0',
                            st.bg, st.color, st.border
                          )}>
                            {st.label}
                          </span>
                          {unread > 0 && (
                            <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[8px] font-black shrink-0">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center bg-white rounded-none border border-dashed border-slate-200">
              <Icons.messageSquare className="size-8 text-slate-200 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700 mb-1">No Conversations</h4>
              <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
                {searchQuery || filterType !== 'all'
                  ? 'Try adjusting your search or filter.'
                  : 'Your engagement conversations will appear here once partners express interest.'}
              </p>
            </div>
          )}
        </div>

        {/* Context Panel */}
        <div className="space-y-4">
          {selectedEng ? (
            <>
              {/* Project Context */}
              <div className="bg-white rounded-none border border-slate-100 shadow-soft p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icons.info className="size-4 text-slate-500" />
                  <h4 className="text-xs font-bold text-slate-900">Project Context</h4>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider">Project</p>
                    <Link
                      href={`/projects/${selectedEng.project_id}`}
                      className="text-sm font-bold text-primary hover:underline"
                    >
                      {selectedEng.project?.name || 'View Project'}
                    </Link>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider">Partner Type</p>
                    <p className="text-sm font-bold text-slate-700">
                      {getCounterpartyLabel(selectedEng.counterparty_type)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider">Status</p>
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider border',
                      STATUS_CONFIG[selectedEng.status]?.bg,
                      STATUS_CONFIG[selectedEng.status]?.color,
                      STATUS_CONFIG[selectedEng.status]?.border
                    )}>
                      {STATUS_CONFIG[selectedEng.status]?.label || selectedEng.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider">Created</p>
                    <p className="text-sm font-bold text-slate-700">
                      {new Date(selectedEng.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="bg-white rounded-none border border-slate-100 shadow-soft overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50">
                  <h4 className="text-xs font-bold text-slate-900">Actions</h4>
                </div>
                <div className="p-4 space-y-2">
                  <Link
                    href={`/engagements/${selectedEng.id}`}
                    className="flex items-center gap-3 p-3 rounded-none hover:bg-slate-50 transition-colors group"
                  >
                    <div className="size-8 rounded-none bg-blue-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Icons.messageSquare className="size-4 text-blue-600" />
                    </div>
                    <span className="text-xs font-bold text-slate-700 group-hover:text-primary transition-colors">
                      Open Conversation
                    </span>
                  </Link>
                  <Link
                    href={`/projects/${selectedEng.project_id}`}
                    className="flex items-center gap-3 p-3 rounded-none hover:bg-slate-50 transition-colors group"
                  >
                    <div className="size-8 rounded-none bg-amber-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Icons.eye className="size-4 text-amber-600" />
                    </div>
                    <span className="text-xs font-bold text-slate-700 group-hover:text-primary transition-colors">
                      View Project Details
                    </span>
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-none border border-dashed border-slate-200 p-8 text-center">
              <Icons.messageSquare className="size-8 text-slate-200 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700 mb-1">Select a Conversation</h4>
              <p className="text-xs text-slate-400 font-medium">
                Click on a conversation to see project context and actions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
