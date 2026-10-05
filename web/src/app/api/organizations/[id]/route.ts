import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const COMPANY_FIELDS = 'id, name, primary_role, country, team_size, website, description, contact_email, contact_phone, status, logo_url, registration_number, ownership_structure, ownership_details, management_experience_summary';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;

    if (!user.is_platform_admin && user.company_id !== id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('companies')
      .select(COMPANY_FIELDS)
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (error || !data) return Response.json({ error: 'Not found' }, { status: 404 });

    // Map primary_role → type to match the Company interface
    return Response.json({ data: { ...data, type: data.primary_role } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;

    if (!user.is_platform_admin && user.company_id !== id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const allowed = ['name', 'website', 'description', 'country', 'team_size', 'contact_email', 'contact_phone'];
    const patch = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('companies')
      .update(patch)
      .eq('id', id)
      .select(COMPANY_FIELDS)
      .single();

    if (error) return serverError();
    return Response.json({ data: { ...data, type: data.primary_role } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
