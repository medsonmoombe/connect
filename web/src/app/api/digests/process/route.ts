import { NextRequest } from 'next/server';
import { getAuthenticatedUser, handleRouteError, forbidden } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email';
import * as templates from '@/lib/email-templates';

/**
 * POST /api/digests/process
 * Processes and sends scheduled matching digests.
 * Should be called by a cron job or admin action.
 * For now, can be triggered manually or via pg_cron.
 */
export async function POST(req: NextRequest) {
  try {
    // Only admins or internal cron can trigger this
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // Find users with scheduled digests that are due
    const { data: dueDigests, error } = await supabase
      .from('matching_digests')
      .select('*')
      .neq('frequency', 'off')
      .lte('next_scheduled_at', now)
      .or('next_scheduled_at.is.null');

    if (error || !dueDigests || dueDigests.length === 0) {
      return Response.json({ data: { processed: 0, message: 'No digests due' } });
    }

    let processed = 0;
    let sent = 0;

    for (const digest of dueDigests) {
      processed++;
      try {
        // Fetch user info
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .eq('id', digest.user_id)
          .single();

        if (!profile) continue;

        // Fetch user's email from auth
        const { data: authUser } = await supabase.auth.admin.getUserById(digest.user_id);
        const email = authUser?.user?.email;
        if (!email) continue;

        // Fetch new matches since last digest.
        // NOTE: there is no `match_results` table — match scores live in
        // per-partner-type tables keyed by partner-profile IDs, which map to
        // the user via company membership (same pattern as /api/engagements).
        const sinceDate = digest.last_sent_at ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data: profileCompany } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', digest.user_id)
          .single();

        const companyId = profileCompany?.company_id ?? null;
        let newMatches: { project_id: string; compatibility_score: number; created_at: string }[] = [];

        if (companyId) {
          // Resolve all partner-profile IDs belonging to this company
          const [capRes, techRes, consRes, grantRes, grantProvRes, traderRes] = await Promise.all([
            supabase.from('capital_partners').select('id').eq('company_id', companyId),
            supabase.from('technical_partners').select('id').eq('company_id', companyId),
            supabase.from('consultants').select('id').eq('company_id', companyId),
            supabase.from('grant_providers').select('id').eq('company_id', companyId),
            supabase.from('grant_providers').select('id').eq('company_id', companyId),
            supabase.from('power_traders').select('id').eq('company_id', companyId),
          ]);

          const matchQueries = [
            { table: 'capital_match_results', col: 'capital_partner_id', ids: (capRes.data ?? []).map((p: any) => p.id) },
            { table: 'technical_match_results', col: 'technical_partner_id', ids: (techRes.data ?? []).map((p: any) => p.id) },
            { table: 'consultant_match_results', col: 'consultant_id', ids: (consRes.data ?? []).map((p: any) => p.id) },
            { table: 'grant_match_results', col: 'grant_provider_id', ids: (grantRes.data ?? []).map((p: any) => p.id) },
            { table: 'grant_provider_match_results', col: 'grant_provider_id', ids: (grantProvRes.data ?? []).map((p: any) => p.id) },
            { table: 'power_trader_match_results', col: 'power_trader_id', ids: (traderRes.data ?? []).map((p: any) => p.id) },
            // Developer side: matches scored against projects this company owns
            { table: 'capital_match_results', col: 'project_id', ids: null as string[] | null },
          ];

          const { data: devProjects } = await supabase
            .from('projects').select('id').eq('developer_id', companyId);
          matchQueries[6].ids = (devProjects ?? []).map((p: any) => p.id);

          const results = await Promise.all(
            matchQueries
              .filter(q => (q.ids?.length ?? 0) > 0)
              .map(q =>
                supabase
                  .from(q.table)
                  .select('project_id, compatibility_score, created_at')
                  .in(q.col, q.ids!)
                  .gte('created_at', sinceDate)
                  .order('compatibility_score', { ascending: false })
                  .limit(10)
              )
          );

          newMatches = results
            .flatMap(r => r.data ?? [])
            .sort((a, b) => b.compatibility_score - a.compatibility_score)
            .slice(0, 10);
        }

        // Fetch engagement updates since last digest
        const { data: engUpdates } = await supabase
          .from('engagements')
          .select('id, status, project_id, updated_at')
          .eq('counterparty_id', digest.user_id)
          .gte('updated_at', sinceDate)
          .order('updated_at', { ascending: false })
          .limit(5);

        const matchCount = newMatches?.length ?? 0;
        const engUpdateCount = engUpdates?.length ?? 0;

        // Skip if nothing new
        if (matchCount === 0 && engUpdateCount === 0) {
          // Still update next_scheduled_at
          await updateNextSchedule(supabase, digest);
          continue;
        }

        // Build digest email
        const matchListHtml = (newMatches ?? [])
          .slice(0, 5)
          .map(m => `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/engagements" style="color:#1a1a1a;text-decoration:none;">
                  <strong style="font-size:13px;">Project ${m.project_id.slice(0, 8)}...</strong>
                </a>
                <br/>
                <span style="font-size:11px;color:#64748b;">Score: ${m.compatibility_score}%</span>
              </td>
            </tr>
          `).join('');

        const engListHtml = (engUpdates ?? [])
          .slice(0, 5)
          .map(e => `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/engagements/${e.id}" style="color:#1a1a1a;text-decoration:none;">
                  <strong style="font-size:13px;">${e.status.replace(/_/g, ' ')}</strong>
                </a>
                <br/>
                <span style="font-size:11px;color:#64748b;">Updated ${new Date(e.updated_at).toLocaleDateString()}</span>
              </td>
            </tr>
          `).join('');

        const frequencyLabel = digest.frequency === 'daily' ? 'Daily' : digest.frequency === 'weekly' ? 'Weekly' : 'Monthly';

        const html = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"/></head>
          <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
            <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
              <div style="background:linear-gradient(135deg,#0ea5e9,#06b6d4);padding:32px 24px;text-align:center;">
                <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800;">Your ${frequencyLabel} Match Digest</h1>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">${matchCount} new match${matchCount !== 1 ? 'es' : ''} &middot; ${engUpdateCount} engagement update${engUpdateCount !== 1 ? 's' : ''}</p>
              </div>
              <div style="padding:24px;">
                ${matchCount > 0 ? `
                  <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#0f172a;">New Matches</h2>
                  <table style="width:100%;border-collapse:collapse;">${matchListHtml}</table>
                ` : ''}
                ${engUpdateCount > 0 ? `
                  <h2 style="margin:${matchCount > 0 ? '24px' : '0'} 0 12px;font-size:14px;font-weight:700;color:#0f172a;">Engagement Updates</h2>
                  <table style="width:100%;border-collapse:collapse;">${engListHtml}</table>
                ` : ''}
                <div style="margin-top:24px;text-align:center;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL}/investor" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;">View Dashboard</a>
                </div>
              </div>
              <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
                <p style="margin:0;font-size:11px;color:#94a3b8;">You're receiving this because you have ${frequencyLabel} digests enabled. <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings" style="color:#0ea5e9;">Manage preferences</a></p>
              </div>
            </div>
          </body>
          </html>
        `;

        // Send the digest email
        await sendEmail({
          to: email,
          subject: `AfriConnect ${frequencyLabel} Digest: ${matchCount} new match${matchCount !== 1 ? 'es' : ''}`,
          html,
          logType: 'matching_digest',
          logEntityId: digest.id,
        });

        // Log the digest
        await supabase.from('matching_digest_logs').insert({
          user_id: digest.user_id,
          frequency: digest.frequency,
          matches_sent: matchCount,
          new_matches: matchCount,
          score_changes: 0,
          engagement_updates: engUpdateCount,
        });

        // Update schedule
        await updateNextSchedule(supabase, digest);
        sent++;
      } catch (err) {
        console.error(`[Digest] Failed for user ${digest.user_id}:`, err);
      }
    }

    return Response.json({ data: { processed, sent } });
  } catch (e) {
    return handleRouteError(e);
  }
}

async function updateNextSchedule(supabase: any, digest: any) {
  const now = new Date();
  let next: Date;
  if (digest.frequency === 'daily') {
    next = new Date(now);
    next.setDate(next.getDate() + 1);
  } else if (digest.frequency === 'weekly') {
    next = new Date(now);
    next.setDate(next.getDate() + 7);
  } else {
    next = new Date(now);
    next.setMonth(next.getMonth() + 1);
  }
  next.setUTCHours(8, 0, 0, 0);

  await supabase
    .from('matching_digests')
    .update({
      last_sent_at: now.toISOString(),
      next_scheduled_at: next.toISOString(),
    })
    .eq('id', digest.id);
}
