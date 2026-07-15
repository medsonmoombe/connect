import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, writeAuditLog, handleRouteError, pickFields } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { createProjectSchema } from '@/lib/project-validation';
import { checkRateLimit, RATE_LIMIT_API } from '@/lib/rate-limit';

const PROJECT_FIELDS = [
  'name', 'technology_type', 'location_country', 'location_region',
  'project_size_mw', 'capital_required', 'capital_structure_type',
  'governance_terms', 'exit_terms', 'risk_disclosures', 'project_stage',
  'target_financial_close_date', 'target_cod',
  'has_secured_land', 'land_title_status',
  'has_reached_financial_close', 'regulatory_approvals',
];

// GET /api/projects
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);

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
      .select('*, scores:project_scores(*), documents:project_documents(*), developer:companies(*)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Platform admins see all projects; developers see their own; others see only validated
    if (user.is_platform_admin) {
      // no additional filter
    } else if (user.role === 'DEVELOPER') {
      query = query.eq('developer_id', user.company_id);
    } else {
      query = query.eq('status', 'validated');
    }

    const stage = searchParams.get('stage');
    const country = searchParams.get('country');
    const status = searchParams.get('status');
    if (stage) query = query.eq('project_stage', stage);
    if (country) query = query.eq('location_country', country);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      return serverError();
    }
    return Response.json({ data });
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
    return handleRouteError(e);
  }
}
