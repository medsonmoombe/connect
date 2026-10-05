import { NextRequest } from 'next/server';
import { getAuthenticatedUser, forbidden, serverError, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const SELECT_FIELDS =
  'id, user_id, action_type, entity_type, entity_id, timestamp, before_state, after_state' as const;

type FilterCtx = {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  isPlatformAdmin: boolean;
  orgUserIds: string[];
};

const NOISE_ACTIONS = [
  'USER_LOGGED_IN',
  'USER_LOGGED_OUT',
  'NOTIFICATIONS_READ',
  'NOTIFICATIONS_DELETED',
  'PROFILE_UPDATED',
  'PASSWORD_FORGOT_REQUESTED',
  'PASSWORD_RESET',
  'ONBOARDING_UPDATE_PROFILE',
  'ONBOARDING_SAVE_PREFERENCES',
  'PARTNER_UPSERTED',
  'PROJECT_VIEW',
  'PROJECT_SCORES_UPDATED',
  'PROJECT_TECH_UPDATED',
  'DOCUMENT_ADDED',
  'MESSAGE_SENT',
];

interface Filters {
  action_type?: string;
  entity_type?: string;
  user_id?: string;
  from?: string;
  to?: string;
}

/**
 * Build a Supabase query chain with ALL filters (role scope + optional + noise exclusion)
 * applied identically. Returns the PostgrestFilterBuilder so the caller can chain
 * `.range()`, await for count, etc.
 */
function buildBaseQuery(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  ctx: FilterCtx,
  filters: Filters,
) {
  let q = supabase.from('audit_logs').select(SELECT_FIELDS, { count: 'exact' });

  // 1. Role scope
  if (!ctx.isPlatformAdmin && ctx.orgUserIds.length > 0) {
    q = q.in('user_id', ctx.orgUserIds);
  }

  // 2. Optional filters
  if (filters.action_type) q = q.eq('action_type', filters.action_type);
  if (filters.entity_type) q = q.eq('entity_type', filters.entity_type);
  if (filters.user_id) q = q.eq('user_id', filters.user_id);
  if (filters.from) q = q.gte('timestamp', filters.from);
  if (filters.to) q = q.lte('timestamp', filters.to);

  // 3. Exclude noise
  q = q.not('action_type', 'in', `(${NOISE_ACTIONS.join(',')})`);

  // 4. Always newest-first
  q = q.order('timestamp', { ascending: false });

  return q;
}

/**
 * GET /api/audit-logs
 *
 * Returns audit log entries scoped to the user's role:
 *   - Platform admin: all logs across the platform
 *   - Org admin:      logs for the user's organisation only
 *
 * Supports server-side pagination via `limit` (default 20) and `offset` (default 0).
 * Optional filters: `action_type`, `entity_type`, `user_id`, `from`, `to`.
 * Also supports `actor_search` — a partial full_name / email search over actors.
 *
 * Response: { data: AuditLog[], total: number }
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getSupabaseAdmin();

    const membership = (user.company_members as any[])?.[0];
    const isPlatformAdmin = user.is_platform_admin;
    const isOrgAdmin = !isPlatformAdmin && membership && ['OWNER', 'ADMIN'].includes(membership.role);

    if (!isPlatformAdmin && !isOrgAdmin) {
      return forbidden('Audit logs are available to organisation admins and platform administrators.');
    }

    // ── Resolve org user ids once (for org admins) ───────────────────────────
    let orgUserIds: string[] = [];
    if (!isPlatformAdmin && isOrgAdmin && membership?.company_id) {
      const { data: memberRows } = await supabase
        .from('company_members')
        .select('user_id')
        .eq('company_id', membership.company_id)
        .is('deleted_at', null);
      orgUserIds = (memberRows ?? []).map((m: any) => m.user_id).filter(Boolean);
      if (orgUserIds.length === 0) {
        return Response.json({ data: [], total: 0 });
      }
    }

    const ctx: FilterCtx = { supabase, isPlatformAdmin, orgUserIds };

    // ── Parse query params ───────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10), 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0);

    const filters: Filters = {
      action_type: searchParams.get('action_type') || undefined,
      entity_type: searchParams.get('entity_type') || undefined,
      user_id: searchParams.get('user_id') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
    };

    const rawActorSearch = (searchParams.get('actor_name') || '').trim().slice(0, 100);

    // ── Actor-name search → resolve user_ids once ────────────────────────────
    let actorMatchedIds: string[] | null = null;
    if (rawActorSearch) {
      const { data: matchedProfiles } = await supabase
        .from('user_profiles')
        .select('id')
        .or(`full_name.ilike.%${rawActorSearch}%,email.ilike.%${rawActorSearch}%`);

      actorMatchedIds = (matchedProfiles ?? []).map((p: any) => p.id).filter(Boolean);
      if (actorMatchedIds.length === 0) {
        return Response.json({ data: [], total: 0 });
      }

      // If an explicit user_id filter is also set, intersect them
      if (filters.user_id && !actorMatchedIds.includes(filters.user_id)) {
        return Response.json({ data: [], total: 0 });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  BUILD IDENTICAL QUERY TWICE — once for count, once for paginated data
    // ═══════════════════════════════════════════════════════════════════════

    let countQuery = buildBaseQuery(supabase, ctx, filters);
    if (actorMatchedIds) countQuery = countQuery.in('user_id', actorMatchedIds);

    const { count: total, error: countError } = await countQuery;
    if (countError) {
      console.error('[AuditLogs] Count error:', countError.message);
      return serverError();
    }

    // ── Paginated data — same builder, then add .range() ─────────────────────
    let dataQuery = buildBaseQuery(supabase, ctx, filters);
    if (actorMatchedIds) dataQuery = dataQuery.in('user_id', actorMatchedIds);
    dataQuery = dataQuery.range(offset, offset + limit - 1);

    const { data: logs, error: logsError } = await dataQuery;
    if (logsError) {
      // "Requested range not satisfiable" means the client requested a page beyond
      // available rows — happens when a filter change resets the page but the fetch
      // uses a stale offset. Return empty data instead of 500.
      if (logsError.message?.includes('range not satisfiable')) {
        return Response.json({ data: [], total: total ?? 0 });
      }
      console.error('[AuditLogs] Query error:', logsError.message);
      return serverError();
    }

    // ── Resolve actor names ──────────────────────────────────────────────────
    const actorIds = [...new Set((logs ?? []).map((l: any) => l.user_id).filter(Boolean))];
    const actorMap: Record<string, { full_name: string | null; email: string | null }> = {};
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', actorIds);
      for (const p of profiles ?? []) {
        actorMap[p.id] = { full_name: p.full_name, email: p.email };
      }
    }

    const data = (logs ?? []).map((log: any) => ({
      ...log,
      actor: actorMap[log.user_id] ?? null,
    }));

    return Response.json({ data, total: total ?? 0 });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
