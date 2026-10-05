import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, handleRouteError, serverError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isManagementUser } from '@/lib/admin-access';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!isManagementUser(user)) return forbidden('Only platform and authority management users can view the project review queue.');

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'under_review';
    const search = searchParams.get('search')?.trim();
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 50)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const admin = getSupabaseAdmin();
    let query = admin
      .from('projects')
      .select('*, scores:project_scores(*), documents:project_documents(*), developer:companies(*)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status !== 'ALL') query = query.eq('status', status);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) {
      console.error('[Authority/Projects] Fetch error:', error.message);
      return serverError();
    }

    return Response.json({ data: data ?? [], pagination: { page, pageSize, hasMore: (data ?? []).length === pageSize } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}