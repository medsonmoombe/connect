import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { sendInviteEmail } from '@/lib/email';

type Params = { params: Promise<{ id: string }> };

// POST /api/auth/invite/[id] — resend an existing pending invite
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const { id } = await params;
    const admin = getSupabaseAdmin();

    const { data: invite, error: fetchErr } = await admin
      .from('setup_invites')
      .select('id, email, token, expires_at, used_at, deleted_at')
      .eq('id', id)
      .single();

    if (fetchErr || !invite) return badRequest('Invite not found');
    if (invite.used_at) return badRequest('Invite has already been used');
    if (invite.deleted_at) return badRequest('Invite has been revoked');
    if (!invite.email) return badRequest('This is an open invite link — no email to resend to');

    // Extend expiry by 7 days from now if it has expired
    const now = new Date();
    const currentExpiry = new Date(invite.expires_at);
    const newExpiry = currentExpiry < now
      ? new Date(now.getTime() + 7 * 86_400_000).toISOString()
      : invite.expires_at;

    if (newExpiry !== invite.expires_at) {
      await admin.from('setup_invites').update({ expires_at: newExpiry }).eq('id', id);
    }

    await sendInviteEmail({ to: invite.email, token: invite.token, expiresAt: newExpiry });

    await writeAuditLog({
      userId: user.id,
      action: 'INVITE_RESENT',
      entityType: 'setup_invites',
      entityId: id,
      after: { email: invite.email, expires_at: newExpiry },
      req,
    });

    return Response.json({ success: true, message: `Invite resent to ${invite.email}` });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// DELETE /api/auth/invite/[id] — revoke a pending invite (Platform Admin only)
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const { id } = await params;
    const admin = getSupabaseAdmin();

    // Only allow revoking unused invites
    const { data: invite, error: fetchErr } = await admin
      .from('setup_invites')
      .select('id, used_at')
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (fetchErr || !invite) return badRequest('Invite not found');
    if (invite.used_at) return badRequest('Invite has already been used');

    const { error } = await admin.from('setup_invites').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      console.error('[Invite] Delete error:', error.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'INVITE_REVOKED',
      entityType: 'setup_invites',
      entityId: id,
      req,
    });

    return Response.json({ success: true });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
