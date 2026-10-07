import { NextRequest } from 'next/server';
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase-server';
import { unauthorized, badRequest, serverError, handleRouteError, validatePasswordComplexity } from '@/lib/api-helpers';

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

    // Enforce the user's organisation password policy. The org-level
    // `min_password_length` setting was previously stored but never applied.
    const admin = getSupabaseAdmin();
    const { data: membership } = await admin
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();
    let orgMinLength = 8;
    if (membership?.company_id) {
      const { data: org } = await admin
        .from('companies')
        .select('min_password_length')
        .eq('id', membership.company_id)
        .maybeSingle();
      if (typeof org?.min_password_length === 'number' && org.min_password_length > 8) {
        orgMinLength = org.min_password_length;
      }
    }

    const pwError = validatePasswordComplexity(new_password, orgMinLength);
    if (pwError) {
      return badRequest(pwError);
    }

    // Verify current password by attempting to sign in
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: current_password,
    });

    if (verifyErr) {
      return badRequest('Current password is incorrect');
    }

    const { error: pwErr } = await admin.auth.admin.updateUserById(user.id, { password: new_password });

    if (pwErr) {
      console.error('[ChangePassword] Error:', pwErr.message);
      return serverError('Failed to update password. Please try again.');
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
