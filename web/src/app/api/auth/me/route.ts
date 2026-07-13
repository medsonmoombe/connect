import { getSupabaseServer, getSupabaseAdmin, fetchProfileWithMemberships } from '@/lib/supabase-server';
import { unauthorized, serverError } from '@/lib/api-helpers';

export async function GET() {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return unauthorized();

    const admin = getSupabaseAdmin();
    const profile = await fetchProfileWithMemberships(admin, user.id);

    return Response.json({ profile });
  } catch {
    return serverError();
  }
}
