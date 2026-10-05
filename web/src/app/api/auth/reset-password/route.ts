import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { badRequest, serverError, writeAuditLog, validatePasswordComplexity } from '@/lib/api-helpers';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token) return badRequest('token is required');
    const pwError = validatePasswordComplexity(password);
    if (pwError) return badRequest(pwError);

    const admin = getSupabaseAdmin();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find the matching, unused, non-expired token
    const { data: resetRow, error: fetchErr } = await admin
      .from('password_resets')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (fetchErr || !resetRow) {
      return badRequest('This reset link is invalid or has expired. Please request a new one.');
    }

    // Update the password via Supabase Admin API
    const { error: updateErr } = await admin.auth.admin.updateUserById(resetRow.user_id, {
      password,
    });

    if (updateErr) {
      console.error('[ResetPassword] Update password error:', updateErr.message);
      return serverError('Failed to update password.');
    }

    // Mark token as used
    await admin
      .from('password_resets')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetRow.id);

    // Invalidate any other unused tokens for this user
    await admin
      .from('password_resets')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', resetRow.user_id)
      .is('used_at', null);

    await writeAuditLog({ userId: resetRow.user_id, action: 'PASSWORD_RESET', entityType: 'auth', entityId: resetRow.user_id, req, blocking: true });

    return Response.json({ message: 'Password updated successfully.' });
  } catch (e: any) {
    console.error('[ResetPassword] Error:', e.message);
    return serverError('Failed to reset password.');
  }
}
