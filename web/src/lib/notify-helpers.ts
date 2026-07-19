import { getSupabaseAdmin } from './supabase-server';
import { notifyUsers, type NotifyChannel } from './notify';
import type { NotificationPayload } from './email-templates';

/**
 * Fetch all OWNER/ADMIN members of an org and send them a notification + email.
 * Respects user notification_preferences. Fire-and-forget — never throws.
 */
export async function notifyOrgAdmins(params: {
  companyId: string;
  payload: NotificationPayload;
  channel?: NotifyChannel;
  emailTemplate?: { subject: string; html: string };
  emailLogType?: string;
  excludeUserIds?: string[];
}): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    // Step 1: get member user_ids
    const { data: members } = await supabase
      .from('company_members')
      .select('user_id')
      .eq('company_id', params.companyId)
      .in('role', ['OWNER', 'ADMIN'])
      .is('deleted_at', null);

    if (!members?.length) return;

    const userIds = members
      .map((m: any) => m.user_id)
      .filter((uid: string) => !params.excludeUserIds?.includes(uid));

    if (userIds.length === 0) return;

    // Step 2: get profiles (email + name) from user_profiles
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email')
      .in('id', userIds);

    const emailMap: Record<string, string> = {};
    for (const p of profiles ?? []) {
      if (p.email) emailMap[p.id] = p.email;
    }

    await notifyUsers({
      userIds,
      payload: params.payload,
      channel: params.channel ?? 'both',
      emailMap,
      emailTemplate: params.emailTemplate,
      emailLogType: params.emailLogType,
      emailEntityId: params.payload.entity_id,
    });
  } catch (err: any) {
    console.error('[Notify] notifyOrgAdmins failed:', err.message);
  }
}
