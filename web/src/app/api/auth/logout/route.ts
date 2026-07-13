import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { serverError, writeAuditLog, getAuthenticatedUser } from '@/lib/api-helpers';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null;
    try {
      const user = await getAuthenticatedUser(req);
      userId = user.id;
    } catch {
      // Not authenticated — still allow logout
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

    await supabase.auth.signOut();

    await writeAuditLog({ userId, action: 'USER_LOGGED_OUT', entityType: 'auth', entityId: userId ?? 'unknown', req });

    return Response.json({ success: true });
  } catch {
    return serverError();
  }
}
