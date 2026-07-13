// Centralized in-app notification system
// All notifications go through this module.

import { getSupabaseAdmin } from './supabase-server';
import type { NotificationType, NotificationPayload } from './email-templates';

// ── Create a notification ────────────────────────────────────────────────────

export async function createNotification(params: {
  userId: string;
  payload: NotificationPayload;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('notifications')
      .insert({
        user_id: params.userId,
        type: params.payload.type,
        title: params.payload.title,
        body: params.payload.body,
        entity_type: params.payload.entity_type ?? null,
        entity_id: params.payload.entity_id ?? null,
        action_url: params.payload.action_url ?? null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Notify] Insert error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('[Notify] Exception:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Create notifications for multiple users ──────────────────────────────────

export async function createNotifications(params: {
  userIds: string[];
  payload: NotificationPayload;
}): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const admin = getSupabaseAdmin();
    const rows = params.userIds.map(userId => ({
      user_id: userId,
      type: params.payload.type,
      title: params.payload.title,
      body: params.payload.body,
      entity_type: params.payload.entity_type ?? null,
      entity_id: params.payload.entity_id ?? null,
      action_url: params.payload.action_url ?? null,
    }));

    const { error, count } = await admin
      .from('notifications')
      .insert(rows);

    if (error) {
      console.error('[Notify] Batch insert error:', error.message);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: count ?? rows.length };
  } catch (err: any) {
    console.error('[Notify] Batch exception:', err.message);
    return { success: false, count: 0, error: err.message };
  }
}

// ── Mark notifications as read ───────────────────────────────────────────────

export async function markAsRead(userId: string, notificationIds?: string[]): Promise<{ success: boolean }> {
  try {
    const admin = getSupabaseAdmin();
    let query = admin
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId);

    if (notificationIds && notificationIds.length > 0) {
      query = query.in('id', notificationIds);
    } else {
      query = query.eq('read', false);
    }

    const { error } = await query;
    if (error) {
      console.error('[Notify] Mark read error:', error.message);
      return { success: false };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[Notify] Mark read exception:', err.message);
    return { success: false };
  }
}

// ── Delete notifications ─────────────────────────────────────────────────────

export async function deleteNotifications(userId: string, notificationIds: string[]): Promise<{ success: boolean }> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('notifications')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('id', notificationIds);

    if (error) {
      console.error('[Notify] Delete error:', error.message);
      return { success: false };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[Notify] Delete exception:', err.message);
    return { success: false };
  }
}

// ── Get unread count ─────────────────────────────────────────────────────────

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const admin = getSupabaseAdmin();
    const { count, error } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
      .is('deleted_at', null);

    if (error) {
      console.error('[Notify] Count error:', error.message);
      return 0;
    }
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ── Get notifications for a user ─────────────────────────────────────────────

export async function getNotifications(userId: string, limit = 20, offset = 0) {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Notify] Fetch error:', error.message);
      return [];
    }
    return data ?? [];
  } catch {
    return [];
  }
}

// ── Notification builders (convenience helpers) ──────────────────────────────
// These build NotificationPayload objects for common scenarios.

export const notificationBuilders = {
  orgStatusChange: (params: {
    orgName: string;
    status: string;
    actionUrl?: string;
  }): NotificationPayload => ({
    type: 'org_status_change',
    title: `Organization ${params.status === 'verified' ? 'Verified' : params.status === 'rejected' ? 'Not Approved' : 'Update Required'}`,
    body: params.status === 'verified'
      ? `Your organization "${params.orgName}" has been verified. You now have full platform access.`
      : params.status === 'rejected'
        ? `Your organization "${params.orgName}" was not approved at this time.`
        : `Your organization "${params.orgName}" requires additional information.`,
    entity_type: 'organizations',
    action_url: params.actionUrl ?? '/dashboard',
  }),

  newOrgRegistered: (params: {
    orgName: string;
    orgType: string;
    requesterName: string;
  }): NotificationPayload => ({
    type: 'new_org_registered',
    title: 'New organization pending review',
    body: `${params.requesterName} registered "${params.orgName}" (${params.orgType}) and is awaiting verification.`,
    entity_type: 'organizations',
    action_url: '/dashboard/admin/verification',
  }),

  matchFound: (params: {
    projectName: string;
    partnerName: string;
    score: number;
  }): NotificationPayload => ({
    type: 'match_found',
    title: 'New match found',
    body: `${params.partnerName} matches "${params.projectName}" with ${params.score}% compatibility.`,
    entity_type: 'projects',
    action_url: '/dashboard',
  }),

  engagementUpdate: (params: {
    projectName: string;
    newStatus: string;
  }): NotificationPayload => ({
    type: 'engagement_update',
    title: 'Engagement updated',
    body: `Engagement for "${params.projectName}" moved to ${params.newStatus.replace(/_/g, ' ')}.`,
    entity_type: 'engagements',
    action_url: '/dashboard',
  }),

  messageReceived: (params: {
    senderName: string;
    preview: string;
  }): NotificationPayload => ({
    type: 'message_received',
    title: `New message from ${params.senderName}`,
    body: params.preview.length > 100 ? params.preview.slice(0, 100) + '...' : params.preview,
    entity_type: 'messages',
    action_url: '/dashboard',
  }),

  systemAnnouncement: (params: {
    title: string;
    body: string;
  }): NotificationPayload => ({
    type: 'system_announcement',
    title: params.title,
    body: params.body,
    action_url: '/dashboard',
  }),
};
