import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, handleRouteError, serverError, badRequest } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isManagementUser } from '@/lib/admin-access';

/**
 * GET /api/authority/projects/[id]
 * Single-project fetch for the regulator review detail page.
 * Returns the full project record + scores + documents + developer, and the
 * review history (from audit logs) for the Review History tab.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!isManagementUser(user)) return forbidden('Only platform and authority management users can view project reviews.');

    const { id } = await params;
    if (!id) return badRequest('Project id is required');

    const admin = getSupabaseAdmin();

    const { data: project, error } = await admin
      .from('projects')
      .select('*, scores:project_scores(*), documents:project_documents(*), developer:companies(*)')
      .is('deleted_at', null)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[Authority/ProjectDetail] Fetch error:', error.message);
      return serverError();
    }
    if (!project) return badRequest('Project not found');

    // Review history — audit trail for this project (approvals, returns, submissions)
    const { data: auditLogs } = await admin
      .from('audit_logs')
      .select('id, action_type, user_id, entity_type, before_state, after_state, timestamp')
      .eq('entity_id', id)
      .in('entity_type', ['projects', 'project'])
      .order('timestamp', { ascending: false })
      .limit(50);

    return Response.json({ data: { ...project, audit_logs: auditLogs ?? [] } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
