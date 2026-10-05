import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { badRequest, serverError, writeAuditLog, validatePasswordComplexity } from '@/lib/api-helpers';
import { sendWelcomeEmail } from '@/lib/email';
import { cookies } from 'next/headers';
import { isNetworkError, serviceUnavailable } from '@/lib/network-errors';

const ALLOWED_TYPES = ['DEVELOPER', 'CAPITAL', 'TECHNICAL', 'CONSULTANT', 'POWER_TRADER', 'GRANT_PROVIDER'];

// ── POST /api/auth/register
// Open self-registration — no invite token required. The user chooses a profile
// type first, creates their account, then completes company setup + preferences
// on /onboarding. The organisation starts in `pending_verification` and is
// reviewed by a platform admin before the account is fully active.
export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, companyType, acceptedTerms } = await req.json();

    if (!email || !password || !fullName) {
      return badRequest('email, password, and fullName are required');
    }

    const pwError = validatePasswordComplexity(password);
    if (pwError) return badRequest(pwError);

    const type = companyType && ALLOWED_TYPES.includes(companyType) ? companyType : 'DEVELOPER';

    const admin = getSupabaseAdmin();

    // 1. Create Supabase Auth user
    let authData: any, authErr: any;
    try {
      const result = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      authData = result.data;
      authErr = result.error;
    } catch (e) {
      // DNS/fetch failures creating the auth user — a service outage, not a
      // user problem. Respond 503; the partially-created state is safe because
      // nothing has been written yet.
      if (isNetworkError(e)) {
        console.error('[Register] Supabase network failure:', (e as any)?.cause?.code ?? (e as Error).message);
        return serviceUnavailable('Registration service is temporarily unreachable. Please try again in a moment.');
      }
      throw e;
    }

    if (authErr || !authData.user) {
      console.error('[Register] Auth create error:', authErr?.message);
      if (authErr?.message?.toLowerCase().includes('already')) {
        return badRequest('An account with this email already exists.');
      }
      return badRequest('Failed to create account. Please try again or contact support.');
    }

    const userId = authData.user.id;

    // 2. Create user profile — carries the intended profile type so onboarding
    // can pre-select the company type on the company setup step. The column is
    // best-effort: on environments where the migration hasn't been applied yet,
    // fall back to a profile insert without it (the ?type= query param preserves
    // the choice for onboarding).
    const termsAt = acceptedTerms ? new Date().toISOString() : null;

    let { error: profileErr } = await admin.from('user_profiles').insert({
      id: userId,
      email,
      full_name: fullName,
      onboarding_complete: false,
      registration_type: type,
      accepted_terms_at: termsAt,
    });

    if (profileErr && profileErr.message?.includes("'registration_type'")) {
      profileErr = (await admin.from('user_profiles').insert({
        id: userId,
        email,
        full_name: fullName,
        onboarding_complete: false,
        accepted_terms_at: termsAt,
      })).error;
    }

    if (profileErr && profileErr.message?.includes("'accepted_terms_at'")) {
      profileErr = (await admin.from('user_profiles').insert({
        id: userId,
        email,
        full_name: fullName,
        onboarding_complete: false,
      })).error;
    }

    if (profileErr) {
      console.error('[Register] Profile insert error:', profileErr.message);
      // Roll back the auth user so the email isn't locked to a broken profile
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      return serverError();
    }

    // 3. Send welcome email
    await sendWelcomeEmail({ to: email, fullName });

    await writeAuditLog({
      userId,
      action: 'USER_SELF_REGISTERED',
      entityType: 'user_profiles',
      entityId: userId,
      after: { email, registration_type: type },
      req,
    });

    // 4. Establish a session so the user lands straight into onboarding
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Called from a Server Component — safe to ignore
            }
          },
        },
      }
    );

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      // Session failed — fall back to manual login
      return Response.json({ message: 'Account created. Please sign in to continue.', redirect: '/login?notice=register-success' }, { status: 201 });
    }

    const loginResponse = NextResponse.json(
      { message: 'Account created. Complete your organisation setup.', redirect: `/onboarding?type=${type}` },
      { status: 201 }
    );
    loginResponse.cookies.set('session_started_at', String(Date.now()), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return loginResponse;
  } catch (e: unknown) {
    console.error('[Register] Error:', e instanceof Error ? e.message : String(e));
    return serverError();
  }
}