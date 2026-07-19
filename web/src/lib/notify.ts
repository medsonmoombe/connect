// Centralized in-app notification system
// All notifications go through this module.

import { getSupabaseAdmin } from './supabase-server';
import type { NotificationType, NotificationPayload } from './email-templates';
import { sendEmail } from './email';

// ── Default notification preferences ──────────────────────────────────────────
// Keys match the NotificationType union (minus system_announcement, which is always on).

export const DEFAULT_NOTIFICATION_PREFS: Record<string, boolean> = {
  match_found: true,
  engagement_updates: true,
  project_status: true,
  project_live: true,
  project_rejected: true,
  project_internal_rejected: true,
  project_pending_internal_review: true,
  project_approved_internal: true,
  new_messages: true,
};

// ── Fetch a user's notification preferences ───────────────────────────────────

export async function getUserPreferences(userId: string): Promise<Record<string, boolean>> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('user_profiles')
      .select('notification_preferences')
      .eq('id', userId)
      .single();

    if (error || !data) return { ...DEFAULT_NOTIFICATION_PREFS };

    const stored = (data.notification_preferences as Record<string, boolean> | null) ?? {};
    return { ...DEFAULT_NOTIFICATION_PREFS, ...stored };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

// ── Check if a specific notification type is enabled for a user ────────────────

export async function shouldNotify(userId: string, type: NotificationType): Promise<boolean> {
  if (type === 'system_announcement') return true; // always on
  const prefs = await getUserPreferences(userId);
  return prefs[type] !== false;
}

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

// ── High-level: send notification + email based on user preferences ────────────
// Use these instead of calling createNotification + sendEmail separately.

export type NotifyChannel = 'in_app' | 'email' | 'both';

/**
 * Notify a single user. Respects their notification_preferences.
 * Returns what was sent so callers can log or inspect.
 */
export async function notifyUser(params: {
  userId: string;
  payload: NotificationPayload;
  channel?: NotifyChannel;          // default 'both'
  emailTo?: string;                 // required if channel includes email
  emailTemplate?: { subject: string; html: string };
  emailLogType?: string;
  emailEntityId?: string;
}): Promise<{ inApp: boolean; email: boolean }> {
  const ch = params.channel ?? 'both';
  const result = { inApp: false, email: false };

  const type = params.payload.type;

  // Always create in-app for system_announcement; otherwise check prefs
  const sendInApp = ch === 'in_app' || ch === 'both';
  const sendEmailFlag = (ch === 'email' || ch === 'both') && params.emailTo && params.emailTemplate;

  if (sendInApp) {
    const allowed = await shouldNotify(params.userId, type);
    if (allowed) {
      const res = await createNotification({ userId: params.userId, payload: params.payload });
      result.inApp = res.success;
    }
  }

  if (sendEmailFlag) {
    const allowed = await shouldNotify(params.userId, type);
    if (allowed && params.emailTo && params.emailTemplate) {
      const res = await sendEmail({
        to: params.emailTo,
        subject: params.emailTemplate.subject,
        html: params.emailTemplate.html,
        logType: params.emailLogType,
        logEntityId: params.emailEntityId,
      });
      result.email = res.success;
    }
  }

  return result;
}

/**
 * Notify multiple users. Respects each user's notification_preferences.
 * Batch-fetches preferences to minimize DB calls.
 */
export async function notifyUsers(params: {
  userIds: string[];
  payload: NotificationPayload;
  channel?: NotifyChannel;
  /** Map of userId → email address (needed if channel includes email) */
  emailMap?: Record<string, string>;
  emailTemplate?: { subject: string; html: string };
  emailLogType?: string;
  emailEntityId?: string;
}): Promise<{ inAppCount: number; emailCount: number }> {
  const ch = params.channel ?? 'both';
  let inAppCount = 0;
  let emailCount = 0;

  // Batch-fetch all preferences in one query from user_profiles
  const admin = getSupabaseAdmin();
  const { data: profiles } = await admin
    .from('user_profiles')
    .select('id, notification_preferences')
    .in('id', params.userIds);

  const prefMap = new Map<string, Record<string, boolean>>();
  for (const p of profiles ?? []) {
    const stored = (p.notification_preferences as Record<string, boolean> | null) ?? {};
    prefMap.set(p.id, { ...DEFAULT_NOTIFICATION_PREFS, ...stored });
  }

  // Filter to users who have this type enabled
  const allowed = params.userIds.filter(uid => {
    if (params.payload.type === 'system_announcement') return true;
    const prefs = prefMap.get(uid) ?? { ...DEFAULT_NOTIFICATION_PREFS };
    return prefs[params.payload.type] !== false;
  });

  if (allowed.length === 0) return { inAppCount: 0, emailCount: 0 };

  // Batch insert in-app notifications
  if (ch === 'in_app' || ch === 'both') {
    const rows = allowed.map(userId => ({
      user_id: userId,
      type: params.payload.type,
      title: params.payload.title,
      body: params.payload.body,
      entity_type: params.payload.entity_type ?? null,
      entity_id: params.payload.entity_id ?? null,
      action_url: params.payload.action_url ?? null,
    }));
    const { error } = await admin.from('notifications').insert(rows);
    if (!error) inAppCount = rows.length;
  }

  // Send individual emails (Resend doesn't support batch send)
  if ((ch === 'email' || ch === 'both') && params.emailTemplate && params.emailMap) {
    for (const uid of allowed) {
      const email = params.emailMap[uid];
      if (!email) continue;
      const res = await sendEmail({
        to: email,
        subject: params.emailTemplate.subject,
        html: params.emailTemplate.html,
        logType: params.emailLogType,
        logEntityId: params.emailEntityId,
      });
      if (res.success) emailCount++;
    }
  }

  return { inAppCount, emailCount };
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

  orgResubmitted: (params: {
    orgName: string;
    requesterName: string;
  }): NotificationPayload => ({
    type: 'org_status_change',
    title: 'Organization resubmitted for review',
    body: `${params.requesterName} updated and resubmitted "${params.orgName}" for verification.`,
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

  expressInterest: (params: {
    projectName: string;
    partnerName: string;
    engagementId: string;
  }): NotificationPayload => ({
    type: 'engagement_updates',
    title: `New interest in "${params.projectName}"`,
    body: `${params.partnerName} has expressed interest in your project. Review and accept to proceed.`,
    entity_type: 'engagements',
    entity_id: params.engagementId,
    action_url: `/dashboard/engagements/${params.engagementId}`,
  }),

  engagementUpdate: (params: {
    projectName: string;
    newStatus: string;
  }): NotificationPayload => ({
    type: 'engagement_updates',
    title: 'Engagement updated',
    body: `Engagement for "${params.projectName}" moved to ${params.newStatus.replace(/_/g, ' ')}.`,
    entity_type: 'engagements',
    action_url: '/dashboard',
  }),

  messageReceived: (params: {
    senderName: string;
    engagementId: string;
  }): NotificationPayload => ({
    type: 'new_messages',
    title: `New message from ${params.senderName}`,
    body: `${params.senderName} sent you a message. Open to view.`,
    entity_type: 'messages',
    entity_id: params.engagementId,
    action_url: `/dashboard/engagements/${params.engagementId}`,
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

  projectRejected: (params: {
    projectName: string;
    reason: string;
    actionUrl?: string;
  }): NotificationPayload => ({
    type: 'project_rejected',
    title: `Project "${params.projectName}" rejected`,
    body: `Your project was not approved. Reason: ${params.reason}`,
    entity_type: 'projects',
    action_url: params.actionUrl ?? '/dashboard/developer',
  }),

  projectSubmittedForReview: (params: {
    projectName: string;
    actionUrl?: string;
  }): NotificationPayload => ({
    type: 'project_status',
    title: `Project "${params.projectName}" submitted for platform review`,
    body: `Your project has been submitted and is now awaiting platform admin review.`,
    entity_type: 'projects',
    action_url: params.actionUrl ?? '/dashboard/developer',
  }),

  projectInternalRejected: (params: {
    projectName: string;
    reason: string;
    actionUrl?: string;
  }): NotificationPayload => ({
    type: 'project_internal_rejected',
    title: `Project "${params.projectName}" needs rework`,
    body: `Your internal reviewer requested changes: ${params.reason}`,
    entity_type: 'projects',
    action_url: params.actionUrl ?? '/dashboard/developer',
  }),

  projectPendingInternalReview: (params: {
    projectName: string;
    submitterName: string;
    orgName: string;
    actionUrl?: string;
  }): NotificationPayload => ({
    type: 'project_pending_internal_review',
    title: `Project pending your review`,
    body: `${params.submitterName} submitted "${params.projectName}" (${params.orgName}) for your internal review before platform submission.`,
    entity_type: 'projects',
    action_url: params.actionUrl ?? '/dashboard/developer',
  }),

  projectSubmittedInternalReview: (params: {
    projectName: string;
    actionUrl?: string;
  }): NotificationPayload => ({
    type: 'project_status',
    title: `Project sent for internal review`,
    body: `"${params.projectName}" has been sent to your designated internal reviewer for approval before platform submission.`,
    entity_type: 'projects',
    action_url: params.actionUrl ?? '/dashboard/developer',
  }),

  projectApprovedByInternal: (params: {
    projectName: string;
    actionUrl?: string;
  }): NotificationPayload => ({
    type: 'project_approved_internal',
    title: `Project "${params.projectName}" approved internally`,
    body: `Your project has been approved by your internal reviewer and submitted to the platform for final review.`,
    entity_type: 'projects',
    action_url: params.actionUrl ?? '/dashboard/developer',
  }),

  projectValidated: (params: {
    projectName: string;
    actionUrl?: string;
  }): NotificationPayload => ({
    type: 'project_status',
    title: `Project "${params.projectName}" validated`,
    body: `Your project has been reviewed and approved by the platform. It is now visible to partners.`,
    entity_type: 'projects',
    action_url: params.actionUrl ?? '/projects/' + params.projectName,
  }),

  projectLive: (params: {
    projectName: string;
  }): NotificationPayload => ({
    type: 'project_live',
    title: `"${params.projectName}" is now live`,
    body: `Your project is now visible to investors and technical partners. Matched partners will appear shortly.`,
    entity_type: 'projects',
    action_url: '/dashboard/developer',
  }),

  projectStatusChanged: (params: {
    projectName: string;
    newStatus: string;
    actionUrl?: string;
  }): NotificationPayload => ({
    type: 'project_status',
    title: `Project "${params.projectName}" status updated`,
    body: `Your project status has changed to ${params.newStatus.replace(/_/g, ' ')}.`,
    entity_type: 'projects',
    action_url: params.actionUrl ?? '/dashboard/developer',
  }),
};
