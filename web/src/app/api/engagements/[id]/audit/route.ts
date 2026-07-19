import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, serverError, handleRouteError, verifyEngagementAccess } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/engagements/{id}/audit
 *
 * Returns the structured engagement state-transition history (PRD §J —
 * `engagement_states`) for the milestone timeline, plus the legacy
 * `audit_logs` entries for full traceability. Access is restricted to
 * engagement participants (or platform admins).
 *
 * Response:
 *   { data: { states: EngagementState[], audit: AuditLog[] } }
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    if (!await verifyEngagementAccess(id, user.company_id, user.is_platform_admin)) return forbidden();

    const supabase = getSupabaseAdmin();

    // Structured state transitions, newest first.
    const { data: states, error: statesErr } = await supabase
      .from('engagement_states')
      .select('id, engagement_id, from_status, to_status, actor_id, reason, created_at')
      .eq('engagement_id', id)
      .order('created_at', { ascending: true });

    if (statesErr) {
      console.error('[Audit] states query error:', statesErr.message);
      return serverError();
    }

    // Resolve actor display names (actor_id is the Supabase auth UUID stored in
    // user_profiles.id). Two-step lookup to match the rest of the codebase.
    const actorIds = Array.from(new Set((states ?? []).map((s: any) => s.actor_id).filter(Boolean)));
    let actorMap: Record<string, { full_name: string | null; email: string | null }> = {};
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', actorIds);
      for (const p of profiles ?? []) actorMap[p.id] = { full_name: p.full_name, email: p.email };
    }

    const statesWithActor = (states ?? []).map((s: any) => ({
      ...s,
      actor: actorMap[s.actor_id] ?? null,
    }));

    // Legacy audit log entries for the engagement (full traceability).
    const { data: audit, error: auditErr } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_id', id)
      .order('timestamp', { ascending: false });

    if (auditErr) {
      console.error('[Audit] audit_logs query error:', auditErr.message);
      // Don't fail the whole request — states are the primary payload.
      return Response.json({ data: { states: statesWithActor, audit: [] } });
    }

    return Response.json({ data: { states: statesWithActor, audit: audit ?? [] } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
