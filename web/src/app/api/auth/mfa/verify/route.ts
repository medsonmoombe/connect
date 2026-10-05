import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin, fetchProfileWithMemberships } from '@/lib/supabase-server';
import { badRequest, serverError, unauthorized } from '@/lib/api-helpers';
import { isMfaRequired, verifyMfaCode } from '@/lib/mfa';
import { signMfaCookie } from '@/lib/mfa-cookie';

const MFA_COOKIE = 'mfa_verified';
const MFA_MAX_AGE = 60 * 60; // 1 hour

// â”€â”€ Per-user brute-force protection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// In-memory store. In multi-instance deployments, upgrade to Redis-backed store.
const MFA_MAX_ATTEMPTS = 5;
const MFA_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const attemptStore = new Map<string, { count: number; windowStart: number }>();

function checkMfaRateLimit(userId: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const record = attemptStore.get(userId);

  if (!record || now - record.windowStart > MFA_WINDOW_MS) {
    attemptStore.set(userId, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (record.count >= MFA_MAX_ATTEMPTS) {
    const retryAfterMs = MFA_WINDOW_MS - (now - record.windowStart);
    return { allowed: false, retryAfterMs };
  }

  record.count++;
  return { allowed: true, retryAfterMs: 0 };
}

function recordMfaFailure(userId: string): void {
  const now = Date.now();
  const record = attemptStore.get(userId);
  if (!record || now - record.windowStart > MFA_WINDOW_MS) {
    attemptStore.set(userId, { count: 1, windowStart: now });
  } else {
    record.count++;
  }
}

function clearMfaAttempts(userId: string): void {
  attemptStore.delete(userId);
}

// Periodic cleanup every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of attemptStore) {
    if (now - val.windowStart > MFA_WINDOW_MS) attemptStore.delete(key);
  }
}, 5 * 60 * 1000);

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

    // â”€â”€ Brute-force gate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const rateCheck = checkMfaRateLimit(user.id);
    if (!rateCheck.allowed) {
      const retryMin = Math.ceil(rateCheck.retryAfterMs / 60_000);
      return Response.json(
        { error: `Too many verification attempts. Try again in ${retryMin} minute${retryMin > 1 ? 's' : ''}.` },
        { status: 429 }
      );
    }

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
      recordMfaFailure(user.id);
      return Response.json(
        { error: 'Invalid verification code' },
        { status: 401 }
      );
    }

    // â”€â”€ Success: clear attempts and mark code used â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    clearMfaAttempts(user.id);

    await admin
      .from('mfa_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', mfaRecord.id);

    const response = NextResponse.json({ mfa_verified: true });

    const mfaCookieValue = await signMfaCookie(user.id);
    response.cookies.set(MFA_COOKIE, mfaCookieValue, {
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
