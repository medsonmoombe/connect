import { NextRequest } from 'next/server';
import { forbidden, getAuthenticatedUser, handleRouteError, serverError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isManagementUser } from '@/lib/admin-access';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!isManagementUser(user)) return forbidden('Only platform and authority management users can view engagement oversight.');

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search')?.trim().toLowerCase();
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 50)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const admin = getSupabaseAdmin();
    let query = admin
      .from('engagements')
      .select('id, status, counterparty_type, created_at, updated_at, project:projects(id, name, developer:companies(id, name, country))')
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (status !== 'ALL') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      console.error('[Authority/Engagements] Fetch error:', error.message);
      return serverError();
    }

    const rows = (data ?? []).filter((row: any) => {
      if (!search) return true;
      const haystack = [row.project?.name, row.project?.developer?.name, row.counterparty_type, row.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });

    return Response.json({ data: rows, pagination: { page, pageSize, hasMore: (data ?? []).length === pageSize } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}