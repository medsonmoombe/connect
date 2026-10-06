import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { checkRateLimit, RATE_LIMIT_API, RATE_LIMIT_API_READ, RATE_LIMIT_AUTH } from '@/lib/rate-limit';
import { verifyMfaCookie, signMfaCookie } from '@/lib/mfa-cookie';

const PROTECTED_ROUTES = ['/developer', '/admin', '/authority', '/investor', '/consultant', '/trader', '/grant', '/technical', '/engagements', '/inbound', '/profile', '/settings', '/audit-logs', '/verification', '/onboarding'];
const AUTH_ROUTES = ['/login', '/signup', '/register', '/forgot-password', '/reset-password'];

// Platform Admin-only routes (internal staff only)
const PLATFORM_ADMIN_ROUTES = ['/admin', '/api/admin'];

// Maximum session duration: 24 hours (86,400,000 ms).
// After this time the user is forced to re-authenticate regardless of JWT validity.
const MAX_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

// MFA verification cookie: valid 1 hour after the user last PROVED possession of
// their second factor. While the user keeps working, the cookie is re-signed
// (sliding window) so an active admin is never interrupted mid-task; after ~30
// minutes of inactivity the next request re-verification kicks in.
const MFA_COOKIE_NAME = 'mfa_verified';
const MFA_COOKIE_MAX_AGE = 60 * 60; // seconds
const MFA_REFRESH_AFTER_MS = 30 * 60 * 1000;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  let response = NextResponse.next({ request: req });

  // â”€â”€ Supabase session refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session â€” keeps JWT alive without requiring re-login
  const { data: { user } } = await supabase.auth.getUser();

  // â”€â”€ Session timeout check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // If the user has a session but their `session_started_at` cookie indicates
  // the session is older than MAX_SESSION_DURATION, force re-authentication.
  if (user) {
    const sessionStartedAt = req.cookies.get('session_started_at')?.value;
    if (sessionStartedAt) {
      const elapsed = Date.now() - Number(sessionStartedAt);
      if (elapsed > MAX_SESSION_DURATION_MS) {
        // Session expired â€” sign out
        await supabase.auth.signOut();

        // For API routes, return JSON so the client can handle it gracefully
        if (pathname.startsWith('/api')) {
          const apiResponse = NextResponse.json(
            { success: false, error: { code: 'SESSION_EXPIRED', message: 'Your session has expired. Please sign in again.' } },
            { status: 401 }
          );
          apiResponse.cookies.delete('session_started_at');
          apiResponse.cookies.delete('mfa_verified');
          return apiResponse;
        }

        // For page routes, redirect to login with notice
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('session_expired', 'true');
        const redirectResponse = NextResponse.redirect(loginUrl);
        redirectResponse.cookies.delete('session_started_at');
        redirectResponse.cookies.delete('mfa_verified');
        return redirectResponse;
      }
    }
  }

  // â”€â”€ Route protection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // ── Sliding MFA verification refresh ────────────────────────────────
  // Re-issue the signed MFA cookie for active users so the 1-hour window
  // rolls forward on use. After 30+ minutes of inactivity the cookie keeps
  // aging and the next request asks for re-verification — the security goal
  // (periodic re-proof of the second factor) is preserved, but an actively
  // working admin/regulator is never interrupted mid-task.
  if (user) {
    const mfaCookie = req.cookies.get(MFA_COOKIE_NAME)?.value;
    if (mfaCookie && await verifyMfaCookie(mfaCookie, user.id)) {
      const issuedAt = Number(mfaCookie.split('|')[1]);
      if (Number.isFinite(issuedAt) && Date.now() - issuedAt > MFA_REFRESH_AFTER_MS) {
        response.cookies.set(MFA_COOKIE_NAME, await signMfaCookie(user.id), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: MFA_COOKIE_MAX_AGE,
        });
      }
    }
  }

  const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
  const isAuthRoute = AUTH_ROUTES.some(r => pathname.startsWith(r));
  const isPlatformAdminRoute = PLATFORM_ADMIN_ROUTES.some(r => pathname.startsWith(r));

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/developer', req.url));
  }

  // â”€â”€ verify-otp: redirect away if already authenticated without MFA requirement â”€
  // The MFA cookie being set means they already completed verification this session
  if (pathname.startsWith('/verify-otp') && user) {
    const next = req.nextUrl.searchParams.get('next');
    const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/developer';
    if (process.env.DISABLE_MFA === 'true') {
      return NextResponse.redirect(new URL(target, req.url));
    }
    const mfaCookie = req.cookies.get(MFA_COOKIE_NAME)?.value;
    if (mfaCookie && await verifyMfaCookie(mfaCookie, user.id)) {
      return NextResponse.redirect(new URL(target, req.url));
    }
  }

  // â”€â”€ Platform Admin route enforcement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Use SECURITY DEFINER function to bypass RLS entirely
  if (isPlatformAdminRoute && user) {
    try {
      const { data: isAdmin } = await supabase.rpc('is_platform_admin');
      if (!isAdmin) {
        return NextResponse.redirect(new URL('/developer', req.url));
      }

      // Admin API routes require MFA verification (cookie must be set)
      // Skip when MFA is globally disabled
      if (pathname.startsWith('/api/admin') && process.env.DISABLE_MFA !== 'true') {
        const mfaCookie = req.cookies.get('mfa_verified')?.value;
        if (!mfaCookie || !await verifyMfaCookie(mfaCookie, user.id)) {
          return NextResponse.json(
            { error: 'MFA verification required. Please verify your identity.' },
            { status: 403 }
          );
        }
      }
    } catch {
      return NextResponse.redirect(new URL('/developer', req.url));
    }
  }

  // â”€â”€ Rate limiting (API routes only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Skipped in development: localhost has no abuse surface, and a single
  // machine behind one IP (no x-forwarded-for) otherwise shares one bucket,
  // which throttles normal dev work (several tabs, chatty dashboards).
  if (pathname.startsWith('/api') && process.env.NODE_ENV !== 'development') {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    // Identify per-user when authenticated so colleagues behind one office IP
    // (or localhost, where x-forwarded-for is absent) don't share one bucket.
    const identity = user ? `u:${user.id}` : `ip:${ip}`;

    // Session endpoint is a passive read-only poll — don't burn the API budget on it
    const isSessionCheck = pathname === '/api/auth/session';
    const isAuthPost = pathname.startsWith('/api/auth') && !isSessionCheck;
    // GET requests get a generous read bucket; mutations keep the tighter limit
    const isRead = req.method === 'GET';
    const config = isAuthPost ? RATE_LIMIT_AUTH : isRead ? RATE_LIMIT_API_READ : RATE_LIMIT_API;
    const result = await checkRateLimit(`${config.prefix}:${identity}`, config);

    if (!result.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.', resetAt: new Date(result.resetAt).toISOString() } },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)) } }
      );
    }

    response.headers.set('X-RateLimit-Limit', String(config.limit));
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-RateLimit-Reset', String(result.resetAt));
  }

  // â”€â”€ Security headers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '0'); // Modern browsers; rely on CSP instead
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  response.headers.set('X-DNS-Prefetch-Control', 'off');

  // HSTS only over HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  // Content-Security-Policy â€” restrictive baseline
  // Adjust if you add external scripts/styles (analytics, etc.)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval + unsafe-inline
    "style-src 'self' 'unsafe-inline'",                 // Tailwind requires unsafe-inline
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; ');
  response.headers.set('Content-Security-Policy', cspDirectives);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
