import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';

type Params = { params: Promise<{ id: string }> };

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
