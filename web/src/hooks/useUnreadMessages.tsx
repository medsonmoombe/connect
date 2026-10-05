'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { messagesApi } from '@/services/api';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
type UnreadMessagesValue = {
  totalUnread: number;
  unreadByEngagement: Record<string, number>;
  refresh: () => Promise<void>;
  markRead: (engagementId: string) => Promise<void>;
};

const UnreadMessagesContext = createContext<UnreadMessagesValue | null>(null);
const EMPTY_UNREAD_MESSAGES: UnreadMessagesValue = {
  totalUnread: 0,
  unreadByEngagement: {},
  refresh: async () => {},
  markRead: async () => {},
};

// Maximum engagement IDs per Realtime filter (Supabase filter string limit).
const MAX_IDS_PER_FILTER = 50;

async function fetchUserEngagementIds(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch engagements where the user is the developer (via project developer_id)
  // or the counterparty (via capital_partners/technical_partners).
  // We do this in two passes and merge the IDs.
  const { data: memberships } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .is('deleted_at', null);

  const companyIds = (memberships ?? []).map((m: any) => m.company_id).filter(Boolean);
  if (!companyIds.length) return [];

  const engagementIds = new Set<string>();

  // Developer side
  const { data: devProjects } = await supabase
    .from('projects')
    .select('id')
    .in('developer_id', companyIds);
  const projectIds = (devProjects ?? []).map((p: any) => p.id);
  if (projectIds.length) {
    const { data: devEngagements } = await supabase
      .from('engagements')
      .select('id')
      .in('project_id', projectIds);
    (devEngagements ?? []).forEach((e: any) => engagementIds.add(e.id));
  }

  // Counterparty side — look up capital/technical partner IDs for user's companies
  const { data: capitalPartners } = await supabase
    .from('capital_partners')
    .select('id')
    .in('company_id', companyIds);
  const { data: techPartners } = await supabase
    .from('technical_partners')
    .select('id')
    .in('company_id', companyIds);

  const partnerIds = [
    ...(capitalPartners ?? []).map((p: any) => ({ id: p.id, type: 'CAPITAL' })),
    ...(techPartners ?? []).map((p: any) => ({ id: p.id, type: 'TECHNICAL' })),
  ];

  for (const { id: partnerId, type: partnerType } of partnerIds) {
    const { data: cpEngagements } = await supabase
      .from('engagements')
      .select('id')
      .eq('counterparty_id', partnerId)
      .eq('counterparty_type', partnerType);
    (cpEngagements ?? []).forEach((e: any) => engagementIds.add(e.id));
  }

  return Array.from(engagementIds);
}

/**
 * useUnreadMessagesImpl — inbox unread counts + live updates.
 *
 * Fetches the authenticated user's unread message counts per engagement on
 * mount, then subscribes to Realtime scoped to the user's engagements only
 * (not all messages globally — privacy fix).
 */
function useUnreadMessagesImpl(): UnreadMessagesValue {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadByEngagement, setUnreadByEngagement] = useState<Record<string, number>>({});
  const loaded = useRef(false);

  const refresh = useCallback(async () => {
    const res = await messagesApi.getUnread();
    if (res?.data) {
      setUnreadByEngagement(res.data.by_engagement ?? {});
      setTotalUnread(res.data.total ?? 0);
      loaded.current = true;
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    refresh().catch(() => {});
  }, [user, refresh]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const channels: ReturnType<typeof supabase.channel>[] = [];

    // If a stale `unread-inbox` channel is still cached from a previous mount,
    // unsubscribe it before creating a fresh one. Without this, Turbopack
    // dev/HMR can hand back an already-subscribed channel and `.on()` throws:
    // "cannot add postgres_changes callbacks ... after subscribe()".
    const cached = (supabase as any).getChannels?.() ?? [];
    const stale = cached.find((ch: any) => {
      const label = ch.topic || ch.channel || ch.name || '';
      return label.includes('unread-inbox') && ch.state !== 'closed';
    });
    if (stale) {
      try { stale.unsubscribe?.(); } catch { /* silent */ }
      supabase.removeChannel(stale).catch(() => {});
    }

    // Fetch user's engagement IDs and create scoped subscriptions
    fetchUserEngagementIds(supabase).then((engagementIds) => {
      if (!engagementIds.length) return;

      // Split into batches to respect Supabase filter string length limits
      const batches: string[][] = [];
      for (let i = 0; i < engagementIds.length; i += MAX_IDS_PER_FILTER) {
        batches.push(engagementIds.slice(i, i + MAX_IDS_PER_FILTER));
      }

      batches.forEach((batch, idx) => {
        const channel = supabase
          .channel(`unread-inbox-${idx}`, { config: { broadcast: { self: false } } })
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `engagement_id=in.(${batch.join(',')})` },
            (payload) => {
              const row = payload.new as any;
              if (row?.sender_id === user.id) return;
              setUnreadByEngagement(prev => {
                const next = { ...prev };
                next[row.engagement_id] = (next[row.engagement_id] ?? 0) + 1;
                setTotalUnread(Object.values(next).reduce((a, b) => a + b, 0));
                return next;
              });
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'messages', filter: `engagement_id=in.(${batch.join(',')})` },
            (payload) => {
              const row = payload.new as any;
              if (row?.deleted_at) refresh().catch(() => {});
            }
          )
          .subscribe();
        channels.push(channel);
      });
    }).catch(() => {});

    return () => {
      channels.forEach(ch => {
        try { ch.unsubscribe?.(); } catch { /* silent */ }
        supabase.removeChannel(ch).catch(() => {});
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const markRead = useCallback(async (engagementId: string) => {
    setUnreadByEngagement(prev => {
      const next = { ...prev };
      delete next[engagementId];
      setTotalUnread(Object.values(next).reduce((a, b) => a + b, 0));
      return next;
    });
    try {
      await messagesApi.markRead(engagementId);
    } catch {
      // Silent — optimistic clear is the source of truth for the badge
    }
  }, []);

  return { totalUnread, unreadByEngagement, refresh, markRead };
}

/**
 * UnreadMessagesProvider — mounts a SINGLE realtime subscription to the
 * `messages` table for the whole dashboard and shares unread counts + markRead
 * across all consumers (Navbar badge + every role page's MessagesTab). Without
 * this each consumer would open its own channel.
 */
export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const value = useUnreadMessagesImpl();
  return (
    <UnreadMessagesContext.Provider value={value}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

/**
 * useUnreadMessages — read the shared unread-messages state. Inside the
 * provider it returns the single shared instance. Outside the provider it
 * returns a safe empty value instead of opening duplicate realtime channels.
 */
export function useUnreadMessages(): UnreadMessagesValue {
  const ctx = useContext(UnreadMessagesContext);
  return ctx ?? EMPTY_UNREAD_MESSAGES;
}
