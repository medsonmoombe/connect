import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin, fetchProfileWithMemberships } from '@/lib/supabase-server';
import { badRequest, serverError, writeAuditLog } from '@/lib/api-helpers';
import { checkLockout, recordLoginAttempt } from '@/lib/lockout';
import { sendAccountLockedEmail } from '@/lib/email';
import { cookies } from 'next/headers';
import { isNetworkError, serviceUnavailable } from '@/lib/network-errors';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return badRequest('email and password are required');

 
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null;
    const userAgent = req.headers.get('user-agent') ?? null;

    // Check if account is locked
    const lockout = await checkLockout(email);
    if (lockout.locked) {
      return Response.json(
        { error: 'Your account has been temporarily locked due to too many failed login attempts.', code: 'ACCOUNT_LOCKED', lockedUntil: lockout.lockedUntil },
        { status: 403 }
      );
    }

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

    let data: any, error: any;
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      data = result.data;
      error = result.error;
    } catch (e) {
      // DNS/fetch failures from the Supabase call — a service outage, not bad
      // credentials. Never count against the user's failed-attempt lockout.
      if (isNetworkError(e)) {
        console.error('[Login] Supabase network failure:', (e as any)?.cause?.code ?? (e as Error).message);
        return serviceUnavailable();
      }
      throw e;
    }
    if (error || !data.user) {
      // Record failed attempt
      const admin = getSupabaseAdmin();
      const { data: profile } = await admin
        .from('user_profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      const attemptResult = await recordLoginAttempt({
        email,
        userId: profile?.id,
        success: false,
        ipAddress: ipAddress ?? undefined,
        userAgent: userAgent ?? undefined,
      });

      if (attemptResult.locked) {
        // Send account locked email
        const lockedProfile = profile ? await fetchProfileWithMemberships(admin, profile.id) : null;
        const fullName = (lockedProfile as any)?.full_name || email;
        await sendAccountLockedEmail({
          to: email,
          fullName,
          lockedUntil: attemptResult.lockedUntil!,
        });

        await writeAuditLog({ userId: profile?.id ?? null, action: 'ACCOUNT_LOCKED', entityType: 'user', entityId: profile?.id ?? email, req, blocking: true });

        return Response.json(
          { error: 'Your account has been temporarily locked due to too many failed login attempts.', code: 'ACCOUNT_LOCKED', lockedUntil: attemptResult.lockedUntil },
          { status: 403 }
        );
      }

      return Response.json(
        { error: 'Invalid email or password', code: 'INVALID_CREDENTIALS', attemptsRemaining: attemptResult.attemptsRemaining },
        { status: 401 }
      );
    }

    const admin = getSupabaseAdmin();
    const profile = await fetchProfileWithMemberships(admin, data.user.id);

    if (profile?.suspended_at) {
      await supabase.auth.signOut();
      return Response.json({ error: 'This account has been deactivated. Please contact support.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
    }

    const membership = (profile as any)?.company_members?.[0];
    if (membership?.companies?.status === 'deactivated') {
      await supabase.auth.signOut();
      return Response.json({ error: 'Your organisation has been deactivated. Please contact your administrator.', code: 'ORG_DEACTIVATED' }, { status: 403 });
    }

    // Check password expiry
    const passwordExpiryDays = membership?.companies?.password_expiry_days ?? 0;
    if (passwordExpiryDays > 0 && profile?.password_changed_at) {
      const changedAt = new Date(profile.password_changed_at).getTime();
      const now = Date.now();
      const daysSinceChange = Math.floor((now - changedAt) / (1000 * 60 * 60 * 24));
      if (daysSinceChange > passwordExpiryDays) {
        // Return a flag so the frontend can redirect to password change
        return Response.json({
          profile,
          password_expired: true,
          password_expired_days: daysSinceChange,
        });
      }
    }

    // Record successful login (clears failed attempts context)
    await recordLoginAttempt({
      email,
      userId: data.user.id,
      success: true,
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
    });

    await writeAuditLog({ userId: data.user.id, action: 'USER_LOGGED_IN', entityType: 'auth', entityId: data.user.id, req });

    // Set session started cookie for absolute session timeout
    const loginResponse = NextResponse.json({ profile });
    loginResponse.cookies.set('session_started_at', String(Date.now()), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days (safety net — middleware enforces 24h)
    });

    return loginResponse;
  } catch (e: any) {
    console.error('[Login] Error:', e.message);
    return serverError();
  }
}
