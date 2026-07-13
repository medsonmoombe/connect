'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
  read: boolean;
  created_at: string;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  deleteNotifications: (ids: string[]) => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef = useRef<string | null>(null);

  // ── Initial fetch ────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.status === 401) return;
      const data = await res.json();
      setNotifications(data.data ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Network error — keep current state
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Get current user ID for Realtime filter ──────────────────────────────
  const getUserId = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/session');
      if (res.status === 401) return null;
      const { user } = await res.json();
      return user?.id ?? null;
    } catch {
      return null;
    }
  }, []);

  // ── Subscribe to Realtime ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const setupRealtime = async () => {
      const userId = await getUserId();
      // If the effect was cleaned up while we were awaiting, bail out
      if (cancelled || !userId) return;

      userIdRef.current = userId;
      const supabase = createClient();

      // All .on() calls must be chained BEFORE .subscribe()
      const channel = supabase
        .channel(`realtime:notifications:${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            const newNotif = payload.new as Notification;
            setNotifications(prev => [newNotif, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            const updated = payload.new as Notification;
            setNotifications(prev => {
              const next = prev.map(n => n.id === updated.id ? updated : n);
              setUnreadCount(next.filter(n => !n.read).length);
              return next;
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setNotifications(prev => {
                const removed = prev.find(n => n.id === deletedId);
                const next = prev.filter(n => n.id !== deletedId);
                if (removed && !removed.read) setUnreadCount(c => Math.max(0, c - 1));
                return next;
              });
            }
          }
        )
        .subscribe();

      // If cleanup ran while subscribe() was executing, tear it down immediately
      if (cancelled) {
        supabase.removeChannel(channel);
        return;
      }

      channelRef.current = channel;
    };

    fetchNotifications();
    setupRealtime();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchNotifications();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchNotifications, getUserId]);

  // ── Mark all as read ─────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications/read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      // Realtime UPDATE events will handle state updates
    } catch {
      // ignore
    }
  }, []);

  // ── Mark specific as read ────────────────────────────────────────────────
  const markRead = useCallback(async (ids: string[]) => {
    try {
      await fetch('/api/notifications/read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: ids }),
      });
      // Realtime UPDATE events will handle state updates
    } catch {
      // ignore
    }
  }, []);

  // ── Delete notifications ─────────────────────────────────────────────────
  const deleteNotifications = useCallback(async (ids: string[]) => {
    try {
      await fetch('/api/notifications/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: ids }),
      });
      // Realtime DELETE events will handle state updates
    } catch {
      // ignore
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    refresh: fetchNotifications,
    markAllRead,
    markRead,
    deleteNotifications,
  };
}
