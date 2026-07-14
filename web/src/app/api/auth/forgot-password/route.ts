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

    // Look up the auth user by email
    const { data: authData, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) {
      return Response.json(successMsg);
    }

    const authUser = authData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!authUser) {
      return Response.json(successMsg);
    }

    // Invalidate any previous unused reset tokens for this user
    await admin
      .from('password_resets')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', authUser.id)
      .is('used_at', null);

    // Generate a random token and store its SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    const { error: insertErr } = await admin
      .from('password_resets')
      .insert({
        user_id: authUser.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (insertErr) {
      console.error('[ForgotPassword] Insert token error:', insertErr.message);
      return serverError();
    }

    // Look up the user's name for the email
    let fullName = email.split('@')[0];
    try {
      const { data: profile } = await admin
        .from('user_profiles')
        .select('full_name')
        .eq('id', authUser.id)
        .maybeSingle();
      if (profile?.full_name) fullName = profile.full_name;
    } catch {
      // Use email prefix as fallback
    }

    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
    console.log(`[ForgotPassword] Reset link generated for ${email}`);

    await sendPasswordResetEmail({ to: email, fullName, resetUrl });

    await writeAuditLog({ userId: authUser.id, action: 'PASSWORD_FORGOT_REQUESTED', entityType: 'auth', entityId: email, req });

    return Response.json(successMsg);
  } catch (e: any) {
    return Response.json({ message: 'If an account exists with that email, a reset link has been sent.' });
  }
}
