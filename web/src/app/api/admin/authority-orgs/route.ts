import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getAuthenticatedUser, serverError, badRequest, forbidden } from '@/lib/api-helpers';
import { sendAdminUserProvisionedEmail } from '@/lib/email';

// POST /api/admin/authority-orgs
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const { orgName, country, email, fullName, role = 'ADMIN' } = await req.json();
    if (!orgName?.trim()) return badRequest('orgName is required');
    if (!country?.trim()) return badRequest('country is required');

    const admin = getSupabaseAdmin();

    const { data: company, error: companyErr } = await admin
      .from('companies')
      .insert({
        name: orgName.trim(),
        type: 'DEVELOPER',          // legacy enum — required NOT NULL, identity via is_authority_org
        country: country.trim(),
        primary_role: 'DEVELOPER',  // required NOT NULL, identity via is_authority_org
        is_authority_org: true,
        status: 'verified',
        description: '',
        years_operating: 0,
        team_size: 0,
      })
      .select('id, name')
      .single();

    if (companyErr || !company) {
      console.error('[authority-orgs] company insert:', companyErr?.message);
      return serverError();
    }

    let provisionedUser: { id: string; generated_password: string } | null = null;

    if (email?.trim()) {
      const generatedPassword = Math.random().toString(36).slice(-10) + 'A1!';

      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email: email.trim(),
        password: generatedPassword,
        email_confirm: true,
      });

      if (authErr || !authData.user) {
        await admin.from('companies').delete().eq('id', company.id);
        return badRequest(authErr?.message?.includes('already') ? 'Email already registered' : 'Failed to create user account');
      }

      const userId = authData.user.id;

      await admin.from('user_profiles').insert({
        id: userId,
        email: email.trim(),
        full_name: fullName?.trim() || email.trim(),
        onboarding_complete: true,
      });

      await admin.from('company_members').insert({
        user_id: userId,
        company_id: company.id,
        role,
      });

      provisionedUser = { id: userId, generated_password: generatedPassword };

      // Send credentials email — fire and forget
      sendAdminUserProvisionedEmail({
        to: email.trim(),
        email: email.trim(),
        generatedPassword: generatedPassword,
      }).catch(() => {});
    }

    return NextResponse.json({
      data: { company, user: provisionedUser },
      message: `Regulator org "${company.name}" created${provisionedUser ? ' with user provisioned' : ''}`,
    }, { status: 201 });
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('[authority-orgs] error:', e);
    return serverError();
  }
}

// GET /api/admin/authority-orgs
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('companies')
      .select('id, name, country, status, created_at, company_members(count)')
      .eq('is_authority_org', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) return serverError();
    return NextResponse.json({ data });
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return serverError();
  }
}
