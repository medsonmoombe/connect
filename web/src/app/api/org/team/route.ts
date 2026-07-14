import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendInviteEmail } from '@/lib/email';

// ── GET /api/org/team — list all members + pending invites ──────────────────
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const membership = (user.company_members as any[])?.[0];

    if (!membership?.company_id) return forbidden();
    const admin = getSupabaseAdmin();

    // Active members
    const { data: members, error } = await admin
      .from('company_members')
      .select('role, user_id')
      .is('deleted_at', null)
      .eq('company_id', membership.company_id)
      .order('role');

    if (error) {
      console.error('[Org/Team] Query error:', error.message);
      return serverError();
    }

    // Pending invites
    const { data: invites } = await admin
      .from('setup_invites')
      .select('id, email, role:membership_role, created_at, expires_at')
      .is('deleted_at', null)
      .eq('company_id', membership.company_id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    const inviteRows = (invites ?? []).map((inv: any) => ({
      role: inv.role ?? 'MEMBER',
      user_id: `invite:${inv.id}`,
      is_invite: true,
      invite_id: inv.id,
      user_profiles: { id: '', full_name: '', email: inv.email, created_at: inv.created_at },
    }));

    // Profiles — try with new columns first, fall back to base columns if they don't exist yet
    const userIds = (members ?? []).map((m: any) => m.user_id);

    let profiles: any[] = [];
    const { data: fullProfiles, error: profilesErr } = await admin
      .from('user_profiles')
      .select('id, full_name, email, phone, job_title, avatar_url, created_at, suspended_at, email_verified_at')
      .in('id', userIds);

    if (profilesErr) {
      console.error('[Org/Team] Profile query error (falling back):', profilesErr.message);
      const { data: baseProfiles } = await admin
        .from('user_profiles')
        .select('id, full_name, email, avatar_url, created_at, suspended_at')
        .in('id', userIds);
      profiles = baseProfiles ?? [];
    } else {
      profiles = fullProfiles ?? [];
    }

    const profileMap = new Map(profiles.map((p: any) => [p.id, p]));
    const memberRows = (members ?? []).map((m: any) => ({
      ...m,
      user_profiles: profileMap.get(m.user_id) ?? null,
    }));

    return Response.json({ data: [...memberRows, ...inviteRows] });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// ── POST /api/org/team — invite a new member to the caller's company ─────────
// Only OWNER or ADMIN can invite
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const membership = (user.company_members as any[])?.[0];

    const isOrgAdmin = membership?.role === 'OWNER' || membership?.role === 'ADMIN';
    if (!isOrgAdmin || !membership?.company_id) return forbidden();

    const { email, membershipRole = 'MEMBER', expiresInDays = 7 } = await req.json();
    if (!email) return badRequest('email is required');

    // Validate role — org admins cannot invite another OWNER
    if (!['MEMBER', 'ADMIN'].includes(membershipRole)) {
      return badRequest('membership Role must be MEMBER or ADMIN');
    }

    const admin = getSupabaseAdmin();
    const normalisedEmail = email.toLowerCase().trim();

    // ── Validation 1: Check if email already has an account ────────────────
    const { data: existingProfile } = await admin
      .from('user_profiles')
      .select('id')
      .ilike('email', normalisedEmail)
      .maybeSingle();

    if (existingProfile) {
      return badRequest('A user with this email already exists on the platform. They can join your organisation directly from their dashboard.');
    }

    // ── Validation 2: Check for pending invite to this company ─────────────
    const { data: existingInvite } = await admin
      .from('setup_invites')
      .select('id')
      .is('deleted_at', null)
      .ilike('email', normalisedEmail)
      .eq('company_id', membership.company_id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingInvite) {
      return badRequest('An active invitation already exists for this email. It may still be pending acceptance.');
    }

    const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();

    const { data: invite, error } = await admin
      .from('setup_invites')
      .insert({
        email,
        issued_by: user.id,
        expires_at: expiresAt,
        company_id: membership.company_id,
        membership_role: membershipRole,
      })
      .select()
      .single();

    if (error || !invite) {
      console.error('[Org/Team] Invite insert error:', error?.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'ORG_INVITE_ISSUED',
      entityType: 'setup_invites',
      entityId: invite.id,
      after: { email, company_id: membership.company_id, membershipRole },
      req,
    });

    const { data: company } = await admin
      .from('companies')
      .select('name')
      .is('deleted_at', null)
      .eq('id', membership.company_id)
      .single();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const inviteLink = `${appUrl}/signup?token=${invite.token}`;
    console.log(`[Org/Team] Invite link generated for ${email}`);

    await sendInviteEmail({ to: email, token: invite.token, expiresAt, companyName: company?.name ?? undefined });

    return Response.json({ invite }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
