import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, writeAuditLog, handleRouteError, pickFields } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { createProjectSchema } from '@/lib/project-validation';
import { checkRateLimit, RATE_LIMIT_API } from '@/lib/rate-limit';
import { ensureActivationCron } from '@/lib/cron-setup';

const PROJECT_FIELDS = [
  'name', 'technology_type', 'location_country', 'location_region',
  'project_size_mw', 'capital_required', 'capital_structure_type',
  'governance_terms', 'exit_terms', 'risk_disclosures', 'project_stage',
  'target_financial_close_date', 'target_cod',
  'has_secured_land', 'land_title_status',
  'has_reached_financial_close', 'regulatory_approvals',
];


export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();

    ensureActivationCron().catch(() => {});
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view');
    const isLeanView = view === 'dashboard' || view === 'marketplace';
    const projectSelect = isLeanView
      ? 'id, name, technology_type, location_country, location_region, project_size_mw, capital_required, capital_structure_type, project_stage, status, is_visible_to_investors, scores_visible_at, created_at, updated_at, scores:project_scores(capital_readiness_score, technical_readiness_score), documents:project_documents(id), developer:companies(id, name, logo_url)'
      : '*, scores:project_scores(*), documents:project_documents(*), developer:companies(*)';

    // Special mode: internal reviewer sees draft projects pending their review
    if (searchParams.get('pending_internal_review') === 'true') {
      // Check if user is a designated internal reviewer
      const { data: org } = await supabase
        .from('companies')
        .select('id, project_submission_mode, internal_reviewer_id')
        .eq('internal_reviewer_id', user.id)
        .eq('project_submission_mode', 'internal_review')
        .single();

      if (!org) {
        return Response.json({ data: [] });
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*, scores:project_scores(*), documents:project_documents(*), developer:companies(*)')
        .eq('developer_id', org.id)
        .eq('status', 'pending_internal_review')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) return serverError();
      return Response.json({ data });
    }

    let query = supabase
      .from('projects')
      .select(projectSelect)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Platform admins see all; developers see their own; others see only live visible projects
    if (user.is_platform_admin) {
      const statusFilter = searchParams.get('status');
      if (statusFilter) query = query.eq('status', statusFilter);
    } else if (user.role === 'DEVELOPER') {
      if (!user.company_id) return Response.json({ data: [] });
      query = query.eq('developer_id', user.company_id);
    } else {
      query = query.eq('status', 'live').eq('is_visible_to_investors', true);
    }

    const stage = searchParams.get('stage');
    const country = searchParams.get('country');
    if (stage) query = query.eq('project_stage', stage);
    if (country) query = query.eq('location_country', country);

    const { data, error } = await query;
    if (error) {
      return serverError();
    }
    const rows = (data ?? []) as any[];

    // Optionally attach builder_partner_name via accepted EPC engagements
    if (searchParams.get('include') === 'epc' && rows.length > 0) {
      const projectIds = rows.map((p: any) => p.id);
      const { data: epcEngagements } = await supabase
        .from('engagements')
        .select('project_id, counterparty_id')
        .in('project_id', projectIds)
        .eq('counterparty_type', 'TECHNICAL')
        .in('status', ['INTRO_ACCEPTED', 'NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED']);

      if (epcEngagements && epcEngagements.length > 0) {
        const cpIds = [...new Set(epcEngagements.map((e: any) => e.counterparty_id))];
        const { data: techPartners } = await supabase
          .from('technical_partners')
          .select('id, company:companies(name)')
          .in('id', cpIds);

        const cpToName = new Map((techPartners ?? []).map((tp: any) => [tp.id, (tp.company as any)?.name]));
        const projToBuilder = new Map(epcEngagements.map((e: any) => [e.project_id, cpToName.get(e.counterparty_id)]));

        for (const p of rows) {
          (p as any).builder_partner_name = projToBuilder.get(p.id) ?? null;
        }
      }
    }

    // Optionally attach capital match scores for the current partner
    if (searchParams.get('include') === 'scores' && rows.length > 0) {
      const { data: capPartner } = await supabase
        .from('capital_partners')
        .select('id')
        .eq('company_id', user.company_id)
        .maybeSingle();

      if (capPartner) {
        const projectIds = rows.map((p: any) => p.id);
        const { data: matchRows } = await supabase
          .from('capital_match_results')
          .select('project_id, compatibility_score')
          .eq('capital_partner_id', capPartner.id)
          .in('project_id', projectIds);

        const scoreMap = new Map((matchRows ?? []).map((m: any) => [m.project_id, m.compatibility_score]));
        for (const p of rows) {
          (p as any).partner_match_score = scoreMap.get(p.id) ?? null;
        }
      }
    }

    return Response.json({ data: rows });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// POST /api/projects — create a draft project
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const isPlatformAdmin = user.is_platform_admin;

    if (user.role !== 'DEVELOPER' && !isPlatformAdmin) {
      return Response.json({ error: 'Only developers can create projects' }, { status: 403 });
    }

    // Rate limit: 30 project creates per hour per user (auto-save drafts)
    const rl = checkRateLimit(user.id, { prefix: 'project-create', limit: 30, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
    }

    const body = await req.json();

    // Validate with zod
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return Response.json(
        { error: `${firstError.path.join('.')}: ${firstError.message}` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const developerId = isPlatformAdmin ? (body.developer_id || user.company_id) : user.company_id;

    const safeFields = pickFields(parsed.data, PROJECT_FIELDS);

    // Convert empty strings to null for date columns
    if (safeFields.target_financial_close_date === '') safeFields.target_financial_close_date = null;
    if (safeFields.target_cod === '') safeFields.target_cod = null;

    const { data, error } = await supabase
      .from('projects')
      .insert({ ...safeFields, developer_id: developerId, created_by: user.id, status: 'draft' })
      .select()
      .single();

    if (error) {
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'PROJECT_CREATED',
      entityType: 'projects',
      entityId: data.id,
      after: parsed.data,
      req,
    });

    return Response.json({ data }, { status: 201 });
  } catch (e: any) {
    console.log("ERROR IN PROJECTS ROUTE ::", e);
    return handleRouteError(e);
  }
}
