import { NextRequest } from 'next/server';
import { getAuthenticatedUser, badRequest, forbidden, writeAuditLog, handleRouteError, verifyProjectOwnership } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';
import { runStageDetermination } from '@/lib/ai-analysis';
import { stageNumberToEnum } from '@/lib/project-stages';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/stage
 *
 * Mid-form AI stage determination. Fired after the developer completes the
 * step-1/step-2 information, before they continue to the project-stage step.
 * Determines a PRELIMINARY 8-stage position from the form data only (documents
 * are not attached yet). It is explicitly NOT persisted as the project's stage
 * and is NOT authoritative — the final, document-verified stage is set by the
 * analyze route at submission. Returned with `preliminary: true` so the UI
 * labels it as an estimate.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id: projectId } = await params;

    if (!await verifyProjectOwnership(projectId, user.company_id, user.is_platform_admin)) {
      return forbidden('Only the project owner or a platform admin can determine the project stage.');
    }

    // Lighter rate limit than full analysis — the user may retry after edits.
    const rateLimitResult = await checkRateLimit(user.id, { prefix: 'ai-stage', limit: 20, windowMs: 60 * 60_000 });
    if (!rateLimitResult.allowed) {
      return Response.json(
        { error: 'Stage determination limit reached. Maximum 20 checks per hour.' },
        { status: 429 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select('name, technology_type, location_country, location_region, project_size_mw, capital_required, capital_structure_type, capex, opex, funding_required, description, has_secured_land, land_title_status, has_reached_financial_close, regulatory_approvals, target_financial_close_date, target_cod, governance_terms, risk_disclosures')
      .eq('id', projectId)
      .single();

    if (projectErr || !project) {
      return badRequest('Project not found');
    }

    const { data: techReq } = await supabase
      .from('project_tech_requirements')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    const analysisContext = {
      name: project.name,
      technology_type: project.technology_type,
      location_country: project.location_country,
      location_region: project.location_region,
      project_size_mw: project.project_size_mw,
      capital_required: project.capital_required,
      capital_structure_type: project.capital_structure_type,
      capex: project.capex,
      opex: project.opex,
      funding_required: project.funding_required,
      description: project.description,
      has_secured_land: project.has_secured_land,
      land_title_status: project.land_title_status,
      has_reached_financial_close: project.has_reached_financial_close,
      regulatory_approvals: project.regulatory_approvals,
      target_financial_close_date: project.target_financial_close_date,
      target_cod: project.target_cod,
      governance_terms: project.governance_terms,
      risk_disclosures: project.risk_disclosures,
      tech_requirements: techReq ?? undefined,
    };

    if (!process.env.GEMINI_API_KEY) {
      return Response.json(
        { success: false, data: null, error: 'AI service is not configured — GEMINI_API_KEY is missing on the server.' },
        { status: 503 }
      );
    }

    const result = await runStageDetermination(analysisContext);

    const stageEnum = stageNumberToEnum(result.determined_stage);
    if (!stageEnum) {
      console.error('[Stage] AI returned no valid stage:', result);
      return Response.json(
        { success: false, data: null, error: 'The AI could not determine a stage from the information provided. You can continue — the stage will be set at submission.' },
        { status: 422 }
      );
    }

    // NOTE: deliberately NOT persisted to projects.project_stage. This is a
    // form-only estimate; the authoritative, document-verified stage is set by
    // the analyze route at submission. Persisting it here previously caused
    // misleading stages (e.g. "PPA Ready" from ticked form boxes) to leak into
    // the project record before any document was read.

    await writeAuditLog({
      userId: user.id,
      action: 'PROJECT_STAGE_DETERMINED',
      entityType: 'projects',
      entityId: projectId,
      after: { project_stage: stageEnum, rationale: result.stage_rationale ?? null },
      req,
    });

    return Response.json({
      success: true,
      data: {
        stage: stageEnum,
        stage_rationale: result.stage_rationale ?? '',
        recommended_services: Array.isArray(result.recommended_services) ? result.recommended_services : [],
        preliminary: true,
      },
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
