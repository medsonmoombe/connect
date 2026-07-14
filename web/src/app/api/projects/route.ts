import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, writeAuditLog, handleRouteError, pickFields } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const PROJECT_FIELDS = [
  'name', 'technology_type', 'location_country', 'location_region',
  'project_size_mw', 'capital_required', 'capital_structure_type',
  'governance_terms', 'risk_disclosures', 'project_stage',
  'target_financial_close_date', 'target_cod',
  'has_secured_land', 'land_title_status',
  'has_reached_financial_close', 'regulatory_approvals',
];

// GET /api/projects
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);

    let query = supabase
      .from('projects')
      .select('*, scores:project_scores(*), documents:project_documents(*), developer:companies(*)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Developers only see their own projects
    if (user.role === 'DEVELOPER') {
      query = query.eq('developer_id', user.company_id);
    }

    const stage = searchParams.get('stage');
    const country = searchParams.get('country');
    if (stage) query = query.eq('project_stage', stage);
    if (country) query = query.eq('location_country', country);

    const { data, error } = await query;
    if (error) {
      console.error('[Projects] Query error:', error.message);
      return serverError();
    }
    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// POST /api/projects
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const isPlatformAdmin = user.is_platform_admin;
    if (user.role !== 'DEVELOPER' && !isPlatformAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const developerId = isPlatformAdmin ? (body.developer_id || user.company_id) : user.company_id;
    const allowedFields = isPlatformAdmin ? [...PROJECT_FIELDS, 'status'] : PROJECT_FIELDS;
    const safeFields = pickFields(body, allowedFields);

    const { data, error } = await supabase
      .from('projects')
      .insert({ ...safeFields, developer_id: developerId })
      .select()
      .single();

    if (error) {
      console.error('[Projects] Insert error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'PROJECT_CREATED', entityType: 'projects', entityId: data.id, after: body, req });
    return Response.json({ data }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
