import { NextRequest } from 'next/server';
import { getAuthenticatedUser, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const body = await req.json();

    const { data: existing, error: fetchError } = await supabase
      .from('partner_requests')
      .select('id, partner_company_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return Response.json({ error: 'Request not found' }, { status: 404 });
    }

    if (!user.is_platform_admin && existing.partner_company_id !== user.company_id) {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }

    const allowedUpdates: Record<string, unknown> = {};
    if (body.status) {
      if (!['accepted', 'declined', 'viewed'].includes(body.status)) {
        return Response.json({ error: 'Invalid status' }, { status: 400 });
      }
      allowedUpdates.status = body.status;
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('partner_requests')
      .update(allowedUpdates)
      .eq('id', id)
      .select('*, partner:companies(id, name, logo_url), project:projects(id, name)')
      .single();

    if (error) {
      console.error('[PartnerRequests] Update error:', error.message);
      return Response.json({ error: 'Failed to update' }, { status: 500 });
    }

    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
