import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendInviteEmail } from '@/lib/email';

type Params = { params: Promise<{ id: string }> };

// DELETE /api/org/team/invites/[id] — cancel a pending invite (OWNER / ADMIN only)
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const membership = (user.company_members as any[])?.[0];

    const isOrgAdmin = membership?.role === 'OWNER' || membership?.role === 'ADMIN';
    if (!isOrgAdmin || !membership?.company_id) return forbidden('Only organisation owners and admins can cancel invites. Contact your organisation admin if you need an invite cancelled.');

    const { id } = await params;
    const admin = getSupabaseAdmin();

    // Verify the invite belongs to this company and is unused
    const { data: invite, error: fetchErr } = await admin
      .from('setup_invites')
      .select('id, used_at, company_id')
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (fetchErr || !invite) return badRequest('Invite not found');
    if (invite.company_id !== membership.company_id) return forbidden('This invite does not belong to your organisation.');
    if (invite.used_at) return badRequest('Invite has already been used');

    const { error } = await admin.from('setup_invites').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      console.error('[Org/Team/Invites] Delete error:', error.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'ORG_INVITE_CANCELLED',
      entityType: 'setup_invites',
      entityId: id,
      req,
    });

    return Response.json({ success: true });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// POST /api/org/team/invites/[id] — resend a pending invite (OWNER / ADMIN only)
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const membership = (user.company_members as any[])?.[0];

    const isOrgAdmin = membership?.role === 'OWNER' || membership?.role === 'ADMIN';
    if (!isOrgAdmin || !membership?.company_id) return forbidden('Only organisation owners and admins can resend invites. Contact your organisation admin if you need an invite resent.');

    const { id } = await params;
    const admin = getSupabaseAdmin();

    const { data: invite, error: fetchErr } = await admin
      .from('setup_invites')
      .select('id, email, token, company_id, used_at')
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (fetchErr || !invite) return badRequest('Invite not found');
    if (invite.company_id !== membership.company_id) return forbidden('This invite does not belong to your organisation.');
    if (invite.used_at) return badRequest('Invite has already been used');

    const newExpiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const { error: updateErr } = await admin
      .from('setup_invites')
      .update({ expires_at: newExpiresAt })
      .eq('id', id);

    if (updateErr) {
      console.error('[Org/Team/Invites] Resend error:', updateErr.message);
      return serverError();
    }

    const { data: company } = await admin
      .from('companies')
      .select('name')
      .is('deleted_at', null)
      .eq('id', membership.company_id)
      .single();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const inviteLink = `${appUrl}/signup?token=${invite.token}`;
    console.log(`[Org/Team/Invites] Resent invite link generated for ${invite.email}`);

    if (invite.email) {
      await sendInviteEmail({
        to: invite.email,
        token: invite.token,
        expiresAt: newExpiresAt,
        companyName: company?.name ?? undefined,
      });
    }

    await writeAuditLog({
      userId: user.id,
      action: 'ORG_INVITE_RESENT',
      entityType: 'setup_invites',
      entityId: id,
      after: { email: invite.email, expires_at: newExpiresAt },
      req,
    });

    return Response.json({ success: true, expires_at: newExpiresAt });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
