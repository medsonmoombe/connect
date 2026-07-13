import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { badRequest, serverError, writeAuditLog } from '@/lib/api-helpers';
import { sendInviteWelcomeEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, inviteToken } = await req.json();

    if (!email || !password || !fullName || !inviteToken) {
      return badRequest('email, password, fullName, and inviteToken are required');
    }

    if (password.length < 8) {
      return badRequest('Password must be at least 8 characters');
    }

    const admin = getSupabaseAdmin();

    // 1. Validate invite token
    const { data: invite, error: inviteErr } = await admin
      .from('setup_invites')
      .select('*')
      .is('deleted_at', null)
      .eq('token', inviteToken)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (inviteErr || !invite) {
      return badRequest('Invalid or expired invite token');
    }

    // 2. If invite is locked to a specific email, enforce it
    if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
      return badRequest('This invite was issued for a different email address');
    }

    // 3. Create Supabase Auth user — invited users are auto-verified
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authErr || !authData.user) {
      console.error('[Signup] Auth create error:', authErr?.message);
      if (authErr?.message?.toLowerCase().includes('already')) {
        return badRequest('An account with this email already exists.');
      }
      return badRequest(authErr?.message || 'Failed to create account.');
    }

    const userId = authData.user.id;

    // 4. Create user profile
    const { error: profileErr } = await admin.from('user_profiles').insert({
      id: userId,
      email,
      full_name: fullName,
      onboarding_complete: false,
    });

    if (profileErr) {
      console.error('[Signup] Profile insert error:', profileErr.message);
      return serverError();
    }

    // 5. Mark invite as used
    await admin
      .from('setup_invites')
      .update({ used_by: userId, used_at: new Date().toISOString() })
      .eq('id', invite.id);

    // 5a. If invite is company-scoped, add user to that company
    let companyName: string | undefined;
    if (invite.company_id) {
      // Enforce single-company membership
      const { data: existingMembership } = await admin
        .from('company_members')
        .select('id')
        .is('deleted_at', null)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingMembership) {
        const { error: memberErr } = await admin
          .from('company_members')
          .insert({
            user_id: userId,
            company_id: invite.company_id,
            role: invite.membership_role || 'MEMBER',
          });

        if (memberErr) {
          console.error('[Signup] Failed to add user to company:', memberErr.message);
        }
      }

      const { data: company } = await admin
        .from('companies')
        .select('name')
        .is('deleted_at', null)
        .eq('id', invite.company_id)
        .single();
      companyName = company?.name ?? undefined;
    }

    // 6. Send welcome email (no verification needed — invited users are auto-verified)
    await sendInviteWelcomeEmail({ to: email, fullName, companyName });

    await writeAuditLog({ userId, action: 'USER_SIGNED_UP', entityType: 'user_profiles', entityId: userId, after: { email }, req });

    return Response.json({ message: 'Account created. You can now sign in.' }, { status: 201 });
  } catch (e: any) {
    console.error('[Signup] Error:', e.message);
    return serverError();
  }
}
