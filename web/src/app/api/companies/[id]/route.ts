import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, forbidden, writeAuditLog, handleRouteError, pickFields } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

const COMPANY_UPDATE_FIELDS = ['name', 'description', 'website', 'location', 'size', 'logo_url'];

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.from('companies').select('*').is('deleted_at', null).eq('id', id).single();
    if (error) {
      console.error('[Companies] Query error:', error.message);
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

    // Platform admins can update any company.
    // Org users must be OWNER or ADMIN of this specific company.
    if (!user.is_platform_admin) {
      const membership = (user.company_members as any[])?.[0];
      const isOrgEditor = (membership?.role === 'OWNER' || membership?.role === 'ADMIN') && membership?.company_id === id;
      if (!isOrgEditor) return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const supabase = getSupabaseAdmin();
    const safeFields = user.is_platform_admin
      ? pickFields(body, [...COMPANY_UPDATE_FIELDS, 'status', 'is_platform_org', 'primary_role'])
      : pickFields(body, COMPANY_UPDATE_FIELDS);

    const { data, error } = await supabase.from('companies').update(safeFields).eq('id', id).select().single();
    if (error) {
      console.error('[Companies] Update error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'COMPANY_UPDATED', entityType: 'companies', entityId: id, after: safeFields, req });
    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('companies').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      console.error('[Companies] Delete error:', error.message);
      return serverError();
    }
    return Response.json({ success: true });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
