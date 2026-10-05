import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { sendInviteEmail } from '@/lib/email';

// GET /api/auth/invite?pending=1 — list unused, non-expired invites (Platform Admin only)
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden('Only platform administrators can manage platform-wide invitations. Contact your platform support team if you need to send an invite.');

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

    const { email, expiresInDays = 7, companyId } = await req.json();

    const admin = getSupabaseAdmin();

    // Optional org scoping — only platform admins may bind an invite to an org
    let scopedCompanyId: string | null = null;
    if (companyId) {
      if (!user.is_platform_admin) return forbidden('Only platform administrators can create org-scoped invitations.');
      const { data: company } = await admin.from('companies').select('id').eq('id', companyId).is('deleted_at', null).maybeSingle();
      if (!company) return badRequest('Organisation not found.');
      scopedCompanyId = company.id;
    }

    // ── Validation: Check if email already has an account ──────────────────
    if (email) {
      const normalisedEmail = email.trim().toLowerCase();

      const { data: existingProfile } = await admin
        .from('user_profiles')
        .select('id')
        .ilike('email', normalisedEmail)
        .maybeSingle();

      if (existingProfile) {
        return badRequest('A user with this email already exists on the platform.');
      }

      // ── Validation: Check for existing pending invite ────────────────────
      let pendingInviteQuery = admin
        .from('setup_invites')
        .select('id, created_at')
        .is('deleted_at', null)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .ilike('email', normalisedEmail);
      if (scopedCompanyId) pendingInviteQuery = pendingInviteQuery.eq('company_id', scopedCompanyId);
      const { data: existingInvite } = await pendingInviteQuery.maybeSingle();

      if (existingInvite) {
        return badRequest(
          'A pending invitation already exists for this email. ' +
          'Revoke the existing invite before sending a new one.'
        );
      }
    }

    const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();

    const { data: invite, error } = await admin
      .from('setup_invites')
      .insert({ email: email ?? null, issued_by: user.id, expires_at: expiresAt, ...(scopedCompanyId ? { company_id: scopedCompanyId } : {}) })
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
      console.log(`[Invite] Invite link generated for ${email}: ${inviteLink}`);
      await sendInviteEmail({ to: email, token: invite.token, expiresAt });
    }

    return Response.json({ invite }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
