import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin, fetchProfileWithMemberships } from '@/lib/supabase-server';
import { badRequest, serverError, unauthorized } from '@/lib/api-helpers';
import { isMfaRequired, generateMfaCode, hashMfaCode, MFA_CODE_EXPIRY_MINUTES } from '@/lib/mfa';
import { sendMfaCodeEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
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

    // Generate and store the code FIRST
    const code = generateMfaCode();
    // TODO(TEMP): log the OTP to server logs for local testing — REMOVE before production.
    console.log(`[MFA][TEMP] OTP for ${user.email}: ${code} (valid ${MFA_CODE_EXPIRY_MINUTES} min)`);
    const codeHash = hashMfaCode(code);
    const expiresAt = new Date(Date.now() + MFA_CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { error: insertError } = await admin.from('mfa_codes').insert({
      user_id: user.id,
      code_hash: codeHash,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('[MFA] Failed to store code:', insertError.message);
      return serverError('Failed to generate verification code.');
    }

    // Try to send via Resend â€” if it fails, the code is still in DB and logged
    const sendResult = await sendMfaCodeEmail({
      to: user.email!,
      fullName: profile.full_name || user.email!,
      code,
    });

    if (!sendResult.success) {
      // Delivery failed (e.g. Resend unconfigured on this environment) but the
      // code IS stored and usable — in dev it's also printed to the server log.
      // Don't dead-end the user: report a recoverable delivery problem and let
      // verification proceed with the stored code.
      console.error('[MFA] Email send failed:', sendResult.error);
      return Response.json(
        { success: false, delivered: false, warning: 'We couldn\u2019t deliver the email right now. The code was generated — check your server logs in development, or try resending.' },
        { status: 200 }
      );
    }

    // NOW invalidate old codes only after successful send
    await admin
      .from('mfa_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('used_at', null)
      .neq('code_hash', codeHash);

    return Response.json({ success: true });
  } catch (e: any) {
    console.error('[MFA send-code] Error:', e.message);
    return serverError();
  }
}
