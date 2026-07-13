import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendInviteEmail } from '@/lib/email';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const { id } = await params;
    const { email, membershipRole = 'MEMBER', expiresInDays = 7 } = await req.json();
    if (!email) return badRequest('email is required');

    if (!['MEMBER', 'ADMIN', 'OWNER'].includes(membershipRole)) {
      return badRequest('membershipRole must be MEMBER, ADMIN, or OWNER');
    }

    const admin = getSupabaseAdmin();
    const normalisedEmail = email.toLowerCase().trim();

    // Verify company exists
    const { data: company } = await admin
      .from('companies')
      .select('id, name')
      .is('deleted_at', null)
      .eq('id', id)
      .maybeSingle();

    if (!company) return badRequest('Organisation not found');

    // Check if email already has an account
    const { data: existingProfile } = await admin
      .from('user_profiles')
      .select('id')
      .ilike('email', normalisedEmail)
      .maybeSingle();

    if (existingProfile) {
      return badRequest('A user with this email already exists on the platform.');
    }

    // Check for pending invite to this company
    const { data: existingInvite } = await admin
      .from('setup_invites')
      .select('id')
      .is('deleted_at', null)
      .ilike('email', normalisedEmail)
      .eq('company_id', id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingInvite) {
      return badRequest('An active invitation already exists for this email.');
    }

    const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();

    const { data: invite, error } = await admin
      .from('setup_invites')
      .insert({
        email: normalisedEmail,
        issued_by: user.id,
        expires_at: expiresAt,
        company_id: id,
        membership_role: membershipRole,
      })
      .select()
      .single();

    if (error || !invite) {
      console.error('[Admin/OrgInvite] Insert error:', error?.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'ORG_INVITE_ISSUED',
      entityType: 'setup_invites',
      entityId: invite.id,
      after: { email: normalisedEmail, company_id: id, membershipRole },
      req,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const inviteLink = `${appUrl}/signup?token=${invite.token}`;
    console.log(`\n[Admin/OrgInvite] Invite link for ${normalisedEmail}:\n${inviteLink}\n`);

    await sendInviteEmail({ to: normalisedEmail, token: invite.token, expiresAt, companyName: company.name });

    return Response.json({ invite }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
