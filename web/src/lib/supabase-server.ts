import { createServerClient } from '@supabase/ssr';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// For API routes and Server Components — reads session from cookies
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
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
            // Called from Server Component — cookies can't be set, safe to ignore
          }
        },
      },
    }
  );
}

// Service role client — bypasses RLS, server-side only, never expose to client
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Fetch a user profile with company membership data.
 *
 * company_members references auth.users(id) — not user_profiles(id) —
 * so PostgREST cannot auto-embed the join from user_profiles. We run two
 * separate queries and merge the results here.
 */
export async function fetchProfileWithMemberships(
  admin: SupabaseClient,
  userId: string,
) {
  // 1. Fetch profile
  const { data: profile, error: profileErr } = await admin
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileErr || !profile) {
    // Profile doesn't exist — create a minimal one
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    if (authUser?.user) {
      const { error: insertErr } = await admin.from('user_profiles').insert({
        id: userId,
        email: authUser.user.email,
        full_name: authUser.user.user_metadata?.full_name ?? authUser.user.email,
        onboarding_complete: false,
      });
      if (!insertErr) {
        const { data: reloaded } = await admin
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (reloaded) {
          return { ...reloaded, company_members: [] };
        }
      }
    }
    return null;
  }

  // 2. Fetch memberships with embedded companies
  const { data: memberships } = await admin
    .from('company_members')
    .select('role, company_id, companies(*)')
    .is('deleted_at', null)
    .eq('user_id', userId);

  return { ...profile, company_members: memberships ?? [] };
}
