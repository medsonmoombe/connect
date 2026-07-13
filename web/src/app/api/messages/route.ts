import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const engagementId = searchParams.get('engagement_id');
    if (!engagementId) return Response.json({ error: 'engagement_id required' }, { status: 400 });

    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:users(*)')
      .eq('engagement_id', engagementId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Messages] Query error:', error.message);
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

    const { data, error } = await supabase
      .from('messages')
      .insert({ ...body, sender_id: user.id })
      .select()
      .single();

    if (error) {
      console.error('[Messages] Insert error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'MESSAGE_SENT', entityType: 'messages', entityId: data.id, after: { engagement_id: body.engagement_id }, req });
    return Response.json({ data }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
