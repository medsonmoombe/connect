import { getSupabaseServer, getSupabaseAdmin, fetchProfileWithMemberships } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ user: null });

    const admin = getSupabaseAdmin();
    const profile = await fetchProfileWithMemberships(admin, user.id);

    const membership = (profile as any)?.company_members?.[0];
    const company = membership?.companies;
    const orgDeactivated = company?.status === 'deactivated';

    return Response.json({ user: profile, suspended: !!profile?.suspended_at, org_deactivated: orgDeactivated });
  } catch (e) {
    console.error('[Session] Error:', e);
    return Response.json({ user: null });
  }
}
