import { NextRequest } from 'next/server';
import { getAuthenticatedUser, badRequest, serverError, handleRouteError, writeAuditLog, forbidden } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;
    const body = await req.json();
    const admin = getSupabaseAdmin();

    const { technical_partner_id, compatibility_score, score_breakdown } = body;

    if (!technical_partner_id || compatibility_score === undefined) {
      return badRequest('technical_partner_id and compatibility_score are required');
    }

    if (compatibility_score < 0 || compatibility_score > 100) {
      return badRequest('compatibility_score must be between 0 and 100');
    }

    const { data: project, error: projectError } = await admin
      .from('projects')
      .select('developer_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) return badRequest('Project not found');

    if (!user.is_platform_admin && project.developer_id !== user.company_id) {
      return forbidden();
    }

    const { data, error } = await admin
      .from('technical_match_results')
      .upsert(
        {
          project_id: projectId,
          technical_partner_id,
          compatibility_score: Math.round(compatibility_score),
          score_breakdown: score_breakdown ?? {},
          status: 'active',
        },
        { onConflict: 'project_id,technical_partner_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[TechnicalMatches] Insert error:', error.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'TECHNICAL_MATCH_CREATED',
      entityType: 'technical_match_results',
      entityId: data.id,
      after: { project_id: projectId, technical_partner_id, score: compatibility_score },
      req,
    });

    return Response.json({ data }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
