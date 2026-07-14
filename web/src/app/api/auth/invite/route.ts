import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { sendInviteEmail } from '@/lib/email';

// GET /api/auth/invite?pending=1 — list unused, non-expired invites (Platform Admin only)
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('setup_invites')
      .select('id, email, token, expires_at, created_at, membership_role, companies(name)')
      .is('deleted_at', null)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Invite] List error:', error.message);
      return serverError();
    }
    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const { email, expiresInDays = 7 } = await req.json();

    const admin = getSupabaseAdmin();

    // ── Validation: Check if email already has an account ──────────────────
    if (email) {
      const { data: existingProfile } = await admin
        .from('user_profiles')
        .select('id')
        .ilike('email', email.trim().toLowerCase())
        .maybeSingle();

      if (existingProfile) {
        return badRequest('A user with this email already exists on the platform.');
      }
    }

    const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();

    const { data: invite, error } = await admin
      .from('setup_invites')
      .insert({ email: email ?? null, issued_by: user.id, expires_at: expiresAt })
      .select()
      .single();

    if (error || !invite) {
      console.error('[Invite] Insert error:', error?.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'INVITE_ISSUED',
      entityType: 'setup_invites',
      entityId: invite.id,
      after: { email, expires_at: expiresAt },
      req,
    });

    // Send invite email if an address was provided
    if (email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const inviteLink = `${appUrl}/signup?token=${invite.token}`;
      console.log(`[Invite] Invite link generated for ${email}`);
      await sendInviteEmail({ to: email, token: invite.token, expiresAt });
    }

    return Response.json({ invite }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
