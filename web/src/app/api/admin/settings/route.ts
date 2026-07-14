import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, serverError, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// GET /api/admin/settings — fetch platform stats + MFA overview
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const admin = getSupabaseAdmin();

    const { count: totalUsers } = await admin
      .from('user_profiles').select('*', { count: 'exact', head: true });

    const { count: mfaEnabled } = await admin
      .from('user_profiles').select('*', { count: 'exact', head: true }).eq('mfa_enabled', true);

    const { count: totalOrgs } = await admin
      .from('companies').select('*', { count: 'exact', head: true }).is('deleted_at', null);

    const { count: verifiedOrgs } = await admin
      .from('companies').select('*', { count: 'exact', head: true }).eq('status', 'verified').is('deleted_at', null);

    const { count: pendingVerifications } = await admin
      .from('companies').select('*', { count: 'exact', head: true }).eq('status', 'pending_verification').is('deleted_at', null);

    return Response.json({
      stats: {
        totalUsers: totalUsers ?? 0,
        mfaEnabled: mfaEnabled ?? 0,
        totalOrgs: totalOrgs ?? 0,
        verifiedOrgs: verifiedOrgs ?? 0,
        pendingVerifications: pendingVerifications ?? 0,
      },
    });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
