import { NextRequest } from 'next/server';
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase-server';
import { unauthorized, badRequest, serverError, handleRouteError } from '@/lib/api-helpers';

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return unauthorized();

    const body = await req.json();
    const { current_password, new_password } = body;

    if (!current_password || !new_password) {
      return badRequest('current_password and new_password are required');
    }

    if (new_password.length < 8) {
      return badRequest('New password must be at least 8 characters');
    }

    // Verify current password by attempting to sign in
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: current_password,
    });

    if (verifyErr) {
      return badRequest('Current password is incorrect');
    }

    const admin = getSupabaseAdmin();
    const { error: pwErr } = await admin.auth.admin.updateUserById(user.id, { password: new_password });

    if (pwErr) {
      console.error('[ChangePassword] Error:', pwErr.message);
      return badRequest(pwErr.message || 'Failed to update password');
    }

    // Update password_changed_at timestamp
    await admin
      .from('user_profiles')
      .update({ password_changed_at: new Date().toISOString() })
      .eq('id', user.id);

    return Response.json({ success: true });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
