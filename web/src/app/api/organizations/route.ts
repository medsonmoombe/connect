import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// GET /api/organizations?search=acme
export async function GET(req: NextRequest) {
  try {
    await getAuthenticatedUser(req); // must be logged in

    const search = new URL(req.url).searchParams.get('search') ?? '';
    const admin = getSupabaseAdmin();

    let query = admin
      .from('organizations')
      .select('id, name, primary_role, status')
      .eq('status', 'verified')
      .order('name');

    if (search.length >= 2) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query.limit(20);
    if (error) return serverError();

    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
