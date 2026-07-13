import { NextRequest } from 'next/server';
import { getSupabaseAdmin, fetchProfileWithMemberships } from '@/lib/supabase-server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { unauthorized, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return unauthorized();

    const body = await req.json();
    const { full_name, avatar_url } = body;

    const admin = getSupabaseAdmin();
    const updates: Record<string, any> = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
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
