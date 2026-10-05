import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { badRequest, serverError, writeAuditLog } from '@/lib/api-helpers';
import { sendPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return badRequest('Email is required');

    const admin = getSupabaseAdmin();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    // Always return the same message to prevent email enumeration
    const successMsg = { message: 'If an account exists with that email, a reset link has been sent.' };

    // Look up user profile by email (indexed query — O(1) instead of O(n) listUsers)
    const { data: profile } = await admin
      .from('user_profiles')
      .select('id, full_name')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (!profile) {
      return Response.json(successMsg);
    }

    const authUserId = profile.id;
    const fullName = profile.full_name || email.split('@')[0];

    // Invalidate any previous unused reset tokens for this user
    await admin
      .from('password_resets')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', authUserId)
      .is('used_at', null);

    // Generate a random token and store its SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    const { error: insertErr } = await admin
      .from('password_resets')
      .insert({
        user_id: authUserId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (insertErr) {
      console.error('[ForgotPassword] Insert token error:', insertErr.message);
      return serverError();
    }

    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
    console.log(`[ForgotPassword] Reset link generated for ${email}`);

    await sendPasswordResetEmail({ to: email, fullName, resetUrl });

    await writeAuditLog({ userId: authUserId, action: 'PASSWORD_FORGOT_REQUESTED', entityType: 'auth', entityId: email, req, blocking: true });

    return Response.json(successMsg);
  } catch (e: any) {
    return Response.json({ message: 'If an account exists with that email, a reset link has been sent.' });
  }
}
