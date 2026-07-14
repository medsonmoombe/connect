import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { checkRateLimit, RATE_LIMIT_API, RATE_LIMIT_AUTH } from '@/lib/rate-limit';

const PROTECTED_ROUTES = ['/dashboard', '/onboarding'];
const AUTH_ROUTES = ['/login', '/signup', '/forgot-password', '/reset-password'];

// Platform Admin-only routes (internal staff only)
const PLATFORM_ADMIN_ROUTES = ['/dashboard/admin', '/api/admin'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  let response = NextResponse.next({ request: req });

  // ── Supabase session refresh ────────────────────────────────
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

  // Refresh session — keeps JWT alive without requiring re-login
  const { data: { user } } = await supabase.auth.getUser();

  // ── Route protection ────────────────────────────────────────
  const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
  const isAuthRoute = AUTH_ROUTES.some(r => pathname.startsWith(r));
  const isPlatformAdminRoute = PLATFORM_ADMIN_ROUTES.some(r => pathname.startsWith(r));

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // ── Platform Admin route enforcement ────────────────────────
  // Use SECURITY DEFINER function to bypass RLS entirely
  if (isPlatformAdminRoute && user) {
    try {
      const { data: isAdmin } = await supabase.rpc('is_platform_admin', { uid: user.id });
      if (!isAdmin) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }

      // Admin API routes require MFA verification (cookie must be set)
      if (pathname.startsWith('/api/admin')) {
        const mfaVerified = req.cookies.get('mfa_verified')?.value === '1';
        if (!mfaVerified) {
          return NextResponse.json(
            { error: 'MFA verification required. Please verify your identity.' },
            { status: 403 }
          );
        }
      }
    } catch {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // ── Rate limiting (API routes only) ────────────────────────
  if (pathname.startsWith('/api')) {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    // Session endpoint is a passive read-only check — use the generous API limit
    const isSessionCheck = pathname === '/api/auth/session';
    const config = (pathname.startsWith('/api/auth') && !isSessionCheck) ? RATE_LIMIT_AUTH : RATE_LIMIT_API;
    const result = checkRateLimit(ip, config);

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

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
