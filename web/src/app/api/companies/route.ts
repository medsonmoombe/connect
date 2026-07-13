import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);

    let query = supabase.from('companies').select('*').is('deleted_at', null).order('created_at', { ascending: false });

    const type = searchParams.get('type');
    const search = searchParams.get('search');
    if (type && type !== 'ALL') query = query.eq('type', type);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) {
      console.error('[Companies] Query error:', error.message);
      return serverError();
    }
    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.from('companies').insert(body).select().single();
    if (error) {
      console.error('[Companies] Insert error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'COMPANY_CREATED', entityType: 'companies', entityId: data.id, after: body, req });
    return Response.json({ data }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
