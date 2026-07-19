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

/**
 * useUnreadMessagesImpl — inbox unread counts + live updates.
 *
 * Fetches the authenticated user's unread message counts per engagement on
 * mount, then keeps them live by subscribing to a realtime channel on the
 * `messages` table. Because Supabase Realtime cannot filter a single
 * subscription across an arbitrary list of engagement ids efficiently in the
 * browser, we subscribe to ALL new inserts on `messages` and ignore own
 * payloads. A server recompute (refresh) keeps counts authoritative.
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
    const channel = supabase
      .channel('unread-inbox', { config: { broadcast: { self: false } } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as any;
          // Ignore own messages — they never count as unread.
          if (row?.sender_id === user.id) return;
          setUnreadByEngagement(prev => {
            const next = { ...prev };
            next[row.engagement_id] = (next[row.engagement_id] ?? 0) + 1;
            setTotalUnread(Object.values(next).reduce((a, b) => a + b, 0));
            return next;
          });
        }
      )
      // When a message is soft-deleted over realtime, recompute counts from
      // the server so a deleted unread message is removed from the badge.
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as any;
          if (row?.deleted_at) refresh().catch(() => {});
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
 * provider it returns the single shared instance; outside (standalone page) it
 * falls back to a local subscription so callers still work.
 */
export function useUnreadMessages(): UnreadMessagesValue {
  const ctx = useContext(UnreadMessagesContext);
  if (ctx) return ctx;
  return useUnreadMessagesImpl();
}
