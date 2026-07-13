import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/[id]
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);

    // Sub-resource routing
    const resource = searchParams.get('resource');

    if (resource === 'matches') {
      const [capital, technical] = await Promise.all([
        supabase.from('capital_match_results')
          .select('*, capital_partner:capital_partners(*, company:companies(*))')
          .eq('project_id', id)
          .order('compatibility_score', { ascending: false }),
        supabase.from('technical_match_results')
          .select('*, technical_partner:technical_partners(*, company:companies(*))')
          .eq('project_id', id)
          .order('compatibility_score', { ascending: false }),
      ]);
      return Response.json({ capital: capital.data, technical: technical.data });
    }

    if (resource === 'scores') {
      const { data, error } = await supabase
        .from('project_scores').select('*').eq('project_id', id).single();
      if (error && error.code !== 'PGRST116') {
        console.error('[Projects] Scores query error:', error.message);
        return serverError();
      }
      return Response.json({ data });
    }

    if (resource === 'analytics') {
      const [views, engagements] = await Promise.all([
        supabase.from('audit_logs').select('*').eq('entity_id', id).in('action_type', ['PROJECT_VIEW', 'DATAROOM_ACCESS']),
        supabase.from('engagements').select('*').eq('project_id', id),
      ]);
      const v = views.data || [];
      const e = engagements.data || [];
      return Response.json({
        data: {
          totalViews: v.filter(x => x.action_type === 'PROJECT_VIEW').length,
          dataroomAccess: v.filter(x => x.action_type === 'DATAROOM_ACCESS').length,
          funnel: {
            intro: e.length,
            nda: e.filter(x => ['NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CLOSED'].includes(x.status)).length,
            dueDiligence: e.filter(x => ['DUE_DILIGENCE', 'TERM_SHEET', 'CLOSED'].includes(x.status)).length,
            termSheet: e.filter(x => ['TERM_SHEET', 'CLOSED'].includes(x.status)).length,
            closed: e.filter(x => x.status === 'CLOSED').length,
          },
        },
      });
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*, tech_requirements:project_tech_requirements(*), documents:project_documents(*), scores:project_scores(*), developer:companies(*)')
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (error) {
      console.error('[Projects] Query error:', error.message);
      return serverError();
    }
    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// PATCH /api/projects/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    // sub-resource: tech requirements
    if (body._resource === 'tech_requirements') {
      const { _resource, ...rest } = body;
      const { data, error } = await supabase
        .from('project_tech_requirements')
        .upsert({ ...rest, project_id: id })
        .select().single();
      if (error) {
        console.error('[Projects] Tech requirements error:', error.message);
        return serverError();
      }
      await writeAuditLog({ userId: user.id, action: 'PROJECT_TECH_UPDATED', entityType: 'project_tech_requirements', entityId: id, after: rest, req });
      return Response.json({ data });
    }

    // sub-resource: scores
    if (body._resource === 'scores') {
      const { _resource, ...rest } = body;
      const sanitized = {
        ...rest,
        project_id: id,
        capital_readiness_score: Math.round(rest.capital_readiness_score || 0),
        regulatory_score: Math.round(rest.regulatory_score || 0),
        financial_score: Math.round(rest.financial_score || 0),
        developer_score: Math.round(rest.developer_score || 0),
        technical_readiness_score: Math.round(rest.technical_readiness_score || 0),
        documentation_score: Math.round(rest.documentation_score || 0),
        governance_score: Math.round(rest.governance_score || 0),
        financial_transparency_score: Math.round(rest.financial_transparency_score || 0),
      };
      const { data, error } = await supabase
        .from('project_scores')
        .upsert(sanitized, { onConflict: 'project_id' })
        .select().single();
      if (error) {
        console.error('[Projects] Scores error:', error.message);
        return serverError();
      }
      await writeAuditLog({ userId: user.id, action: 'PROJECT_SCORES_UPDATED', entityType: 'project_scores', entityId: id, after: sanitized, req });
      return Response.json({ data });
    }

    const { data, error } = await supabase
      .from('projects').update(body).eq('id', id).select().single();
    if (error) {
      console.error('[Projects] Update error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'PROJECT_UPDATED', entityType: 'projects', entityId: id, after: body, req });
    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// DELETE /api/projects/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      console.error('[Projects] Delete error:', error.message);
      return serverError();
    }
    return Response.json({ success: true });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
