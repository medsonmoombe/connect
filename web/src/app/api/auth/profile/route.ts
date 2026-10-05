import { NextRequest } from 'next/server';
import { getSupabaseAdmin, fetchProfileWithMemberships } from '@/lib/supabase-server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { unauthorized, serverError, writeAuditLog, handleRouteError, badRequest } from '@/lib/api-helpers';
import { validate, profilePatchSchema } from '@/lib/validation';

const DEFAULT_NOTIFICATION_PREFS = {
  match_found: true,
  engagement_updates: true,
  project_status: true,
  new_messages: false,
};

export async function GET() {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return unauthorized();

    const admin = getSupabaseAdmin();
    const { data: profile, error } = await admin
      .from('user_profiles')
      .select('notification_preferences')
      .eq('id', user.id)
      .single();

    if (error) return serverError();

    return Response.json({
      notification_preferences: profile?.notification_preferences ?? DEFAULT_NOTIFICATION_PREFS,
    });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return unauthorized();

    const body = await req.json();

    const parsed = validate(profilePatchSchema, body);
    if (!parsed.ok) return badRequest(parsed.error);

    const { full_name, avatar_url, phone, job_title, mfa_enabled, notification_preferences } = parsed.data;

    const admin = getSupabaseAdmin();

    // ── Guard: block disabling MFA when org enforces it ───────────────────────
    if (mfa_enabled === false) {
      const profile = await fetchProfileWithMemberships(admin, user.id);
      const membership = (profile as any)?.company_members?.[0];
      const company = membership?.companies;
      if (company?.mfa_enforced) {
        return badRequest(
          'Your organization requires MFA. Contact an admin to disable MFA enforcement first.'
        );
      }
    }
    const updates: Record<string, any> = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (phone !== undefined) updates.phone = phone || null;
    if (job_title !== undefined) updates.job_title = job_title || null;
    if (mfa_enabled !== undefined) updates.mfa_enabled = !!mfa_enabled;
    if (notification_preferences !== undefined) {
      updates.notification_preferences = {
        ...DEFAULT_NOTIFICATION_PREFS,
        ...notification_preferences,
      };
    }

    if (Object.keys(updates).length === 0) {
      return badRequest('No fields to update');
    }

    const { error: updateErr } = await admin
      .from('user_profiles')
      .update(updates)
      .eq('id', user.id);

    if (updateErr) {
      console.error('[Profile] Update error:', updateErr.message);
      return serverError();
    }

    const profile = await fetchProfileWithMemberships(admin, user.id);

    await writeAuditLog({ userId: user.id, action: 'PROFILE_UPDATED', entityType: 'user_profiles', entityId: user.id, after: updates, req });

    return Response.json({ profile });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
