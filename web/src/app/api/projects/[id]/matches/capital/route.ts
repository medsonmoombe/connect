import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, badRequest, serverError, handleRouteError, writeAuditLog } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;
    const body = await req.json();
    const admin = getSupabaseAdmin();

    const { capital_partner_id, compatibility_score, score_breakdown } = body;

    if (!capital_partner_id || compatibility_score === undefined) {
      return badRequest('capital_partner_id and compatibility_score are required');
    }

    if (compatibility_score < 0 || compatibility_score > 100) {
      return badRequest('compatibility_score must be between 0 and 100');
    }

    const { data, error } = await admin
      .from('capital_match_results')
      .upsert(
        {
          project_id: projectId,
          capital_partner_id,
          compatibility_score: Math.round(compatibility_score),
          score_breakdown: score_breakdown ?? {},
        },
        { onConflict: 'project_id,capital_partner_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[CapitalMatches] Insert error:', error.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'CAPITAL_MATCH_CREATED',
      entityType: 'capital_match_results',
      entityId: data.id,
      after: { project_id: projectId, capital_partner_id, score: compatibility_score },
      req,
    });

    return Response.json({ data }, { status: 201 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
