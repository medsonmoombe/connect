'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from '@/components/ui/drawer';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { engagementService } from '@/lib/engagement';
import { createClient } from '@/lib/supabase';
import { Icons } from '@/components/ui/icons';
import { getCounterpartyLabel } from '@/lib/role-labels';
import { cn } from '@/lib/utils';
import type { Engagement, Message } from '@/types';

interface MessagesDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface Conversation {
  engagementId: string;
  engagement: Engagement;
  lastMessage: Message | null;
  lastMessageAt: string;
  unread: number;
  counterpartyName: string;
  counterpartyType: 'CAPITAL' | 'TECHNICAL';
  senderName: string | null;
}

// ── Status → accent color, shared visual language with the rest of the dashboard ──
const STATUS_DOT: Record<string, string> = {
  INTRO_SENT:        'bg-blue-500',
  INTRO_ACCEPTED:    'bg-indigo-500',
  NDA_SIGNED:        'bg-violet-500',
  DUE_DILIGENCE:     'bg-amber-500',
  TERM_SHEET:        'bg-orange-500',
  CONTRACT_SIGNED:   'bg-emerald-500',
  CAPITAL_COMMITTED: 'bg-emerald-500',
  CLOSED:            'bg-emerald-600',
  DROPPED:           'bg-red-400',
};

const TYPE_STYLES: Record<'CAPITAL' | 'TECHNICAL', { bg: string; text: string; label: string }> = {
  CAPITAL:   { bg: 'bg-blue-50',   text: 'text-blue-600',   label: 'Capital' },
  TECHNICAL: { bg: 'bg-violet-50', text: 'text-violet-600', label: 'Technical' },
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// ── Skeleton row — mirrors the real row's layout to avoid content jump ──────
function ConversationSkeleton() {
  return (
    <div className="p-4 rounded-none border border-gray-100 animate-pulse">
      <div className="flex items-start gap-3.5">
        <div className="size-10 rounded-none bg-slate-100 shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="h-3.5 w-2/5 bg-slate-100 rounded" />
            <div className="h-2.5 w-8 bg-slate-100 rounded" />
          </div>
          <div className="h-2.5 w-1/3 bg-slate-100 rounded" />
          <div className="h-3 w-4/5 bg-slate-100 rounded" />
        </div>
      </div>
    </div>
  );
}

export function MessagesDrawer({ open, onClose }: MessagesDrawerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { unreadByEngagement, totalUnread, refresh: refreshUnread } = useUnreadMessages();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const loadConversations = useCallback(async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      const engagements = await engagementService.getCompanyEngagements(user.company_id);
      const supabase = createClient();

      const uniqueSenderIds = new Set<string>();
      const counterpartyIds: { id: string; type: 'CAPITAL' | 'TECHNICAL' }[] = [];

      const processed = engagements.map((eng) => {
        const messages = eng.messages ?? [];
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
        const lastMessageAt = lastMessage ? lastMessage.created_at : eng.updated_at || eng.created_at;

        messages.forEach((m: any) => {
          if (m.sender_id) uniqueSenderIds.add(m.sender_id);
        });

        if (eng.counterparty_id && eng.counterparty_type) {
          counterpartyIds.push({ id: eng.counterparty_id, type: eng.counterparty_type as 'CAPITAL' | 'TECHNICAL' });
        }

        return {
          engagementId: eng.id,
          engagement: eng,
          lastMessage,
          lastMessageAt,
          unread: unreadByEngagement[eng.id] ?? 0,
          counterpartyName: '',
          counterpartyType: eng.counterparty_type as 'CAPITAL' | 'TECHNICAL',
          senderName: null as string | null,
        };
      });

      const [profilesResult, partnersResult] = await Promise.all([
        uniqueSenderIds.size > 0
          ? supabase.from('user_profiles').select('id, full_name').in('id', Array.from(uniqueSenderIds))
          : Promise.resolve({ data: [] as any[] }),
        counterpartyIds.length > 0
          ? supabase.from('capital_partners').select('id, companies(name)').in('id', counterpartyIds.filter(c => c.type === 'CAPITAL').map(c => c.id)).then((capRes) => {
              const techIds = counterpartyIds.filter(c => c.type === 'TECHNICAL').map(c => c.id);
              return supabase.from('technical_partners').select('id, companies(name)').in('id', techIds).then((techRes) => {
                const map = new Map<string, string>();
                (capRes.data ?? []).forEach((r: any) => { if (r.companies?.name) map.set(r.id, r.companies.name); });
                (techRes.data ?? []).forEach((r: any) => { if (r.companies?.name) map.set(r.id, r.companies.name); });
                return map;
              });
            })
          : Promise.resolve(Promise.resolve(new Map<string, string>())),
      ]);

      const profilesMap = new Map<string, string>();
      (profilesResult.data ?? []).forEach((p: any) => {
        if (p.full_name) profilesMap.set(p.id, p.full_name);
      });

      const partnersNameMap = await partnersResult;

      const conversationsWithNames = processed.map((conv) => {
        const partnerName = partnersNameMap.get(conv.engagement.counterparty_id) ?? '';
        const senderName = conv.lastMessage
          ? conv.lastMessage.sender_id === user?.id
            ? 'You'
            : profilesMap.get(conv.lastMessage.sender_id) ?? 'Partner'
          : null;

        return {
          ...conv,
          counterpartyName: partnerName || getCounterpartyLabel(conv.counterpartyType),
          senderName,
        };
      });

      setConversations(conversationsWithNames);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user?.company_id, user?.id, unreadByEngagement]);

  useEffect(() => {
    if (open) {
      loadConversations();
    } else {
      // Reset transient UI state when the drawer closes
      setQuery('');
      setFilter('all');
    }
  }, [open, loadConversations]);

  useEffect(() => {
    if (!open || !user?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel('messages-drawer-realtime', { config: { broadcast: { self: false } } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          loadConversations();
          refreshUnread().catch(() => {});
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        () => {
          loadConversations();
          refreshUnread().catch(() => {});
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [open, user?.id, loadConversations, refreshUnread]);

  const handleConversationClick = useCallback((engagementId: string) => {
    onClose();
    router.push(`/engagements/${engagementId}`);
  }, [onClose, router]);

  const sorted = useMemo(() => {
    return [...conversations].sort((a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }, [conversations]);

  const filtered = useMemo(() => {
    let list = sorted;
    if (filter === 'unread') list = list.filter(c => c.unread > 0);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(c =>
        (c.engagement.project?.name ?? '').toLowerCase().includes(q) ||
        c.counterpartyName.toLowerCase().includes(q) ||
        (c.lastMessage?.message_body ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [sorted, filter, query]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Messages"
      description={totalUnread > 0 ? `${totalUnread} unread` : 'All caught up'}
      size="md"
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Icons.search className="size-4 text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full h-10 pl-10 pr-3.5 rounded-none border border-gray-100 bg-slate-50/60 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'h-8 px-3.5 rounded-none text-[11px] font-bold uppercase tracking-wider transition-colors',
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              )}
            >
              {f === 'all' ? 'All' : `Unread${totalUnread > 0 ? ` (${totalUnread})` : ''}`}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <ConversationSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center">
              <div className="size-12 rounded-none bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Icons.messageSquare className="size-5 text-slate-300" />
              </div>
              {query || filter === 'unread' ? (
                <>
                  <p className="text-xs font-bold text-slate-500">No matching conversations</p>
                  <p className="text-[11px] text-slate-400 mt-1">Try a different search or clear the filter.</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold text-slate-500">No conversations yet</p>
                  <p className="text-[11px] text-slate-400 mt-1">Engagements will appear here once you start messaging.</p>
                </>
              )}
            </div>
          ) : (
            filtered.map((conv) => {
              const st = conv.engagement.status;
              const preview = conv.lastMessage?.message_body ?? `No messages yet — ${st.replace(/_/g, ' ').toLowerCase()}`;
              const truncated = preview.length > 80 ? `${preview.slice(0, 80)}...` : preview;
              const dotColor = STATUS_DOT[st] ?? 'bg-slate-300';
              const typeStyle = TYPE_STYLES[conv.counterpartyType] ?? TYPE_STYLES.CAPITAL;

              return (
                <button
                  key={conv.engagementId}
                  onClick={() => handleConversationClick(conv.engagementId)}
                  className={cn(
                    'w-full text-left p-4 rounded-none border transition-all group',
                    'hover:border-primary/20 hover:shadow-md',
                    conv.unread > 0
                      ? 'bg-primary/[0.03] border-primary/10'
                      : 'bg-white border-gray-100 shadow-soft'
                  )}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Avatar with status dot */}
                    <div className="relative shrink-0">
                      <div className={cn(
                        'size-10 rounded-none flex items-center justify-center text-[11px] font-black transition-colors',
                        typeStyle.bg, typeStyle.text
                      )}>
                        {getInitials(conv.counterpartyName)}
                      </div>
                      <span className={cn(
                        'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white',
                        dotColor
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h4 className="text-[13px] font-bold text-slate-900 truncate group-hover:text-primary transition-colors">
                          {conv.engagement.project?.name || 'Project'}
                        </h4>
                        <span
                          title={formatFullDate(conv.lastMessageAt)}
                          className="text-[10px] font-bold text-slate-400 tracking-wider shrink-0"
                        >
                          {formatTimeAgo(conv.lastMessageAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                        <span className="text-[11px] font-semibold text-slate-600 truncate">
                          {conv.counterpartyName}
                        </span>
                        <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide shrink-0', typeStyle.bg, typeStyle.text)}>
                          {typeStyle.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className={cn(
                          'text-xs truncate',
                          conv.unread > 0 ? 'font-semibold text-slate-900' : 'font-medium text-slate-500'
                        )}>
                          {conv.senderName && (
                            <span className={cn('mr-1', conv.lastMessage?.sender_id === user?.id ? 'text-primary' : 'text-slate-700')}>
                              {conv.senderName}:
                            </span>
                          )}
                          {truncated}
                        </p>
                        {conv.unread > 0 && (
                          <span className="shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                            {conv.unread > 99 ? '99+' : conv.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </Drawer>
  );
}