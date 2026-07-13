import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('engagements')
      .select('*, project:projects(*), messages(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[Engagements] Query error:', error.message);
      return serverError();
    }
    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('engagements')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Engagements] Update error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'ENGAGEMENT_UPDATED', entityType: 'engagements', entityId: id, after: body, req });
    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
