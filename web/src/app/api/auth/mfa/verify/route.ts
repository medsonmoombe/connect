import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin, fetchProfileWithMemberships } from '@/lib/supabase-server';
import { badRequest, serverError, unauthorized } from '@/lib/api-helpers';
import { isMfaRequired, verifyMfaCode } from '@/lib/mfa';

const MFA_COOKIE = 'mfa_verified';
const MFA_MAX_AGE = 60 * 60; // 1 hour

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== 'string') return badRequest('Verification code is required');

    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return unauthorized();

    const admin = getSupabaseAdmin();
    const profile = await fetchProfileWithMemberships(admin, user.id);
    if (!profile) return unauthorized();

    const membership = (profile as any)?.company_members?.[0];
    const company = membership?.companies;
    const mfaUser = {
      is_platform_admin: membership?.role === 'ADMIN' && company?.is_platform_org === true,
      org_member_role: membership?.role ?? null,
      role: membership?.role ?? null,
      mfa_enabled: !!(profile as any).mfa_enabled,
      org_mfa_enforced: !!company?.mfa_enforced,
    };

    if (!isMfaRequired(mfaUser)) return badRequest('MFA is not required for your account');

    // Find the latest unused, non-expired code for this user
    const { data: mfaRecord } = await admin
      .from('mfa_codes')
      .select('id, code_hash')
      .eq('user_id', user.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!mfaRecord) {
      return Response.json(
        { error: 'No valid verification code found. Please request a new one.' },
        { status: 401 }
      );
    }

    // Verify the code
    const valid = verifyMfaCode(token.trim(), mfaRecord.code_hash);
    if (!valid) {
      return Response.json(
        { error: 'Invalid verification code' },
        { status: 401 }
      );
    }

    // Mark code as used
    await admin
      .from('mfa_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', mfaRecord.id);

    const response = NextResponse.json({ mfa_verified: true });

    response.cookies.set(MFA_COOKIE, '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: MFA_MAX_AGE,
    });

    return response;
  } catch (e: any) {
    console.error('[MFA verify] Error:', e.message);
    return serverError();
  }
}
