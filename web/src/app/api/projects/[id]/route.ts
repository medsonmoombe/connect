import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, forbidden, writeAuditLog, handleRouteError, pickFields, verifyProjectOwnership } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { activateAndNotify } from '@/lib/activation-notify';

type Params = { params: Promise<{ id: string }> };

const PROJECT_UPDATE_FIELDS = [
  'name', 'technology_type', 'location_country', 'location_region',
  'project_size_mw', 'capital_required', 'capital_structure_type',
  'governance_terms', 'exit_terms', 'risk_disclosures', 'project_stage',
  'target_financial_close_date', 'target_cod',
  'has_secured_land', 'land_title_status',
  'has_reached_financial_close', 'regulatory_approvals',
  'rejection_reason',
];

const EDITABLE_STATUSES = ['draft', 'scoring', 'pending_live', 'deactivated'];

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
      const { data: projectAccess, error: projectAccessError } = await supabase
        .from('projects')
        .select('developer_id')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (projectAccessError || !projectAccess) {
        console.error('[Projects] Match access query error:', projectAccessError?.message);
        return serverError();
      }

      const canViewProjectMatches = user.is_platform_admin || projectAccess.developer_id === user.company_id;
      if (!canViewProjectMatches) return forbidden();

      // PRD §4.A/H: each party sees their ranked TOP-5 matches. We cap by default
      // but allow an explicit limit for the admin's full view. Only `active`
      // matches are returned (PRD §5.2 — stale matches are marked inactive, not
      // deleted).
      const TOP_N = 5;
      const requestedLimit = Number(searchParams.get('limit')) || TOP_N;
      const matchLimit = user.is_platform_admin
        ? Math.min(Math.max(requestedLimit, 1), 100)
        : Math.min(Math.max(requestedLimit, 1), TOP_N);

      const [capital, technical] = await Promise.all([
        supabase.from('capital_match_results')
          .select('*, capital_partner:capital_partners(*, company:companies(*))')
          .eq('project_id', id)
          .eq('status', 'active')
          .order('compatibility_score', { ascending: false })
          .limit(matchLimit),
        supabase.from('technical_match_results')
          .select('*, technical_partner:technical_partners(*, company:companies(*))')
          .eq('project_id', id)
          .eq('status', 'active')
          .order('compatibility_score', { ascending: false })
          .limit(matchLimit),
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

    // Lazy activation: if project is pending_live and timer elapsed, activate now
    if (data?.status === 'pending_live' && data?.scores_visible_at) {
      const visibleAt = new Date(data.scores_visible_at);
      if (visibleAt <= new Date()) {
        const { activated } = await activateAndNotify(id);
        if (activated) {
          data.status = 'live';
          data.is_visible_to_investors = true;
        }
      }
    }

    // Non-owners can only see live visible projects
    const isOwner = user.is_platform_admin || data?.developer_id === user.company_id;
    if (!isOwner) {
      if (data?.status !== 'live' || !data?.is_visible_to_investors) {
        return forbidden();
      }
    }
    if (!isOwner && data?.scores_visible_at) {
      const visibleAt = new Date(data.scores_visible_at);
      if (visibleAt > new Date()) {
        data.scores = null;
      }
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
      if (!await verifyProjectOwnership(id, user.company_id, user.is_platform_admin)) return forbidden();
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
      // Preserve documents_hash if not explicitly provided (e.g. manual overrides)
      if (!sanitized.documents_hash) delete sanitized.documents_hash;
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

    // Ownership check for direct project updates
    if (!await verifyProjectOwnership(id, user.company_id, user.is_platform_admin)) return forbidden();

    // Status-gated edits: only draft/scoring/live/deactivated can be edited
    const { data: projStatus } = await supabase
      .from('projects')
      .select('status, developer_id')
      .eq('id', id)
      .single();

    if (projStatus && !EDITABLE_STATUSES.includes(projStatus.status) && !user.is_platform_admin) {
      return Response.json(
        { error: `Cannot edit project in '${projStatus.status}' status.` },
        { status: 403 }
      );
    }

    // Engagement lock: block edits if active investor discussions are ongoing
    if (!user.is_platform_admin) {
      const { count: activeEngagements } = await supabase
        .from('engagements')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id)
        .in('status', ['NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET']);

      if (activeEngagements && activeEngagements > 0) {
        return Response.json(
          { error: 'This project has active investor discussions. Edits are locked until discussions conclude.' },
          { status: 403 }
        );
      }
    }

    const allowedFields = user.is_platform_admin
      ? [...PROJECT_UPDATE_FIELDS, 'status']
      : PROJECT_UPDATE_FIELDS;
    const safeFields = pickFields(body, allowedFields);

    const { data, error } = await supabase
      .from('projects').update(safeFields).eq('id', id).select().single();
    if (error) {
      console.error('[Projects] Update error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'PROJECT_UPDATED', entityType: 'projects', entityId: id, after: safeFields, req });
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

    if (!await verifyProjectOwnership(id, user.company_id, user.is_platform_admin)) return forbidden();

    // Engagement lock: block deletion if active investor discussions are ongoing
    if (!user.is_platform_admin) {
      const { count: activeEngagements } = await supabase
        .from('engagements')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id)
        .in('status', ['NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET']);

      if (activeEngagements && activeEngagements > 0) {
        return Response.json(
          { error: 'This project has active investor discussions and cannot be deleted.' },
          { status: 403 }
        );
      }
    }

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
