import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/view
// Records a PROJECT_VIEW in audit_logs.
// The Postgres trigger fn_increment_project_analytics fires automatically
// and increments project_analytics counters + project_views_daily.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Don't count the project owner's own views
    const { data: project } = await supabase
      .from('projects')
      .select('developer_id')
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (project?.developer_id === user.company_id) {
      return Response.json({ success: true, counted: false });
    }

    await writeAuditLog({
      userId: user.id,
      action: 'PROJECT_VIEW',
      entityType: 'PROJECT',
      entityId: id,
      req,
    });

    return Response.json({ success: true, counted: true });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
