import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden, serverError, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// GET /api/org/team/invites — list unused, non-expired invites for the caller's company
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const membership = (user.company_members as any[])?.[0];
    if (!membership?.company_id) return forbidden('You need to belong to an organisation to view pending invites. Contact your organisation admin if you need access.');

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('setup_invites')
      .select('id, email, token, expires_at, created_at, membership_role')
      .is('deleted_at', null)
      .eq('company_id', membership.company_id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Org/Team/Invites] Query error:', error.message);
      return serverError();
    }

    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
