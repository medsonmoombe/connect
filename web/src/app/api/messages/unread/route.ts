import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/messages/unread
 *
 * Returns unread message counts per engagement for the authenticated user, plus
 * a total. "Unread" = messages with created_at > the user's last_read_at for
 * that engagement (and created_at > the engagement's created_at if no
 * last_read_at exists yet, i.e. never opened), authored by someone other than
 * the user.
 *
 * Only engagements the user is a party to are counted (a join on the user's
 * engagement ids, computed server-side via their company memberships).
 *
 * Response: { data: { total: number, by_engagement: { [engagementId: string]: number } } }
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const admin = getSupabaseAdmin();

    // Resolve the engagement ids the user is a party to (developer or counterparty).
    // Developer side: engagements on their projects.
    const { data: devProjects } = await admin
      .from('projects')
      .select('id')
      .eq('developer_id', user.company_id);
    const devProjectIds = (devProjects ?? []).map((p: any) => p.id);

    const orClauses: string[] = [];
    if (devProjectIds.length > 0) {
      orClauses.push(`project_id.in.(${devProjectIds.join(',')})`);
    }

    // Counterparty side: find their capital_partners / technical_partners records.
    const { data: cp } = await admin.from('capital_partners').select('id').eq('company_id', user.company_id).maybeSingle();
    const { data: tp } = await admin.from('technical_partners').select('id').eq('company_id', user.company_id).maybeSingle();
    if (cp?.id) orClauses.push(`counterparty_id.eq.${cp.id},counterparty_type.eq.CAPITAL`);
    if (tp?.id) orClauses.push(`counterparty_id.eq.${tp.id},counterparty_type.eq.TECHNICAL`);

    if (orClauses.length === 0) return Response.json({ data: { total: 0, by_engagement: {} } });

    const { data: engagements, error: engErr } = await admin
      .from('engagements')
      .select('id')
      .or(orClauses.join(','));

    if (engErr) {
      console.error('[Messages/unread] engagements error:', engErr.message);
      return serverError();
    }
    const engagementIds = (engagements ?? []).map((e: any) => e.id);
    if (engagementIds.length === 0) return Response.json({ data: { total: 0, by_engagement: {} } });

    // Fetch the user's last_read_at per engagement.
    const { data: readRows } = await admin
      .from('messages_read')
      .select('engagement_id, last_read_at')
      .eq('user_id', user.id)
      .in('engagement_id', engagementIds);

    const lastRead: Record<string, string> = {};
    for (const r of readRows ?? []) lastRead[r.engagement_id] = r.last_read_at;

    // Fetch all non-deleted messages for these engagements, then count unread in
    // memory (cheap for the small number of active engagements a user has).
    const { data: messages, error: msgErr } = await admin
      .from('messages')
      .select('engagement_id, sender_id, created_at')
      .is('deleted_at', null)
      .in('engagement_id', engagementIds);

    if (msgErr) {
      console.error('[Messages/unread] messages error:', msgErr.message);
      return serverError();
    }

    const byEngagement: Record<string, number> = {};
    let total = 0;
    for (const m of messages ?? []) {
      if (m.sender_id === user.id) continue; // own messages are never unread
      const threshold = lastRead[m.engagement_id] ?? '1970-01-01T00:00:00Z';
      if (new Date(m.created_at) > new Date(threshold)) {
        byEngagement[m.engagement_id] = (byEngagement[m.engagement_id] ?? 0) + 1;
        total += 1;
      }
    }

    return Response.json({ data: { total, by_engagement: byEngagement } });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
