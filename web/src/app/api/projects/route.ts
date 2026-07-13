import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

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
    if (user.role !== 'DEVELOPER') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('projects')
      .insert({ ...body, developer_id: user.company_id })
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
