import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin, fetchProfileWithMemberships } from '@/lib/supabase-server';
import { badRequest, serverError, writeAuditLog } from '@/lib/api-helpers';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return badRequest('email and password are required');

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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const profile = await fetchProfileWithMemberships(admin, data.user.id);

    if (profile?.suspended_at) {
      await supabase.auth.signOut();
      return Response.json({ error: 'This account has been deactivated. Please contact support.' }, { status: 403 });
    }

    const membership = (profile as any)?.company_members?.[0];
    if (membership?.companies?.status === 'deactivated') {
      await supabase.auth.signOut();
      return Response.json({ error: 'Your organisation has been deactivated. Please contact your administrator.' }, { status: 403 });
    }

    await writeAuditLog({ userId: data.user.id, action: 'USER_LOGGED_IN', entityType: 'auth', entityId: data.user.id, req });

    return Response.json({ profile });
  } catch (e: any) {
    console.error('[Login] Error:', e.message);
    return serverError();
  }
}
