import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', req.url));
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

  const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as any });

  if (error) {
    console.error('[Auth/Confirm] OTP verify error:', error.message);
    return NextResponse.redirect(new URL(`/login?error=verification_failed`, req.url));
  }

  return NextResponse.redirect(new URL('/login?verified=1', req.url));
}
