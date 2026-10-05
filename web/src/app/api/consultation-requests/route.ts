import { NextRequest } from 'next/server';
import { getAuthenticatedUser, badRequest, serverError, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// ── POST /api/consultation-requests ──────────────────────────────────────────
// Developer creates a consultation request for a project.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return badRequest('Unauthorized');

    const { project_id, message, project_paused, pause_reason, request_details } = await req.json();
    if (!project_id || !message?.trim()) {
      return badRequest('project_id and message are required');
    }

    const supabase = getSupabaseAdmin();

    // Verify the project belongs to this developer's company
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, developer_id, status')
      .eq('id', project_id)
      .single();

    if (projErr || !project) return badRequest('Project not found');
    if (project.developer_id !== user.company_id) {
      return badRequest('You can only request consultation for your own projects');
    }

    // Check for an existing active request on this project
    const { data: existing } = await supabase
      .from('consultation_requests')
      .select('id, status')
      .eq('project_id', project_id)
      .in('status', ['pending', 'in_review', 'in_progress'])
      .maybeSingle();

    if (existing) {
      return badRequest(`You already have an active consultation request (${existing.status}) for this project.`);
    }

    // Optionally pause the project
    if (project_paused && !['paused', 'deactivated', 'archived'].includes(project.status)) {
      const { error: pauseErr } = await supabase
        .from('projects')
        .update({
          is_paused: true,
          paused_at: new Date().toISOString(),
          paused_by: user.id,
          pause_reason: pause_reason || 'Paused for consultation',
          status: 'paused',
        })
        .eq('id', project_id);

      if (pauseErr) {
        console.error('Failed to pause project:', pauseErr);
        // Continue — the consultation request is still useful even if pause fails
      }
    }

    // Create the consultation request
    const { data: request, error: insertErr } = await supabase
      .from('consultation_requests')
      .insert({
        project_id,
        developer_id: user.id,
        company_id: user.company_id,
        message: message.trim(),
        project_paused: project_paused || false,
        request_details: request_details || {},
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return Response.json({ success: true, data: request });
  } catch (err) {
    return handleRouteError(err);
  }
}

// ── GET /api/consultation-requests ───────────────────────────────────────────
// Developer: lists their own requests. Admin: lists all requests.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return badRequest('Unauthorized');

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    let query = supabase
      .from('consultation_requests')
      .select(`
        *,
        project:projects(id, name, status, technology_type, location_country, project_size_mw),
        admin:user_profiles!consultation_requests_admin_id_fkey(full_name, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Admin sees all, developer sees only their own
    if (!user.is_platform_admin) {
      query = query.eq('developer_id', user.id);
    }

    // Optional status filter
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return Response.json({
      success: true,
      data: data ?? [],
      pagination: { page, limit, total: count ?? 0 },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
