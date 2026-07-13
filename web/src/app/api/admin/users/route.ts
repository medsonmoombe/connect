import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, forbidden, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendAdminUserProvisionedEmail } from '@/lib/email';
import { createNotification, notificationBuilders } from '@/lib/notify';

// GET /api/admin/users — list all users (Platform Admin only)
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*, company_members(role, company_id, companies(*))')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Admin/Users] Query error:', error.message);
      return serverError();
    }
    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// POST /api/admin/users — provision a new user (Platform Admin only)
// Creates: auth user + user_profile + company + membership
export async function POST(req: NextRequest) {
  try {
    const adminUser = await getAuthenticatedUser(req);
    if (!adminUser.is_platform_admin) return forbidden();

    const { email, role, password, fullName, orgName, orgType } = await req.json();
    const actualPassword = password || (Math.random().toString(36).slice(-12) + 'A1!');

    const supabase = getSupabaseAdmin();

    // 1. Create Supabase Auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: actualPassword,
      email_confirm: true, // Admin-provisioned users are auto-confirmed
    });

    if (authErr || !authData.user) {
      console.error('[Admin/Users] Auth create error:', authErr?.message);
      return serverError();
    }

    const userId = authData.user.id;

    // 2. Create user profile
    const { error: profileErr } = await supabase.from('user_profiles').insert({
      id: userId,
      email,
      full_name: fullName || email.split('@')[0],
      onboarding_complete: true, // Admin-provisioned users skip onboarding
    });

    if (profileErr) {
      console.error('[Admin/Users] Profile insert error:', profileErr.message);
      return serverError();
    }

    // 3. Create company if orgName provided
    let companyId: string | null = null;
    if (orgName) {
      const typeToRole: Record<string, string> = {
        DEVELOPER: 'DEVELOPER',
        CAPITAL: 'CAPITAL_PARTNER',
        TECHNICAL: 'TECHNICAL_PARTNER',
        POWER_TRADER: 'POWER_TRADER',
        GRANT_PROVIDER: 'GRANT_PROVIDER',
      };
      const primaryRole = typeToRole[orgType || 'DEVELOPER'] || 'DEVELOPER';

      const typeMap: Record<string, string> = {
        DEVELOPER: 'DEVELOPER',
        CAPITAL: 'CAPITAL',
        TECHNICAL: 'TECHNICAL',
        POWER_TRADER: 'POWER_TRADER',
        GRANT_PROVIDER: 'DEVELOPER',
      };

      const { data: company, error: companyErr } = await supabase
        .from('companies')
        .insert({
          name: orgName,
          type: typeMap[orgType || 'DEVELOPER'] || 'DEVELOPER',
          primary_role: primaryRole,
          status: 'verified', // Admin-created companies are auto-verified
          country: 'Not specified',
        })
        .select()
        .single();

      if (companyErr) {
        console.error('[Admin/Users] Company insert error:', companyErr.message);
        return serverError();
      }
      companyId = company.id;
    }

    // 4. Create membership
    if (companyId) {
      const membershipRole = role === 'ADMIN' ? 'ADMIN' : 'OWNER';
      const { error: memberErr } = await supabase
        .from('company_members')
        .insert({ user_id: userId, company_id: companyId, role: membershipRole });

      if (memberErr) {
        console.error('[Admin/Users] Membership insert error:', memberErr.message);
        return serverError();
      }
    }

    // 5. Send email + in-app notification
    const userName = fullName || email.split('@')[0];
    await sendAdminUserProvisionedEmail({
      to: email,
      email,
      generatedPassword: password ? undefined : actualPassword,
    });

    await createNotification({
      userId,
      payload: notificationBuilders.systemAnnouncement({
        title: 'Welcome to Afri Connect',
        body: `Your account has been created by an administrator. ${orgName ? `You've been added to "${orgName}".` : ''}`,
      }),
    });

    await writeAuditLog({ userId: adminUser.id, action: 'USER_PROVISIONED', entityType: 'user_profiles', entityId: userId, after: { email, company_id: companyId }, req });

    return Response.json({
      data: {
        id: userId,
        email,
        company_id: companyId,
        generated_password: password ? undefined : actualPassword,
      },
      message: password
        ? `User created and added to company.`
        : `User created. Generated password: ${actualPassword}`,
    }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// PATCH /api/admin/users — verify or update a user (Platform Admin only)
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const { userId, ...updates } = await req.json();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('user_profiles').update(updates).eq('id', userId).select().single();

    if (error) {
      console.error('[Admin/Users] Update error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'USER_UPDATED', entityType: 'user_profiles', entityId: userId, after: updates, req });
    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
