import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, forbidden, writeAuditLog, handleRouteError, pickFields, verifyEngagementAccess } from '@/lib/api-helpers';
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

    if (!user.is_platform_admin) {
      const { data: devProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('developer_id', user.company_id);
      const projectIds = (devProjects ?? []).map((p: any) => p.id);
      query = query.or(
        `counterparty_id.eq.${user.company_id}` +
        (projectIds.length > 0 ? `,project_id.in.(${projectIds.join(',')})` : '')
      );
    }

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
    const safeFields = pickFields(body, ['project_id', 'counterparty_type']);

    const { data, error } = await supabase.from('engagements').insert({
      ...safeFields,
      developer_org_id: user.company_id,
      partner_org_id: null,
      status: 'INTRO_SENT',
    }).select().single();
    if (error) {
      console.error('[Engagements] Insert error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'ENGAGEMENT_CREATED', entityType: 'engagements', entityId: data.id, after: safeFields, req });
    return Response.json({ data }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
