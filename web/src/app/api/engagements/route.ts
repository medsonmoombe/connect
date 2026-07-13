import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);

    let query = supabase
      .from('engagements')
      .select('*, project:projects(*), messages(*)')
      .order('created_at', { ascending: false });

    const projectId = searchParams.get('project_id');
    const counterpartyId = searchParams.get('counterparty_id');
    if (projectId) query = query.eq('project_id', projectId);
    if (counterpartyId) query = query.eq('counterparty_id', counterpartyId);

    const { data, error } = await query;
    if (error) {
      console.error('[Engagements] Query error:', error.message);
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

    const { data, error } = await supabase.from('engagements').insert(body).select().single();
    if (error) {
      console.error('[Engagements] Insert error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'ENGAGEMENT_CREATED', entityType: 'engagements', entityId: data.id, after: body, req });
    return Response.json({ data }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
