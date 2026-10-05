import { NextRequest } from 'next/server';
import { getAuthenticatedUser, handleRouteError, forbidden } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/analytics/platform
 * Returns platform-wide analytics for the admin dashboard:
 * - Overview KPIs
 * - 30-day trends
 * - Match score distribution
 * - Engagement funnel
 * - Sector breakdown
 * - Average time to close
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user.is_platform_admin) return forbidden();
    const supabase = getSupabaseAdmin();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // ── Parallel queries ──────────────────────────────────────
    const [
      usersRes,
      projectsRes,
      companiesRes,
      engagementsRes,
      // Match scores live in per-partner-type tables (there is no single
      // `match_results` table — querying it returns a schema error and an
      // empty chart). Aggregate all of them for the distribution.
      capitalMatchesRes,
      technicalMatchesRes,
      consultantMatchesRes,
      grantMatchesRes,
      grantProviderMatchesRes,
      traderMatchesRes,
      previousUsersRes,
      previousProjectsRes,
    ] = await Promise.all([
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('projects').select('id, capital_required, technology_type, status, created_at', { count: 'exact' }),
      supabase.from('companies').select('id', { count: 'exact', head: true }),
      supabase.from('engagements').select('id, status, created_at, updated_at'),
      // Match scores live in per-partner-type tables (there is no single
      // `match_results` table — querying it returns a schema error and an
      // empty chart). Aggregate all of them for the distribution.
      supabase.from('capital_match_results').select('compatibility_score'),
      supabase.from('technical_match_results').select('compatibility_score'),
      supabase.from('consultant_match_results').select('compatibility_score'),
      supabase.from('grant_match_results').select('compatibility_score'),
      supabase.from('grant_provider_match_results').select('compatibility_score'),
      supabase.from('power_trader_match_results').select('compatibility_score'),
      supabase.from('user_profiles').select('id', { count: 'exact', head: true })
        .lte('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('projects').select('id', { count: 'exact', head: true })
        .lte('created_at', thirtyDaysAgo.toISOString()),
    ]);

    // ── Overview KPIs ─────────────────────────────────────────
    const totalUsers = usersRes.count ?? 0;
    const totalProjects = projectsRes.count ?? 0;
    const totalCompanies = companiesRes.count ?? 0;
    const totalEngagements = (engagementsRes.data ?? []).length;
    const totalCapital = (projectsRes.data ?? []).reduce((sum, p) => sum + (p.capital_required ?? 0), 0);

    // ── 30-day trend: group by day ────────────────────────────
    const allProjects = projectsRes.data ?? [];
    const allEngagements = engagementsRes.data ?? [];
    const allMatches = [
      ...(capitalMatchesRes.data ?? []),
      ...(technicalMatchesRes.data ?? []),
      ...(consultantMatchesRes.data ?? []),
      ...(grantMatchesRes.data ?? []),
      ...(grantProviderMatchesRes.data ?? []),
      ...(traderMatchesRes.data ?? []),
    ];

    const dailyProjects = new Map<string, number>();
    const dailyEngagements = new Map<string, number>();
    for (const p of allProjects) {
      if (new Date(p.created_at) >= thirtyDaysAgo) {
        const day = p.created_at.split('T')[0];
        dailyProjects.set(day, (dailyProjects.get(day) ?? 0) + 1);
      }
    }
    for (const e of allEngagements) {
      if (new Date(e.created_at) >= thirtyDaysAgo) {
        const day = e.created_at.split('T')[0];
        dailyEngagements.set(day, (dailyEngagements.get(day) ?? 0) + 1);
      }
    }

    const trends: { date: string; users: number; projects: number; engagements: number; matches: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      trends.push({
        date: key,
        users: 0, // We don't have per-day user signups easily, approximate with 0
        projects: dailyProjects.get(key) ?? 0,
        engagements: dailyEngagements.get(key) ?? 0,
        matches: 0,
      });
    }

    // ── Match score distribution ──────────────────────────────
    const matchDist = [
      { range: '90-100', count: 0 },
      { range: '75-89', count: 0 },
      { range: '60-74', count: 0 },
      { range: '40-59', count: 0 },
      { range: '0-39', count: 0 },
    ];
    for (const m of allMatches) {
      const s = m.compatibility_score ?? 0;
      if (s >= 90) matchDist[0].count++;
      else if (s >= 75) matchDist[1].count++;
      else if (s >= 60) matchDist[2].count++;
      else if (s >= 40) matchDist[3].count++;
      else matchDist[4].count++;
    }

    // ── Engagement funnel ─────────────────────────────────────
    const NDA_STATES = ['NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'];
    const DD_STATES = ['DUE_DILIGENCE', 'TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'];
    const TS_STATES = ['TERM_SHEET', 'CONTRACT_SIGNED', 'CAPITAL_COMMITTED', 'CLOSED'];
    const CLOSED_STATES = ['CLOSED', 'CAPITAL_COMMITTED'];

    const introCount = allEngagements.length;
    const ndaCount = allEngagements.filter(e => NDA_STATES.includes(e.status)).length;
    const ddCount = allEngagements.filter(e => DD_STATES.includes(e.status)).length;
    const tsCount = allEngagements.filter(e => TS_STATES.includes(e.status)).length;
    const closedCount = allEngagements.filter(e => CLOSED_STATES.includes(e.status)).length;

    const rate = (n: number, d: number) => d === 0 ? 0 : Math.round((n / d) * 100);

    const engagementFunnel = [
      { stage: 'Introduction', count: introCount, conversionRate: 100 },
      { stage: 'NDA Signed', count: ndaCount, conversionRate: rate(ndaCount, introCount) },
      { stage: 'Due Diligence', count: ddCount, conversionRate: rate(ddCount, ndaCount) },
      { stage: 'Term Sheet', count: tsCount, conversionRate: rate(tsCount, ddCount) },
      { stage: 'Closed', count: closedCount, conversionRate: rate(closedCount, tsCount) },
    ];

    // ── Sector breakdown ──────────────────────────────────────
    const sectorMap = new Map<string, { count: number; capital: number }>();
    for (const p of allProjects) {
      const sector = p.technology_type ?? 'Unknown';
      const existing = sectorMap.get(sector) ?? { count: 0, capital: 0 };
      existing.count++;
      existing.capital += p.capital_required ?? 0;
      sectorMap.set(sector, existing);
    }
    const sectorBreakdown = Array.from(sectorMap.entries())
      .map(([sector, data]) => ({ sector, ...data }))
      .sort((a, b) => b.capital - a.capital)
      .slice(0, 10);

    // ── Average time to close ─────────────────────────────────
    const closedEngagements = allEngagements.filter(e =>
      CLOSED_STATES.includes(e.status) && e.updated_at
    );
    const avgDays = closedEngagements.length > 0
      ? Math.round(
          closedEngagements.reduce((sum, e) => {
            const days = (new Date(e.updated_at!).getTime() - new Date(e.created_at).getTime()) / (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0) / closedEngagements.length
        )
      : 0;

    return Response.json({
      data: {
        overview: {
          totalUsers,
          totalProjects,
          totalCompanies,
          totalCapital,
          totalEngagements,
        },
        trends,
        matchDistribution: matchDist,
        engagementFunnel,
        sectorBreakdown,
        avgTimeToClose: avgDays,
      },
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
