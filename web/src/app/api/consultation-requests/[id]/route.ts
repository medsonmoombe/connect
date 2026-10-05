import { NextRequest } from 'next/server';
import { getAuthenticatedUser, badRequest, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

// ── GET /api/consultation-requests/[id] ──────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(_req);
    if (!user) return badRequest('Unauthorized');

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('consultation_requests')
      .select(`
        *,
        project:project_id(id, name, status, technology_type, location_country, location_region,
          project_size_mw, capital_required, description),
        admin:admin_id(full_name, email),
        developer:developer_id(full_name, email)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('[consultation GET error]', error);
      return badRequest('Consultation request not found');
    }

    // Ensure developer_replies exists even if column not yet migrated
    if (!Array.isArray((data as any).developer_replies)) {
      (data as any).developer_replies = [];
    }

    // Access control: developer can only see their own, admins see all
    if (!user.is_platform_admin && data.developer_id !== user.id) {
      return badRequest('Access denied');
    }

    return Response.json({ success: true, data });
  } catch (err) {
    return handleRouteError(err);
  }
}

// ── PATCH /api/consultation-requests/[id] ────────────────────────────────────
// Admin: update status, assign, add notes, resolve.
// Developer: add a reply to their own active request.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return badRequest('Unauthorized');

    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const { data: existing, error: fetchErr } = await supabase
      .from('consultation_requests')
      .select('id, status, developer_id, project_id, admin_notes, admin_id')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return badRequest('Consultation request not found');

    // Developer can only add a reply to their own request
    if (!user.is_platform_admin) {
      if (existing.developer_id !== user.id) return badRequest('Access denied');
      if (!body.developer_reply?.trim()) return badRequest('Reply text is required');
      // Fetch current developer_replies separately (column may be new)
      const { data: full } = await supabase
        .from('consultation_requests')
        .select('developer_replies')
        .eq('id', id)
        .single();
      const replies = Array.isArray(full?.developer_replies) ? full.developer_replies : [];
      replies.push({
        text: body.developer_reply.trim(),
        created_at: new Date().toISOString(),
        author_name: user.full_name || user.email,
      });
      const { data, error } = await supabase
        .from('consultation_requests')
        .update({ developer_replies: replies })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return Response.json({ success: true, data });
    }

    const update: Record<string, any> = {};

    if (body.assign_to_self) {
      update.admin_id = user.id;
      if (['pending', 'in_review'].includes(existing.status)) update.status = 'in_review';
    }

    if (body.status && ['in_review', 'in_progress', 'resolved', 'cancelled'].includes(body.status)) {
      update.status = body.status;
      if (body.status === 'resolved') {
        update.resolved_at = new Date().toISOString();
        if (body.resolution_summary) update.resolution_summary = body.resolution_summary;
      }
    }

    if (body.note) {
      const notes = Array.isArray(existing.admin_notes) ? existing.admin_notes : [];
      notes.push({
        text: body.note,
        created_at: new Date().toISOString(),
        admin_id: user.id,
        admin_name: user.full_name || user.email,
        is_admin_note: body.is_admin_note !== false,
      });
      update.admin_notes = notes;
    }

    if (body.pause_project) {
      await supabase.from('projects').update({
        is_paused: true,
        paused_at: new Date().toISOString(),
        paused_by: user.id,
        pause_reason: body.pause_reason || 'Paused by admin during consultation',
        status: 'paused',
      }).eq('id', existing.project_id);
    }

    if (body.resume_project) {
      await supabase.from('projects').update({
        is_paused: false,
        paused_at: null,
        paused_by: null,
        pause_reason: null,
        status: 'draft',
      }).eq('id', existing.project_id);
    }

    if (Object.keys(update).length === 0) return badRequest('No valid fields to update');

    const { data, error } = await supabase
      .from('consultation_requests')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return Response.json({ success: true, data });
  } catch (err) {
    return handleRouteError(err);
  }
}
